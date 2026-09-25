import { useEffect, useMemo, useState } from 'react'
import { fetchAnnuaire } from '../../../api/travaux.api'
import type { AnnuaireContact } from '../../../types/travaux'

export function AnnuaireList() {
  const [contacts, setContacts] = useState<AnnuaireContact[]>([])
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetchAnnuaire()
        setContacts(response ?? [])
      } catch {
        setContacts([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const visibleContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const matchesSearch = `${contact.nom ?? ''} ${contact.fonction ?? ''} ${contact.telephone ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase())
      const matchesRegion = !region || contact.region === region
      return matchesSearch && matchesRegion
    })
  }, [contacts, region, search])

  return (
    <section className="travaux-page">
      <div className="page-header">
        <div>
          <p className="section-kicker">Travaux</p>
          <h1>Annuaire téléphonique</h1>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Recherche et filtres</h2>
        </div>

        <div className="toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nom, fonction ou numéro..."
            className="filter-select"
            style={{ minWidth: 260 }}
          />
          <select value={region} onChange={(event) => setRegion(event.target.value)} className="filter-select">
            <option value="">Toutes les régions</option>
            <option value="ANALAMANGA">Analamanga</option>
            <option value="DIANA">Diana</option>
            <option value="SOFIA">Sofia</option>
            <option value="ATSIMO">Atsimo</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-box">Chargement de l’annuaire...</div>
      ) : (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Région</th>
                <th>Nom & fonction</th>
                <th>Téléphone</th>
                <th>WhatsApp / Email</th>
              </tr>
            </thead>
            <tbody>
              {visibleContacts.map((contact, index) => (
                <tr key={contact.id}>
                  <td>{index + 1}</td>
                  <td>
                    <span className="badge badge-primary">{contact.region ?? '—'}</span>
                  </td>
                  <td>
                    <strong>{contact.nom ?? '—'}</strong>
                    <small>{contact.fonction ?? '—'}</small>
                  </td>
                  <td>
                    <div>{contact.telephone ?? '—'}</div>
                    {contact.telephone1 && <small>{contact.telephone1}</small>}
                  </td>
                  <td>
                    {contact.whatsapp && <div>WhatsApp: {contact.whatsapp}</div>}
                    {contact.whatsapp1 && <small>WhatsApp 2: {contact.whatsapp1}</small>}
                    {contact.email && <small>Email: {contact.email}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
