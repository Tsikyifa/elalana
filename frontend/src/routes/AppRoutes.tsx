import { Dashboard } from '../pages/dashboard/Dashboard'
import { AnnuaireList } from '../pages/travaux/annuaire/AnnuaireList'
import { BacList } from '../pages/travaux/bac/BacList'
import { ConventionProgrammeList } from '../pages/travaux/cp/ConventionProgrammeList'
import { TravauxList } from '../pages/travaux/TravauxList'
import { CartographieView } from '../pages/cartographie/CartographieView'
import MarcheDetailPage from '../pages/travaux/common/MarcheDetailPage'
import { UserManagementPage } from '../pages/users/UserManagementPage'
import type { Route } from './hashRoute'

type AppRoutesProps = {
  route: Route
  onNavigate: (route: Route) => void
  userRoles?: string[]
}

function isPageAllowedForUser(page: Route['page'], userRoles: string[] = []) {
  const isProjectManager = userRoles.includes('chef_de_projet')

  if (isProjectManager) {
    return ['dashboard', 'travaux', 'cartographie'].includes(page)
  }

  return true
}

export function AppRoutes({ route, userRoles = [] }: AppRoutesProps) {
  if (!isPageAllowedForUser(route.page, userRoles)) {
    return <Dashboard />
  }

  switch (route.page) {
    case 'dashboard':
      return <Dashboard />
    case 'travaux':
      if (route.detailId) {
        return <MarcheDetailPage marcheId={route.detailId} />
      }
      return <TravauxList />
    case 'cartographie':
      return <CartographieView />
    case 'annuaire':
      return <AnnuaireList />
    case 'bac':
      return <BacList />
    case 'cp':
      return <ConventionProgrammeList />
    case 'users':
      return <UserManagementPage />
    default:
      return <Dashboard />
  }
}
