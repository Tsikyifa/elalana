import { useEffect, useState } from 'react'
import { fetchCurrentUser } from '../../api/users.api'
import AvancementView from './avancement/AvancementView'
import MarcheForm from './common/MarcheForm'

export function TravauxList() {
  const [showForm, setShowForm] = useState(false)
  const [canCreateMarche, setCanCreateMarche] = useState(true)
  const [canManageProgress, setCanManageProgress] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const shouldOpen = sessionStorage.getItem('open-marche-form') === '1'
    if (shouldOpen) {
      setShowForm(true)
      sessionStorage.removeItem('open-marche-form')
    }
  }, [])

  useEffect(() => {
    void fetchCurrentUser()
      .then((response) => {
        const roles = response.user.roles ?? []
        const isProjectManager = response.user.is_project_manager ?? roles.includes('chef_de_projet')
        const isReadOnlyViewer = roles.some((role) => ['visiteur', 'ministre', 'viewer', 'audience_ministre'].includes(role))
        setCanCreateMarche(!(isProjectManager || isReadOnlyViewer))
        setCanManageProgress(!isReadOnlyViewer)
      })
      .catch(() => {
        setCanCreateMarche(true)
        setCanManageProgress(true)
      })
  }, [])

  const handleSuccess = () => {
    setShowForm(false)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('marche:created'))
    }
  }

  return (
    <section className="travaux-overview">
      <AvancementView
        onNewMarche={() => setShowForm(true)}
        canCreateMarche={canCreateMarche}
        canManageProgress={canManageProgress}
      />
      {showForm && <MarcheForm onClose={() => setShowForm(false)} onSuccess={handleSuccess} />}
    </section>
  )
}
