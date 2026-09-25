import { Dashboard } from '../pages/dashboard/Dashboard'
import { AnnuaireList } from '../pages/travaux/annuaire/AnnuaireList'
import { BacList } from '../pages/travaux/bac/BacList'
import { ConventionProgrammeList } from '../pages/travaux/cp/ConventionProgrammeList'
import { TravauxList } from '../pages/travaux/TravauxList'
import MarcheDetailPage from '../pages/travaux/common/MarcheDetailPage'
import type { Route } from './hashRoute'

type AppRoutesProps = {
  route: Route
  onNavigate: (route: Route) => void
}

export function AppRoutes({ route }: AppRoutesProps) {
  switch (route.page) {
    case 'dashboard':
      return <Dashboard />
    case 'travaux':
      if (route.detailId) {
        return <MarcheDetailPage marcheId={route.detailId} />
      }
      return <TravauxList />
    case 'annuaire':
      return <AnnuaireList />
    case 'bac':
      return <BacList />
    case 'cp':
      return <ConventionProgrammeList />
    default:
      return <Dashboard />
  }
}
