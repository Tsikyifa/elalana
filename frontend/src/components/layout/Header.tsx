import { useEffect, useRef, useState } from 'react'
import type { AppPage } from '../../App'
import { Bell, SignOut, List, Check } from '@phosphor-icons/react'
import { fetchNotifications, fetchUnreadNotificationsCount, markNotificationsRead, type NotificationItem } from '../../api/notifications.api'

const pageTitles: Record<AppPage, string> = {
  dashboard: 'Tableau de bord',
  travaux: 'Gestion des marchés',
  cartographie: 'Cartographie du Réseau Routier & Chantiers',
  annuaire: 'Annuaire téléphonique',
  bac: 'Bacs de traversée',
  cp: 'Conventions programme',
  users: 'Gestion des utilisateurs',
}

type HeaderProps = {
  activePage: AppPage
  onLogout?: () => void
  mobileSidebarOpen?: boolean
  onToggleMobileSidebar?: () => void
}

export function Header({ activePage, onLogout, mobileSidebarOpen, onToggleMobileSidebar }: HeaderProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadNotifications() {
      try {
        const [items, count] = await Promise.all([
          fetchNotifications(),
          fetchUnreadNotificationsCount(),
        ])

        if (cancelled) return
        setNotifications(items)
        setUnreadCount(count)
      } catch (error) {
        console.warn('notification load failed', error)
      }
    }

    void loadNotifications()

    const wsBase = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000'
    const socket = new WebSocket(`${wsBase}/ws/notifications/`)
    wsRef.current = socket

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as NotificationItem
        if (!payload || !payload.id) return
        setNotifications((current) => [payload, ...current].slice(0, 10))
        if (!payload.is_read) {
          setUnreadCount((current) => current + 1)
        }
      } catch (error) {
        console.warn('notification payload parse failed', error)
      }
    }

    socket.onerror = () => {
      console.warn('notification websocket unavailable')
    }

    return () => {
      cancelled = true
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close()
      }
      wsRef.current = null
    }
  }, [])

  const handleMarkAsRead = async () => {
    try {
      const response = await markNotificationsRead()
      if (response.success) {
        setNotifications((current) => current.map((item) => ({ ...item, is_read: true })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.warn('mark notifications read failed', error)
    }
  }

  return (
    <header className="app-header sticky-top">
      <button
        type="button"
        className="app-header__hamburger"
        aria-label="Ouvrir le menu"
        aria-controls="app-sidebar"
        aria-expanded={Boolean(mobileSidebarOpen)}
        onClick={() => onToggleMobileSidebar && onToggleMobileSidebar()}
      >
        <List size={20} />
      </button>

      <div className="app-header__left">
        <h2>{pageTitles[activePage]}</h2>
      </div>

      <div className="app-header__right d-flex align-items-center gap-3" style={{ position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="app-header__notify"
            aria-label="Notifications"
            onClick={() => {
              setIsOpen((value) => !value)
              if (unreadCount > 0) {
                void handleMarkAsRead()
              }
            }}
          >
            <Bell size={16} />
          </button>
          {unreadCount > 0 && (
            <span className="app-header__notify-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}

          {isOpen && (
            <div className="notification-panel" aria-live="polite">
              <div className="notification-panel__header">
                <strong>Notifications</strong>
                {unreadCount > 0 && (
                  <button type="button" className="notification-panel__mark-read" onClick={handleMarkAsRead}>
                    <Check size={12} /> Marquer lu
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="notification-panel__empty">Aucune notification.</div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item${notification.is_read ? '' : ' notification-item--unread'}`}
                  >
                    <div className="notification-item__title">{notification.title}</div>
                    <div className="notification-item__message">{notification.message}</div>
                    <div className="notification-item__time">
                      {new Date(notification.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="app-header__actions">
          <button type="button" className="btn btn-outline-secondary d-flex align-items-center gap-2" onClick={onLogout}>
            <SignOut size={15} />
          </button>
        </div>
      </div>
    </header>
  )
}


