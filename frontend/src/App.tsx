import { useCallback, useEffect, useRef, useState } from 'react'
import { Layout } from './components/layout/Layout'
import { Login } from './pages/auth/Login'
import { AppRoutes } from './routes/AppRoutes'
import {
  DEFAULT_PAGE,
  LOGIN_PAGE,
  buildHash,
  readRoute,
  type AppPage,
  type Route,
} from './routes/hashRoute'
import './App.css'
import { API_BASE_URL } from './api/client'
import { logout } from './api/auth.api'

export type { AppPage } from './routes/hashRoute'

/** `checking` tant que la session n'a pas été validée : on ne sait pas encore quoi afficher. */
type Session = 'checking' | 'authenticated' | 'anonymous'

function App() {
  // La page courante vient de l'URL : un rafraîchissement ne la perd plus.
  const [route, setRoute] = useState<Route>(readRoute)
  const [session, setSession] = useState<Session>('checking')

  // Page visée avant la redirection vers la connexion, pour y revenir après login.
  const pendingRoute = useRef<Route | null>(null)

  // Précédent/suivant du navigateur, et liens directs (#/travaux).
  useEffect(() => {
    const syncFromHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  const navigate = useCallback((next: Route) => {
    const hash = buildHash(next)
    // Poser le même hash ne déclenche pas `hashchange` : rien à faire.
    if (window.location.hash === hash) return
    window.location.hash = hash
  }, [])

  const handlePageChange = useCallback(
    (page: AppPage) => navigate({ page, tab: null }),
    [navigate],
  )

  // Verify session on mount so a page refresh keeps the user logged in
  useEffect(() => {
    let mounted = true

    async function checkSession() {
      try {
        const res = await fetch(`${API_BASE_URL}/intervenants/`, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!mounted) return
        setSession(res.ok ? 'authenticated' : 'anonymous')
      } catch {
        // Réseau injoignable : on traite comme une session absente.
        if (mounted) setSession('anonymous')
      }
    }

    checkSession()

    return () => {
      mounted = false
    }
  }, [])

  /**
   * L'URL est la source de vérité, mais elle ne connaît pas la session : c'est ici
   * qu'on les réconcilie. Sans ce garde-fou, un anonyme sur `#/travaux` voyait la
   * page s'afficher, et un connecté sur `#/login` restait bloqué sur le formulaire.
   */
  useEffect(() => {
    if (session === 'checking') return

    if (session === 'anonymous') {
      if (route.page !== LOGIN_PAGE) {
        pendingRoute.current = route
        navigate({ page: LOGIN_PAGE, tab: null })
      }
      return
    }

    if (route.page === LOGIN_PAGE) {
      const target = pendingRoute.current
      pendingRoute.current = null
      navigate(target ?? { page: DEFAULT_PAGE, tab: null })
    }
  }, [session, route, navigate])

  const handleLogout = useCallback(async () => {
    try {
      await logout()
    } catch {
      // Session déjà invalide côté serveur : le cookie est de toute façon abandonné.
    }
    setSession('anonymous')
  }, [])

  // while checking authentication, render nothing to avoid flashing login
  if (session === 'checking') return null

  if (session === 'anonymous' || route.page === LOGIN_PAGE) {
    return <Login onLogin={() => setSession('authenticated')} />
  }

  return (
    <Layout activePage={route.page} onPageChange={handlePageChange} onLogout={handleLogout}>
      <AppRoutes route={route} onNavigate={navigate} />
    </Layout>
  )
}

export default App
