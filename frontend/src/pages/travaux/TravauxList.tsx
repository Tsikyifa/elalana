import { useState } from 'react'
import AvancementView from './avancement/AvancementView'
import MarcheForm from './common/MarcheForm'

export function TravauxList() {
  const [showForm, setShowForm] = useState(false)

  return (
    <section className="travaux-overview">
      <AvancementView onNewMarche={() => setShowForm(true)} />
      {showForm && <MarcheForm onClose={() => setShowForm(false)} />}
    </section>
  )
}
