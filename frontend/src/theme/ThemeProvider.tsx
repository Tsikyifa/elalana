import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'elalana-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

/** Sans préférence enregistrée, on reste sur le thème clair historique. */
function readStoredPreference(): ThemePreference {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'light'
}

function systemPrefersDark() {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches
}

type ThemeContextValue = {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  // Seul le mode « Système » dépend du réglage de l'OS : ailleurs, aucun écouteur.
  useEffect(() => {
    if (preference !== 'system' || typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia(DARK_QUERY)
    const handleChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)

    setSystemDark(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [preference])

  const resolved: ResolvedTheme =
    preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = resolved
    // Bootstrap 5.3 bascule ses propres composants (form-control, table…) sur cet attribut.
    root.dataset.bsTheme = resolved
  }, [resolved])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, preference)
  }, [preference])

  const setPreference = useCallback((next: ThemePreference) => setPreferenceState(next), [])

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme doit être utilisé à l’intérieur d’un ThemeProvider')
  return context
}
