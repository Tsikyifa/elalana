/**
 * Navigation par hash : l'URL est la seule source de vérité.
 * Elle survit à un rafraîchissement (F5), alimente l'historique du navigateur
 * et rend les pages partageables.
 * Exemples : #/dashboard, #/travaux, #/travaux/avancement
 */

export const APP_PAGES = ['dashboard', 'travaux', 'annuaire', 'bac', 'cp'] as const
export type AppPage = (typeof APP_PAGES)[number]

export const TRAVAUX_TABS = ['ppm', 'glissements', 'avancement'] as const
export type TravauxTab = (typeof TRAVAUX_TABS)[number]

/**
 * La connexion a sa propre URL. Sans elle, l'écran de login n'existait que dans
 * l'état React : un F5 ne pouvait pas y revenir et retombait sur l'accueil.
 */
export const LOGIN_PAGE = 'login'
export type LoginPage = typeof LOGIN_PAGE

export type Route =
  /** Seule route sans Layout et sans onglet. */
  | { page: LoginPage; tab: null; detailId?: null }
  | { page: AppPage; tab: TravauxTab | null; detailId?: string | null }

export const DEFAULT_PAGE: AppPage = 'dashboard'

function isAppPage(value: string | undefined): value is AppPage {
  return value !== undefined && (APP_PAGES as readonly string[]).includes(value)
}

function isTravauxTab(value: string | undefined): value is TravauxTab {
  return value !== undefined && (TRAVAUX_TABS as readonly string[]).includes(value)
}

/** Une URL inconnue retombe sur l'accueil plutôt que de casser l'affichage. */
export function parseHash(hash: string): Route {
  const [page, second, third] = hash.replace(/^#\/?/, '').split('/')

  if (page === LOGIN_PAGE) return { page: LOGIN_PAGE, tab: null, detailId: null }

  if (!isAppPage(page)) return { page: DEFAULT_PAGE, tab: null, detailId: null }

  if (page === 'travaux') {
    if (second === 'detail' && third) {
      return { page: 'travaux', tab: null, detailId: third }
    }

    return {
      page: 'travaux',
      tab: isTravauxTab(second) ? second : null,
      detailId: null,
    }
  }

  return { page, tab: null, detailId: null }
}

export function buildHash(route: Route): string {
  if (route.page === 'travaux' && route.detailId) {
    return `#/travaux/detail/${route.detailId}`
  }

  return route.tab ? `#/${route.page}/${route.tab}` : `#/${route.page}`
}

/** Route correspondant à l'URL actuellement affichée. */
export function readRoute(): Route {
  return parseHash(window.location.hash)
}
