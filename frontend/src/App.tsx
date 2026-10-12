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

/** Noms des cookies d'authentification (nouveaux + anciens pour purge). */
const AUTH_COOKIE_NAMES = [
  'access_v2',
  'sessionid_v2',
  'access',
  'sessionid',
]

function debugAuth(message: string, payload?: Record<string, unknown>) {
  // Logs de diagnostic : retirer la condition DEV le temps du debug.
  console.debug(`[auth] ${message}`, payload ?? {})
}

function clearAuthCookies() {
  const hostname = window.location.hostname
  const candidateDomains = Array.from(
    new Set(
      [
        undefined,
        hostname,
        hostname.startsWith('.') ? hostname : `.${hostname}`,
        hostname.endsWith('.elalana.mg') ? '.elalana.mg' : undefined,
        hostname.endsWith('.elalana.mg') ? 'back.elalana.mg' : undefined,
        hostname.endsWith('.elalana.mg') ? 'dev.elalana.mg' : undefined,
        hostname.endsWith('.elalana.mg') ? 'elalana.mg' : undefined,
      ].filter((value): value is string | undefined => Boolean(value)),
    ),
  )

  for (const cookieName of AUTH_COOKIE_NAMES) {
    for (const domain of candidateDomains) {
      const variants = [
        domain
          ? `${cookieName}=; Max-Age=0; path=/; domain=${domain}; SameSite=Lax`
          : `${cookieName}=; Max-Age=0; path=/; SameSite=Lax`,
        domain
          ? `${cookieName}=; Max-Age=0; path=/; domain=${domain}; SameSite=None; Secure`
          : `${cookieName}=; Max-Age=0; path=/; SameSite=None; Secure`,
      ]
      for (const cookie of variants) {
        document.cookie = cookie
      }
    }
  }

  debugAuth('clearAuthCookies', { hostname, cookies: document.cookie })
}

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
  const [route, setRoute] = useState<Route>(readRoute)
  const [session, setSession] = useState<Session>('checking')
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null)

  const authRequestIdRef = useRef(0)
  const pendingRoute = useRef<Route | null>(null)

  useEffect(() => {
    const syncFromHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  const navigate = useCallback((next: Route) => {
    const hash = buildHash(next)
    if (window.location.hash === hash) return
    window.location.hash = hash
  }, [])

  const handlePageChange = useCallback(
    (page: AppPage) => navigate({ page, tab: null }),
    [navigate],
  )

  /**
   * Vérification initiale de la session au montage.
   * Ne PAS réinitialiser currentUser si la session est déjà valide :
   * sinon on perd l'utilisateur précédemment chargé pendant le refresh.
   */
  useEffect(() => {
    let mounted = true

    async function checkSession() {
      const requestId = ++authRequestIdRef.current
      const storedState = window.localStorage.getItem(AUTH_STORAGE_KEY)

      debugAuth('checkSession start', { requestId, storedState })

      if (storedState === 'anonymous') {
        if (mounted) setSession('anonymous')
        return
      }

      try {
        const res = await fetch(`${API_BASE_URL}/auth/me/`, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        })

        if (!mounted || requestId !== authRequestIdRef.current) return

        if (res.ok) {
          const data = (await res.json()) as { user?: AppUser }
          const user = data.user ?? null
          debugAuth('checkSession success', { user })
          setCurrentUser(user)
          window.localStorage.setItem(AUTH_STORAGE_KEY, 'authenticated')
          setSession('authenticated')
          return
        }

        debugAuth('checkSession 401', { status: res.status })
        window.localStorage.setItem(AUTH_STORAGE_KEY, 'anonymous')
        setCurrentUser(null)
        setSession('anonymous')
      } catch (error) {
        debugAuth('checkSession error', {
          error: error instanceof Error ? error.message : String(error),
        })
        if (mounted && requestId === authRequestIdRef.current) {
          window.localStorage.setItem(AUTH_STORAGE_KEY, 'anonymous')
          setCurrentUser(null)
          setSession('anonymous')
        }
      }
    }

    checkSession()

    return () => {
      mounted = false
      authRequestIdRef.current += 1
    }
  }, [])

  /**
   * Réconciliation session/route.
   * - Anonyme hors login → redirection login
   * - Authentifié sur login → retour à la page par défaut ou route en attente
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
    authRequestIdRef.current += 1

    // 1. Vider d'abord l'état client, AVANT l'appel réseau :
    //    empêche tout rendu transitoire avec l'ancien utilisateur.
    setCurrentUser(null)
    setSession('anonymous')
    window.localStorage.setItem(AUTH_STORAGE_KEY, 'anonymous')
    window.sessionStorage.clear()
    clearAuthCookies()
    pendingRoute.current = null

    // 2. Rediriger immédiatement vers login
    navigate({ page: LOGIN_PAGE, tab: null })

    // 3. Appeler le backend (sans bloquer le rendu)
    try {
      await logout()
    } catch (error) {
      debugAuth('logout backend error', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }, [navigate])

  // Redirection des chefs de projet vers leur dashboard
  useEffect(() => {
    if (!currentUser) return
    const isProjectManager = currentUser.roles.includes('chef_de_projet')
    if (
      isProjectManager &&
      !['dashboard', 'travaux', 'cartographie'].includes(route.page)
    ) {
      navigate({ page: 'dashboard', tab: null })
    }
  }, [currentUser, route.page, navigate])

  if (session === 'checking') return null

  if (session === 'anonymous' || route.page === LOGIN_PAGE) {
    return (
      <Login
        onLogin={async () => {
          // Le POST /auth/login/ a déjà été fait par Login.tsx.
          // On nettoie l'ancien état et on recharge le nouveau user.
          const requestId = ++authRequestIdRef.current

          debugAuth('onLogin start', { requestId })

          // Reset du state AVANT fetch, pour éviter tout rendu transitoire.
          setCurrentUser(null)
          setSession('checking')
          window.localStorage.setItem(AUTH_STORAGE_KEY, 'authenticated')

          try {
            const data = await fetchCurrentUser()
            if (requestId !== authRequestIdRef.current) {
              debugAuth('onLogin stale response ignored', { requestId })
              return
            }
            const user = data.user ?? null
            debugAuth('onLogin /auth/me/ success', { user })
            setCurrentUser(user)
            setSession('authenticated')
          } catch (error) {
            debugAuth('onLogin /auth/me/ error', {
              error: error instanceof Error ? error.message : String(error),
            })
            if (requestId !== authRequestIdRef.current) return
            window.localStorage.setItem(AUTH_STORAGE_KEY, 'anonymous')
            setCurrentUser(null)
            setSession('anonymous')
          }
        }}
      />
    )
  }

  return (
    <Layout
      activePage={route.page}
      onPageChange={handlePageChange}
      onLogout={handleLogout}
      canManageUsers={Boolean(
        currentUser?.is_superuser || currentUser?.roles.includes('admin'),
      )}
      userRoles={currentUser?.roles ?? []}
      userDisplayName={
        currentUser
          ? [currentUser.first_name, currentUser.last_name]
              .filter(Boolean)
              .join(' ') || currentUser.username
          : 'Utilisateur'
      }
    >
      <AppRoutes
        route={route}
        onNavigate={navigate}
        userRoles={currentUser?.roles ?? []}
      />
    </Layout>
  )
}

export default App