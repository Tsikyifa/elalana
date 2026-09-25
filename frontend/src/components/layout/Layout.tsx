import { useEffect, useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import type { ReactNode } from 'react'
import type { AppPage } from '../../App'
import { MOBILE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery'

type LayoutProps = {
  children: ReactNode
  activePage: AppPage
  onPageChange: (page: AppPage) => void
  onLogout?: () => void
}

export function Layout({ children, activePage, onPageChange, onLogout }: LayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const isMobile = useMediaQuery(MOBILE_QUERY)

  // Retour au format desktop (rotation, redimensionnement) : on referme le tiroir,
  // sinon il resterait en position fixed par-dessus le contenu.
  useEffect(() => {
    if (!isMobile) setMobileSidebarOpen(false)
  }, [isMobile])

  // Échap referme le tiroir, comme n'importe quel panneau modal.
  useEffect(() => {
    if (!mobileSidebarOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileSidebarOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileSidebarOpen])

  return (
    <div className="layout-shell">
      <Sidebar
        activePage={activePage}
        onPageChange={onPageChange}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />
      <div className="layout-content">
        <Header
          activePage={activePage}
          onLogout={onLogout}
          mobileSidebarOpen={mobileSidebarOpen}
          onToggleMobileSidebar={() => setMobileSidebarOpen((s) => !s)}
        />
        <main>{children}</main>
      </div>
    </div>
  )
}
