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
import { fetchCurrentUser } from './api/users.api'

export type { AppPage } from './routes/hashRoute'

const AUTH_STORAGE_KEY = 'app-auth-state'

/** `checking` tant que la session n'a pas été validée : on ne sait pas encore quoi afficher. */
type Session = 'checking' | 'authenticated' | 'anonymous'

type AppUser = {
  id: number
  username: string
  email?: string
  first_name?: string
  last_name?: string
  is_superuser: boolean
  is_project_manager?: boolean
  roles: string[]
}

function App() {
  // La page courante vient de l'URL : un rafraîchissement ne la perd plus.
  const [route, setRoute] = useState<Route>(readRoute)
  const [session, setSession] = useState<Session>('checking')
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null)

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

  // Verify session on mount so a page refresh keeps the user logged in.
  // The persisted auth flag is a safety net: if the user explicitly logged out,
  // a refresh must not restore the dashboard from a stale cookie.
  useEffect(() => {
    let mounted = true

    async function checkSession() {
      const storedState = window.localStorage.getItem(AUTH_STORAGE_KEY)

      if (storedState === 'anonymous') {
        if (mounted) setSession('anonymous')
        return
      }

      try {
        const res = await fetch(`${API_BASE_URL}/auth/me/`, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        })

        if (!mounted) return

        if (res.ok) {
          const data = await res.json() as { user?: AppUser; can_manage_users?: boolean }
          const user = data.user ?? null
          setCurrentUser(user ?? null)
          window.localStorage.setItem(AUTH_STORAGE_KEY, 'authenticated')
          setSession('authenticated')
          return
        }

        window.localStorage.setItem(AUTH_STORAGE_KEY, 'anonymous')
        setCurrentUser(null)
        setSession('anonymous')
      } catch {
        // Réseau injoignable : on traite comme une session absente.
        if (mounted) {
          window.localStorage.setItem(AUTH_STORAGE_KEY, 'anonymous')
          setCurrentUser(null)
          setSession('anonymous')
        }
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

    document.cookie = 'access=; Max-Age=0; path=/; SameSite=Lax'
    window.localStorage.setItem(AUTH_STORAGE_KEY, 'anonymous')
    setCurrentUser(null)
    setSession('anonymous')
    navigate({ page: LOGIN_PAGE, tab: null })
  }, [navigate])

  useEffect(() => {
    if (!currentUser) return

    const isProjectManager = currentUser.roles.includes('chef_de_projet')
    if (isProjectManager && !['dashboard', 'travaux', 'cartographie'].includes(route.page)) {
      navigate({ page: 'dashboard', tab: null })
    }
  }, [currentUser, route.page, navigate])

  // while checking authentication, render nothing to avoid flashing login
  if (session === 'checking') return null

  if (session === 'anonymous' || route.page === LOGIN_PAGE) {
    return <Login onLogin={async () => {
      window.localStorage.setItem(AUTH_STORAGE_KEY, 'authenticated')
      try {
        const data = await fetchCurrentUser()
        setCurrentUser(data.user ?? null)
      } catch {
        setCurrentUser(null)
      }
      setSession('authenticated')
    }} />
  }

  return (
    <Layout
      activePage={route.page}
      onPageChange={handlePageChange}
      onLogout={handleLogout}
      canManageUsers={Boolean(currentUser?.is_superuser || currentUser?.roles.includes('admin'))}
      userRoles={currentUser?.roles ?? []}
      userDisplayName={currentUser ? [currentUser.first_name, currentUser.last_name].filter(Boolean).join(' ') || currentUser.username : 'Utilisateur'}
    >
      <AppRoutes route={route} onNavigate={navigate} userRoles={currentUser?.roles ?? []} />
    </Layout>
  )
}

export default App
