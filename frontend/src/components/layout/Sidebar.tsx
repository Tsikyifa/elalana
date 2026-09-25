import { useState, useEffect } from 'react'
import type { AppPage } from '../../App'
import { AnchorSimple, BookOpen, Briefcase, ChartBar, House } from '@phosphor-icons/react'
import { PanelLeft } from 'lucide-react'
import { MOBILE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery'
import { ProfileMenu } from './ProfileMenu'

const items: Array<{ key: AppPage; label: string; icon: typeof House }> = [
  { key: 'dashboard', label: 'Accueil', icon: House },
  { key: 'travaux', label: 'Travaux', icon: Briefcase },
  { key: 'bac', label: 'Bac', icon: AnchorSimple },
  { key: 'cp', label: 'Convention Programme', icon: ChartBar },
  { key: 'annuaire', label: 'Annuaire', icon: BookOpen },
]

const shortcuts: Array<{ key: AppPage; label: string }> = [
  { key: 'travaux', label: 'Suivi' },
  { key: 'bac', label: 'Bacs' },
  { key: 'cp', label: 'Rapports' },
]

type SidebarProps = {
  activePage: AppPage
  onPageChange: (page: AppPage) => void
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

export function Sidebar({ activePage, onPageChange, mobileOpen, onCloseMobile }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const isMobileOpen = Boolean(mobileOpen)
  const [brandHovered, setBrandHovered] = useState(false)

  // Le repli desktop n'a pas de sens dans un tiroir : on l'ignore sur mobile.
  const isCollapsed = collapsed && !isMobile

  // Bloque le scroll de la page tant que le tiroir est ouvert.
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileOpen])

  const handleToggleCollapse = () => {
    setCollapsed((value) => !value)
    setBrandHovered(false)
  }

  return (
    <>
      {isMobileOpen && <div className="sidebar__backdrop" onClick={onCloseMobile} />}
      <aside
        id="app-sidebar"
        className={`sidebar${isCollapsed ? ' sidebar--collapsed' : ''}${isMobileOpen ? ' sidebar--mobile-open' : ''}`}
        data-mobile-open={isMobileOpen}
      >
      <div className="sidebar__brand">
        <div
          className="sidebar__brand-wrap"
          onMouseEnter={() => setBrandHovered(true)}
          onMouseLeave={() => setBrandHovered(false)}
          onFocus={() => setBrandHovered(true)}
          onBlur={() => setBrandHovered(false)}
        >
          <img
            className={`sidebar__brand-mark${isCollapsed && brandHovered ? ' sidebar__brand-mark--hidden' : ''}`}
            src="/logomtp.png"
            alt="Logo MTP"
          />
          {!isCollapsed && <span>elalana</span>}

          <button
            type="button"
            className={`sidebar__collapse-toggle${isCollapsed && brandHovered ? ' sidebar__collapse-toggle--visible' : ''}`}
            aria-label={isCollapsed ? 'Agrandir la sidebar' : 'Réduire la sidebar'}
            title={isCollapsed ? 'Agrandir la sidebar' : 'Réduire la sidebar'}
            onClick={handleToggleCollapse}
          >
            <PanelLeft size={16} />
          </button>
        </div>
      </div>

      <div className="sidebar__section">
        {!isCollapsed && <span className="sidebar__section-label">Menu principal</span>}
        <nav className="sidebar__nav" aria-label="Menu principal">
          {items.map((item) => {
            const Icon = item.icon

            return (
              <button
                key={item.key}
                type="button"
                className={`sidebar__item${activePage === item.key ? ' sidebar__item--active' : ''}`}
                onClick={() => {
                  if (isMobileOpen && onCloseMobile) onCloseMobile()
                  onPageChange(item.key)
                }}
                title={isCollapsed ? item.label : undefined}
              >
                <span className="sidebar__item__icon">
                  <Icon size={18} strokeWidth={2} aria-hidden="true" />
                </span>
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>
      </div>

      <div className="sidebar__shortcuts">
        {!isCollapsed && <span className="sidebar__section-label sidebar__section-label--small">Raccourcis</span>}
        <div className="sidebar__shortcut-list">
          {shortcuts.map((shortcut) => (
            <button
              key={shortcut.key}
              type="button"
              className="sidebar__shortcut"
              onClick={() => {
                if (isMobileOpen && onCloseMobile) onCloseMobile()
                onPageChange(shortcut.key)
              }}
              title={isCollapsed ? shortcut.label : undefined}
            >
              {!isCollapsed && shortcut.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reste monté même replié : le menu de thème doit rester atteignable. */}
      <div className="sidebar__profile">
        <div className="sidebar__avatar">A</div>
        {!isCollapsed && (
          <div>
            <div className="sidebar__profile-name">Admin</div>
            <small className="sidebar__profile-role">Profil</small>
          </div>
        )}
        <ProfileMenu />
      </div>
    </aside>
    </>
  )
}
