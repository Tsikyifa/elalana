import { useState } from 'react'
import AvancementView from './avancement/AvancementView'
import MarcheForm from './common/MarcheForm'

export function TravauxList() {
  const [showForm, setShowForm] = useState(false)

  const handleSuccess = () => {
    setShowForm(false)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('marche:created'))
    }
  }

  return (
    <section className="travaux-overview">
      <AvancementView onNewMarche={() => setShowForm(true)} />
      {showForm && <MarcheForm onClose={() => setShowForm(false)} onSuccess={handleSuccess} />}
    </section>
  )
}
