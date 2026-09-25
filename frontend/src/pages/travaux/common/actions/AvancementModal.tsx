import { useRef, useState } from 'react'
import { Gauge, Paperclip } from '@phosphor-icons/react'
import type { PpmRow } from '../../ppm/types'
import { createAvancement, updateAvancement } from '../../../../api/travaux.api'
import type { AvancementItem } from '../../../../types/travaux'

type AvancementModalProps = {
  market: PpmRow
  onClose: (refresh?: boolean) => void
  avancement?: AvancementItem | null
}

export default function AvancementModal({ market, onClose, avancement = null }: AvancementModalProps) {
  const [saving, setSaving] = useState(false)
  const dateRef = useRef<HTMLInputElement>(null)
  const etatRef = useRef<HTMLSelectElement>(null)
  const physiqueRef = useRef<HTMLInputElement>(null)
  const financierRef = useRef<HTMLInputElement>(null)
  const situationRef = useRef<HTMLTextAreaElement>(null)
  const observationRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const legendeRef = useRef<HTMLInputElement>(null)

  return (
    <div className="panel-body marche-form">
      <div className="p-4">
        {/* Identification du marché */}
        <div className="row g-3 mb-4 p-3 bg-white rounded shadow-sm mx-0">
          <div className="col-12 d-flex flex-wrap justify-content-between align-items-center gap-2 border-bottom pb-2 mb-3">
            <h6 className="fw-bold mb-0">MARCHÉ CONCERNÉ</h6>
            <span className="badge" style={{ background: 'var(--border)', color: 'var(--text)', padding: '0.4rem 0.7rem', borderRadius: 999 }}>
              {market.axe}
            </span>
          </div>

          <div className="col-md-7">
            <label className="form-label fw-bold small" htmlFor="ppm-av-objet">Objet</label>
            <input id="ppm-av-objet" className="filter-select" defaultValue={market.objet} readOnly style={{ background: 'var(--panel-soft)' }} />
          </div>

          <div className="col-md-5">
            <label className="form-label fw-bold small" htmlFor="ppm-av-titulaire">Entreprise</label>
            <input id="ppm-av-titulaire" className="filter-select" defaultValue={market.titulaire} readOnly style={{ background: 'var(--panel-soft)' }} />
          </div>
        </div>

        <div className="row g-3">
          <div className="col-lg-7">
            <div className="d-flex flex-column gap-3 h-100">
              {/* Indicateurs */}
              <div className="card shadow-sm border-0">
                <div className="card-header fw-bold py-3" style={{ background: 'var(--panel-soft)', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                  <span className="marche-section__title">
                    <Gauge size={18} weight="bold" aria-hidden="true" />
                    Indicateurs de performance
                  </span>
                </div>
                <div className="card-body p-4">
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label fw-bold small" htmlFor="ppm-av-date">Date du relevé</label>
                      <input ref={dateRef} id="ppm-av-date" type="date" className="filter-select" defaultValue={avancement?.date_avancement ?? new Date().toISOString().slice(0, 10)} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-bold small" htmlFor="ppm-av-etat">État d'avancement</label>
                      <select ref={etatRef} id="ppm-av-etat" className="filter-select" defaultValue={avancement?.situation_w ?? 'En_cours'}>
                        <option value="En_cours">En cours</option>
                        <option value="Arrete">En retard / Arrêté</option>
                        <option value="Acheve">Achevé</option>
                      </select>
                    </div>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="marche-alert-box">
                        <label className="form-label fw-bold small" htmlFor="ppm-av-physique">% Physique</label>
                        <input
                          ref={physiqueRef}
                          id="ppm-av-physique"
                          className="filter-select"
                          type="number"
                          inputMode="decimal"
                          defaultValue={(avancement?.avancement_physique ?? Number.parseFloat(market.physique.replace('%', ''))) || 0}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="marche-alert-box">
                        <label className="form-label fw-bold small" htmlFor="ppm-av-financier">% Financier</label>
                        <input
                          ref={financierRef}
                          id="ppm-av-financier"
                          className="filter-select"
                          type="number"
                          inputMode="decimal"
                          defaultValue={(avancement?.avancement_financier ?? Number.parseFloat(market.financier.replace('%', ''))) || 0}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
    
              {/* Détails */}
              <div className="card shadow-sm border-0 flex-grow-1">
                <div className="card-header fw-bold py-3" style={{ background: 'var(--panel-soft)', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                  Détails et observations
                </div>
                <div className="card-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-bold small" htmlFor="ppm-av-situation">Situation détaillée</label>
                    <textarea
                      ref={situationRef}
                      id="ppm-av-situation"
                      className="form-control marche-textarea"
                      rows={4}
                      defaultValue={avancement?.detail_situation ?? ''}
                      placeholder="Décrivez la situation détaillée..."
                    />
                  </div>
                  <div>
                    <label className="form-label fw-bold small" htmlFor="ppm-av-observations">Observations particulières</label>
                    <textarea
                      ref={observationRef}
                      id="ppm-av-observations"
                      className="form-control marche-textarea"
                      rows={4}
                      defaultValue={avancement?.observation ?? ''}
                      placeholder="Observations particulières..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pièces jointes */}
          <div className="col-lg-5">
            <div className="card shadow-sm border-0 h-100 d-flex flex-column">
              <div className="card-header fw-bold py-3" style={{ background: 'var(--panel-soft)', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                <span className="marche-section__title">
                  <Paperclip size={18} weight="bold" aria-hidden="true" />
                  Pièces jointes
                </span>
              </div>
              <div className="card-body d-flex flex-column flex-grow-1" style={{ background: 'var(--surface)' }}>
                <div className="p-3 border rounded mb-3 bg-white shadow-sm">
                  <label className="form-label fw-bold small" htmlFor="ppm-av-fichier">Fichier</label>
                  <input ref={fileRef} id="ppm-av-fichier" type="file" className="filter-select" />
                </div>
                <div className="p-3 border rounded bg-white shadow-sm">
                  <label className="form-label fw-bold small" htmlFor="ppm-av-legende">Légende / Description</label>
                  <input ref={legendeRef} id="ppm-av-legende" className="filter-select" defaultValue="Photo du site" />
                </div>
                <p className="small text-muted fst-italic mt-auto pt-3 mb-0 border-top">
                  Max 5Mo par fichier. JPG, PNG ou PDF.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 d-flex justify-content-between align-items-center border-top pt-4">
        <button type="button" className="btn btn-ghost" onClick={() => onClose(false)}>Retour au marché</button>
        <button
          type="button"
          className="btn btn-success"
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            try {
              const file = fileRef.current?.files?.[0] ?? null
              const legend = legendeRef.current?.value ?? ''

              const payload = {
                marche: market.id,
                date_avancement: dateRef.current?.value ?? new Date().toISOString().slice(0, 10),
                avancement_physique: Number(physiqueRef.current?.value ?? 0),
                avancement_financier: Number(financierRef.current?.value ?? 0),
                situation_w: (etatRef.current?.value ?? 'En_cours') as 'En_cours' | 'Arrete' | 'Acheve' | 'Résilié',
                detail_situation: situationRef.current?.value ?? '',
                observation: observationRef.current?.value ?? '',
              }

              if (avancement && avancement.id) {
                // Update existing avancement (no file upload for edit)
                await updateAvancement(avancement.id, payload)
              } else {
                await createAvancement(payload, file, legend)
              }
              onClose(true)
            } catch {
              alert('Erreur lors de l\'enregistrement du relevé.')
              setSaving(false)
            }
          }}
        >
          {saving ? 'Enregistrement…' : avancement && avancement.id ? 'Mettre à jour' : 'Enregistrer le relevé'}
        </button>
      </div>
    </div>
  )
}
