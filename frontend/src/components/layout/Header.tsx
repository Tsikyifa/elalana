import type { AppPage } from '../../App'
import { Bell, SignOut, List } from '@phosphor-icons/react'

const pageTitles: Record<AppPage, string> = {
  dashboard: 'Tableau de bord',
  travaux: 'Gestion des marchés',
  annuaire: 'Annuaire téléphonique',
  bac: 'Bacs de traversée',
  cp: 'Conventions programme',
}

type HeaderProps = {
  activePage: AppPage
  onLogout?: () => void
  mobileSidebarOpen?: boolean
  onToggleMobileSidebar?: () => void
}

export function Header({ activePage, onLogout, mobileSidebarOpen, onToggleMobileSidebar }: HeaderProps) {
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

      <div className="app-header__right d-flex align-items-center gap-3">
        <button type="button" className="app-header__notify" aria-label="Notifications">
          <Bell size={16} />
          <span className="app-header__notify-badge">3</span>
        </button>

        <div className="app-header__actions">
          <button type="button" className="btn btn-outline-secondary d-flex align-items-center gap-2" onClick={onLogout}>
            <SignOut size={15} />
          </button>
        </div>
      </div>
    </header>
  )
}


