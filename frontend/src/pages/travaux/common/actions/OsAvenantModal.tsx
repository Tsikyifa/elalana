import { useRef, useState } from 'react'
import type { PpmRow } from '../../ppm/types'
import { createOS } from '../../../../api/travaux.api'

type OsAvenantModalProps = {
  market: PpmRow
  onClose: (refresh?: boolean) => void
}

export default function OsAvenantModal({ market, onClose }: OsAvenantModalProps) {
  const [saving, setSaving] = useState(false)
  const typeRef = useRef<HTMLSelectElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const delaiRef = useRef<HTMLInputElement>(null)
  const delaiUnitRef = useRef<HTMLSelectElement>(null)
  const commentaireRef = useRef<HTMLTextAreaElement>(null)

  const localisation = market.axe || market.region || 'Axe non spécifié'

  return (
    <div className="panel-body marche-form">
      <div className="p-4">
        <div className="row g-3 mb-4 p-3 bg-white rounded shadow-sm mx-0">
          <div className="col-12 d-flex flex-wrap justify-content-between align-items-center gap-2 border-bottom pb-2 mb-3">
            <h6 className="fw-bold mb-0">SAISIE D'UN NOUVEL OS / AVENANT</h6>
            <span className="badge" style={{ background: 'var(--border)', color: 'var(--text)', border: '1px solid var(--border-strong)', borderRadius: 999, fontSize: 12, fontWeight: 700, padding: '6px 12px' }}>
              {localisation}
            </span>
          </div>

          <div className="col-md-8">
            <label className="form-label fw-bold small" htmlFor="ppm-os-objet">Objet du marché</label>
            <input id="ppm-os-objet" className="filter-select" defaultValue={market.objet} readOnly style={{ background: 'var(--panel-soft)' }} />
          </div>

          <div className="col-md-4">
            <label className="form-label fw-bold small" htmlFor="ppm-os-titulaire">Titulaire</label>
            <input id="ppm-os-titulaire" className="filter-select" defaultValue={market.titulaire} readOnly style={{ background: 'var(--panel-soft)' }} />
          </div>

          <div className="col-md-6">
            <label className="form-label fw-bold small" htmlFor="ppm-os-type">Type d'acte</label>
            <select ref={typeRef} id="ppm-os-type" className="filter-select" defaultValue="COMMENCEMENT">
              <option value="COMMENCEMENT">Ordre de service (commencement)</option>
              <option value="ARRET">Ordre de service (arrêt)</option>
              <option value="REPRISE">Reprise</option>
              <option value="AVENANT_DELAI">Avenant de délai</option>
            </select>
          </div>

          <div className="col-md-6">
            <label className="form-label fw-bold small" htmlFor="ppm-os-date">Date d'effet</label>
            <input ref={dateRef} id="ppm-os-date" type="date" className="filter-select" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>

          <div className="col-12">
            <div className="marche-alert-box">
              <label className="form-label fw-bold small" htmlFor="ppm-os-delai">Délai supplémentaire accordé</label>
              <div className="input-group marche-input-group">
                <input
                  ref={delaiRef}
                  id="ppm-os-delai"
                  className="filter-select"
                  inputMode="numeric"
                  aria-label="Délai supplémentaire"
                  defaultValue="0"
                />
                <select ref={delaiUnitRef} className="filter-select marche-input-group__unit" aria-label="Unité du délai" defaultValue="MOIS">
                  <option value="MOIS">Mois</option>
                  <option value="JOURS">Jours</option>
                </select>
                <span className="input-group-text">+</span>
                <input className="filter-select" inputMode="numeric" aria-label="Jours supplémentaires" defaultValue="0" />
                <span className="input-group-text">j</span>
              </div>
              <div className="form-text tiny">Indiquez le temps additionnel (en mois/jours) qui sera ajouté à la date de fin.</div>
            </div>
          </div>

          <div className="col-12">
            <label className="form-label fw-bold small" htmlFor="ppm-os-commentaire">Commentaire / Justification</label>
            <textarea
              ref={commentaireRef}
              id="ppm-os-commentaire"
              className="form-control marche-textarea"
              rows={5}
              defaultValue=""
              placeholder="Commentaire ou justification..."
            />
          </div>
        </div>

        <div className="border-top pt-4 d-flex justify-content-between align-items-center">
          <button type="button" className="btn btn-ghost" onClick={() => onClose(false)}>Annuler</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              try {
                await createOS({
                  marche: market.id,
                  type_os: (typeRef.current?.value ?? 'COMMENCEMENT') as 'COMMENCEMENT' | 'ARRET' | 'REPRISE' | 'AVENANT_DELAI',
                  date_os: dateRef.current?.value ?? new Date().toISOString().slice(0, 10),
                  delai_supplementaire: Number(delaiRef.current?.value ?? 0),
                  delai_unit: (delaiUnitRef.current?.value ?? 'MOIS') as 'JOUR' | 'SEMAINE' | 'MOIS',
                  commentaire: commentaireRef.current?.value ?? '',
                })
                onClose(true)
              } catch {
                alert('Erreur lors de l\'enregistrement de l\'OS.')
                setSaving(false)
              }
            }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer l\'OS'}
          </button>
        </div>
      </div>
    </div>
  )
}
