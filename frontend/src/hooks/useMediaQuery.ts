import { useEffect, useState } from 'react'

/** Breakpoint unique du responsive : en dessous, la sidebar devient un tiroir. */
export const MOBILE_QUERY = '(max-width: 900px)'

function getMatch(query: string) {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false
}

/** Suit une media query CSS et se met à jour à chaque redimensionnement. */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => getMatch(query))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mediaQuery = window.matchMedia(query)
    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches)

    setMatches(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [query])

  return matches
}
