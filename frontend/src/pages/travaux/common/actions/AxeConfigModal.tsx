import {Notebook, PlusCircle, Signpost, Trash } from '@phosphor-icons/react'
import { useState } from 'react'

type AxeConfigModalProps = {
  axeName: string
  onClose: () => void
}

type DistrictRow = {
  id: number
  district: string
  pkDebut: string
  pkFin: string
}

const initialDistrictRows: DistrictRow[] = [
  { id: 1, district: '', pkDebut: '', pkFin: '' },
]

export default function AxeConfigModal({ axeName, onClose }: AxeConfigModalProps) {
  const [rows, setRows] = useState<DistrictRow[]>(initialDistrictRows)

  const addDistrict = () => {
    setRows((current) => [
      ...current,
      {
        id: Date.now(),
        district: '',
        pkDebut: '',
        pkFin: '',
      },
    ])
  }

  const removeDistrict = (id: number) => {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current))
  }

  const updateDistrict = (id: number, field: keyof Omit<DistrictRow, 'id'>, value: string) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)))
  }

  return (
    <div className="panel-body marche-form">
      <div className="p-4">
        <div className="row g-3 mb-4 p-3 bg-white rounded shadow-sm mx-0">

          <div className="col-md-6">
            <label className="form-label fw-bold small" htmlFor="axe-designation">Désignation</label>
            <input id="axe-designation" className="filter-select" defaultValue={axeName} />
          </div>

          <div className="col-md-3">
            <label className="form-label fw-bold small" htmlFor="axe-type">Type d'axe</label>
            <select id="axe-type" className="filter-select" defaultValue="RN">
              <option value="RN">Route nationale</option>
              <option value="RR">Route régionale</option>
              <option value="RC">Route communale</option>
              <option value="PT">Pont</option>
              <option value="AU">Autre</option>
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label fw-bold small" htmlFor="axe-longueur">
              Longueur totale (km)
            </label>
            <input id="axe-longueur" className="filter-select" type="number" step="0.001" placeholder="Ex: 45.000" />
          </div>

          <div className="col-md-6">
            <label className="form-label fw-bold small" htmlFor="axe-pk-debut">District / Localité de départ</label>
            <input id="axe-pk-debut" className="filter-select" placeholder="Ex: Antananarivo" />
            <div className="form-text tiny">Localité ou district au début de l'axe</div>
          </div>

          <div className="col-md-6">
            <label className="form-label fw-bold small" htmlFor="axe-pk-fin">District / Localité d'arrivée</label>
            <input id="axe-pk-fin" className="filter-select" placeholder="Ex: Toamasina" />
            <div className="form-text tiny">Localité ou district en fin de l'axe</div>
          </div>

          <div className="col-12">
            <label className="form-label fw-bold small" htmlFor="axe-description">
              <Notebook size={14} weight="bold" aria-hidden="true" />
              Description
            </label>
            <textarea
              id="axe-description"
              className="form-control marche-textarea"
              rows={3}
              placeholder="Description de l'axe routier et interventions prévues..."
            />
          </div>
        </div>

        <div className="mb-4">
          <h5 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text)' }}>
            <Signpost size={18} weight="fill" aria-hidden="true" />
            Districts Traversés
          </h5>

          <div id="district-container">
            {rows.map((row, index) => (
              <div
                key={row.id}
                className="district-row card mb-2 p-3 border-start border-secondary border-4 shadow-sm bg-light"
                style={{ display: 'block' }}
              >
                <div className="row align-items-end g-3">
                  <div className="col-md-5">
                    <label className="small fw-bold text-muted d-block mb-1">Nom du District</label>
                    <input
                      className="filter-select"
                      value={row.district}
                      onChange={(e) => updateDistrict(row.id, 'district', e.target.value)}
                      placeholder="Ex: Ankazobe"
                    />
                  </div>

                  <div className="col-md-3">
                    <label className="small fw-bold text-muted d-block mb-1">PK Début</label>
                    <input
                      className="filter-select"
                      value={row.pkDebut}
                      onChange={(e) => updateDistrict(row.id, 'pkDebut', e.target.value)}
                    />
                  </div>

                  <div className="col-md-3">
                    <label className="small fw-bold text-muted d-block mb-1">PK Fin</label>
                    <input
                      className="filter-select"
                      value={row.pkFin}
                      onChange={(e) => updateDistrict(row.id, 'pkFin', e.target.value)}
                    />
                  </div>

                  <div className="col-md-1 d-flex align-items-end justify-content-center">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      title="Supprimer ce district"
                      aria-label={`Supprimer le district ${index + 1}`}
                      onClick={() => removeDistrict(row.id)}
                      style={{
                        padding: '0.45rem 0.55rem',
                        fontSize: 11,
                        minWidth: 42,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Trash size={13} weight="bold" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button type="button" className="btn btn-ghost mt-2" style={{ borderRadius: 999 }} onClick={addDistrict}>
            <PlusCircle size={15} weight="bold" aria-hidden="true" />
            Ajouter un district
          </button>
        </div>

        <div className="mt-5 border-top pt-3 d-flex justify-content-between align-items-center">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="button" className="btn btn-primary" onClick={onClose}>VALIDER</button>
        </div>
      </div>
    </div>
  )
}
