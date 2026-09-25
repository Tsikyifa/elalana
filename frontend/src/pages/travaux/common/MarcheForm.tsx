import { useEffect, useState } from 'react'
import {
  CalendarBlank,
  CurrencyCircleDollar,
  MagnifyingGlass,
  MapPin,
  Signpost,
  Stack,
} from '@phosphor-icons/react'
import { createMarche, fetchAxes } from '../../../api/travaux.api'
import { REGION_CHOICES } from '../bac/bacOptions'
import { ApiError } from '../../../api/client'
import type { AxeOption } from '../../../types/travaux'

type Segment = {
  id?: string
  pk_debut_km?: number | ''
  pk_debut_m?: number | ''
  pk_fin_km?: number | ''
  pk_fin_m?: number | ''
  description?: string
}

type Glissement = {
  id?: string
  annee_origine?: number | ''
  annee_report?: number | ''
  montant_reliquat?: number | ''
  passation?: string
  auc?: string
  date_auc?: string
  observation?: string
}

export default function MarcheForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess?: () => void
}) {
  // Section 1
  const [estAnticipe, setEstAnticipe] = useState(false)
  const [etapeActuelle, setEtapeActuelle] = useState('EXE')
  const [axe, setAxe] = useState('')
  const [region, setRegion] = useState('')
  const [resume, setResume] = useState('')
  const [description, setDescription] = useState('')
  const [responsable, setResponsable] = useState('')
  const [financement, setFinancement] = useState('RPI')

  // Section 2
  const [numMarche, setNumMarche] = useState('')
  const [montant, setMontant] = useState('')
  const [detailFinancement, setDetailFinancement] = useState('')
  const [titulaire, setTitulaire] = useState('')

  // Section 3
  const [tiers, setTiers] = useState('')
  const [osCom, setOsCom] = useState('')
  const [delaiNombre, setDelaiNombre] = useState('')
  const [delaiUnit, setDelaiUnit] = useState('MOIS')
  const [delaiJours, setDelaiJours] = useState('')

  // Dynamic lists
  const [segments, setSegments] = useState<Segment[]>([
    { pk_debut_km: '', pk_debut_m: '', pk_fin_km: '', pk_fin_m: '', description: '' },
  ])
  const [glissements, setGlissements] = useState<Glissement[]>([])

  const [axesList, setAxesList] = useState<AxeOption[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchAxes()
      .then((data) => {
        setAxesList(data)
        if (data.length > 0 && !axe) {
          setAxe(data[0].id)
        }
      })
      .catch(() => {})
  }, [axe])

  function addSegment() {
    setSegments((s) => [
      ...s,
      { pk_debut_km: '', pk_debut_m: '', pk_fin_km: '', pk_fin_m: '', description: '' },
    ])
  }

  function removeSegment(index: number) {
    setSegments((s) => s.filter((_, i) => i !== index))
  }


  function addGlissement() {
    setGlissements((g) => [
      ...g,
      {
        annee_origine: 2025,
        annee_report: 2026,
        montant_reliquat: '',
        passation: '',
        auc: '',
        date_auc: '',
        observation: '',
      },
    ])
  }

  function removeGlissement(index: number) {
    setGlissements((g) => g.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!axe) {
      setErrorMessage('Veuillez sélectionner un axe routier.')
      return
    }
    if (!resume.trim()) {
      setErrorMessage("Veuillez renseigner l'objet / résumé du marché.")
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const validSegments = segments
        .filter((s) => s.pk_debut_km !== '' && s.pk_fin_km !== '')
        .map((s) => ({
          pk_debut: Number(s.pk_debut_km) + Number(s.pk_debut_m || 0) / 1000,
          pk_fin: Number(s.pk_fin_km) + Number(s.pk_fin_m || 0) / 1000,
          description: s.description || '',
        }))

      // Pré-validation côté client : chaque segment doit avoir pk_debut < pk_fin
      for (const seg of validSegments) {
        if (Number(seg.pk_debut) >= Number(seg.pk_fin)) {
          setErrorMessage('Chaque tronçon doit avoir un PK début inférieur au PK fin.')
          setIsSubmitting(false)
          return
        }
      }

      // Prépare les segments : convertit en chaînes à 3 décimales
      // et n'envoie pas la clé `marche`.
      const payloadSegments = validSegments.map((s) => {
        const pd = Number(s.pk_debut)
        const pf = Number(s.pk_fin)
        return {
          pk_debut: Number.isFinite(pd) ? pd.toFixed(3) : String(s.pk_debut),
          pk_fin: Number.isFinite(pf) ? pf.toFixed(3) : String(s.pk_fin),
          description: s.description || '',
        }
      })

      const payload: Record<string, any> = {
        est_anticipe: estAnticipe,
        etape_actuelle: etapeActuelle || 'EXE',
        axe,
        region: region || undefined,
        resume,
        description,
        responsable: responsable || undefined,
        financement: financement || 'RPI',
        num_marche: numMarche || undefined,
        montant: montant ? Number(montant) : undefined,
        detail_financement: detailFinancement || undefined,
        titulaire: titulaire || undefined,
        tiers: tiers || undefined,
        os_com: osCom || undefined,
        delai_nombre: delaiNombre ? Number(delaiNombre) : undefined,
        delai_unit: delaiUnit || 'MOIS',
        delai_jours: delaiJours ? Number(delaiJours) : 0,
      }

      if (payloadSegments.length > 0) payload.segments_pk = payloadSegments

      console.debug('Creating marche payload', payload)

      await createMarche(payload)
      onSuccess?.()
      // Notifie les autres composants (ex: liste PPM) qu'un marché a été créé
      try {
        window.dispatchEvent(new CustomEvent('marche:created'))
      } catch {
        // ignore si window non disponible
      }
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        // Affiche le message principal et les erreurs par champ si présentes
        const details = Object.keys(err.fields).length ? Object.entries(err.fields).map(([k, v]) => `${k}: ${v.join(', ')}`).join(' | ') : ''
        setErrorMessage(details ? `${err.message} — ${details}` : err.message)
      } else {
        setErrorMessage(err instanceof Error ? err.message : "Erreur lors de l'enregistrement du marché")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="marche-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 40 }}>
      <div className="marche-modal-backdrop" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--scrim)' }} />
      <div className="marche-modal" style={{ position: 'relative', width: 'min(1150px,96%)', maxHeight: '90vh', overflow: 'auto', zIndex: 61 }}>
        <div className="panel">
          <div className="panel-header">
            <div className="panel-header__title">
              <h5>Créer un nouveau marché</h5>
            </div>
            <div>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Annuler
              </button>
            </div>
          </div>

          <form className="panel-body marche-form" onSubmit={handleSubmit}>
            {errorMessage && (
              <div className="alert alert-danger mb-3" style={{ margin: '0 1rem' }}>
                {errorMessage}
              </div>
            )}

            {/* 1. IDENTIFICATION ET AXE */}
            <div className="row g-3 mb-4 p-3 bg-white rounded shadow-sm mx-0">
              <div className="col-12 d-flex flex-wrap justify-content-between align-items-center gap-2 border-bottom pb-2 mb-3">
                <h6 className="fw-bold mb-0">1. IDENTIFICATION ET AXE</h6>
                <div className="form-check form-switch mb-0">
                  <input id="est-anticipe" type="checkbox" className="form-check-input" checked={estAnticipe} onChange={(e) => setEstAnticipe(e.target.checked)} />
                  <label className="form-check-label small fw-bold" htmlFor="est-anticipe">MARCHÉ ANTICIPÉ</label>
                </div>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold small">ÉTAT / ÉTAPE ACTUELLE</label>
                <select className="filter-select" value={etapeActuelle} onChange={(e) => setEtapeActuelle(e.target.value)}>
                  <option value="EXE">En cours d'exécution (OS délivré)</option>
                  <option value="ETUDE">En cours d'Étude / Montage APD</option>
                  <option value="VISE_TECH">Dossier Visé (Technique)</option>
                  <option value="PASSATION">En passation du marché</option>
                  <option value="TEF">Transmis pour Examen Financier (TEF)</option>
                  <option value="AO_LANCE">Appel d'Offres Lancé</option>
                  <option value="EVALUATION">En cours d'Évaluation / Attribution</option>
                  <option value="SIGNATURE">En cours de Signature / Approbation</option>
                  <option value="ATTRIBUE">Attribué (En attente OS)</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold small">AXE ROUTIER CONCERNÉ</label>
                <div className="input-group marche-input-group">
                  <span className="input-group-text">
                    <MapPin size={16} weight="bold" aria-hidden="true" />
                  </span>
                  <select className="filter-select" value={axe} onChange={(e) => setAxe(e.target.value)} required>
                    <option value="">-- Choisir un axe --</option>
                    {axesList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.designation} {a.type_axe_display ? `(${a.type_axe_display})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold small">RÉGION</label>
                <select className="filter-select" value={region} onChange={(e) => setRegion(e.target.value)}>
                  <option value="">-- Non spécifié --</option>
                  {REGION_CHOICES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold small">OBJET / RÉSUMÉ</label>
                <input className="filter-select" placeholder="Ex : Réhabilitation de la RN7 PK 45 – PK 60" value={resume} onChange={(e) => setResume(e.target.value)} required />
              </div>

              <div className="col-12">
                <label className="form-label fw-bold small">DESCRIPTION DES TRAVAUX</label>
                <textarea className="form-control marche-textarea" rows={3} placeholder="Nature des travaux, consistance du marché..." value={description} onChange={(e) => setDescription(e.target.value)} required />
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold small">INSTITUTION RESPONSABLE</label>
                <select className="filter-select" value={responsable} onChange={(e) => setResponsable(e.target.value)}>
                  <option value="">-- Non spécifié --</option>
                  <option value="AR">AR — Agence Routière</option>
                  <option value="DINFRA">DINFRA — Direction des Infrastructures</option>
                  <option value="DER">DER — Direction de l'Entretien Routier</option>
                  <option value="DAU">DAU — Direction de l'Aménagement Urbain</option>
                  <option value="CCP">CCP — Cellule de Coordination des Projets</option>
                  <option value="PACFC">PACFC</option>
                  <option value="PCMCI">PCMCI</option>
                  <option value="PDDR">PDDR</option>
                </select>
                <div className="form-text tiny">Entité ou direction assurant la maîtrise d'ouvrage déléguée.</div>
              </div>

              <div className="col-md-6">
                <div className="marche-alert-box">
                  <label className="form-label fw-bold small" htmlFor="financement">
                    <MagnifyingGlass size={14} weight="bold" aria-hidden="true" />
                    SOURCE DE FINANCEMENT
                  </label>
                  <select id="financement" className="filter-select" value={financement} onChange={(e) => setFinancement(e.target.value)}>
                    <option value="RPI">RPI — Ressources Propres Internes</option>
                    <option value="FR">FR — Fonds Routier</option>
                    <option value="FIN_EX">FIN_EX — Financement Extérieur (Bailleurs)</option>
                    <option value="Rech_finan">En recherche de financement</option>
                    <option value="AUTRE">Autre</option>
                  </select>
                  <div className="form-text tiny">Sélectionnez la source de financement attribuée ou prévisionnelle.</div>
                </div>
              </div>
            </div>

            {/* 2 & 3 */}
            <div id="execution-container">
              <div className="row g-3 mb-4 mx-0">
                <div className="col-md-5">
                  <div className="p-3 bg-white rounded shadow-sm h-100">
                    <h6 className="marche-section__title small fw-bold border-bottom pb-2 mb-3">
                      <CurrencyCircleDollar size={18} weight="bold" aria-hidden="true" />
                      2. BUDGET DÉTAILLÉ
                    </h6>

                    <div className="mb-3">
                      <label className="form-label fw-bold small">N° DU MARCHÉ</label>
                      <input className="filter-select" placeholder="Ex : 012/2026/MID" value={numMarche} onChange={(e) => setNumMarche(e.target.value)} />
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-bold small">Montant total (Ar)</label>
                      <div className="input-group marche-input-group">
                        <input className="filter-select" inputMode="decimal" placeholder="0" value={montant} onChange={(e) => setMontant(e.target.value)} />
                        <span className="input-group-text">Ar</span>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-bold small">Détails financement</label>
                      <input className="filter-select" placeholder="Ex : BAD 60 % / Budget national 40 %" value={detailFinancement} onChange={(e) => setDetailFinancement(e.target.value)} />
                    </div>

                    <div>
                      <label className="form-label fw-bold small">Entreprise titulaire</label>
                      <input className="filter-select" placeholder="Ex : SOCOBAT SA" value={titulaire} onChange={(e) => setTitulaire(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="col-md-7">
                  <div className="p-3 bg-white rounded shadow-sm h-100">
                    <h6 className="marche-section__title small fw-bold border-bottom pb-2 mb-3">
                      <CalendarBlank size={18} weight="bold" aria-hidden="true" />
                      3. PLANNING ET TIERS
                    </h6>

                    <div className="mb-3">
                      <label className="form-label fw-bold small">Maître d'œuvre / Contrôle</label>
                      <input className="filter-select" placeholder="Ex : Mission de contrôle / Bureau d'études" value={tiers} onChange={(e) => setTiers(e.target.value)} />
                    </div>

                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="form-label fw-bold small">Date OS N°1</label>
                        <input type="date" className="filter-select" value={osCom} onChange={(e) => setOsCom(e.target.value)} />
                      </div>

                      <div className="col-md-8">
                        <label className="form-label fw-bold small">Délai contractuel</label>
                        <div className="input-group marche-input-group">
                          <input
                            className="filter-select"
                            inputMode="numeric"
                            placeholder="Ex : 12"
                            aria-label="Nombre de l'unité de délai"
                            value={delaiNombre}
                            onChange={(e) => setDelaiNombre(e.target.value)}
                          />
                          <select
                            className="filter-select marche-input-group__unit"
                            aria-label="Unité du délai"
                            value={delaiUnit}
                            onChange={(e) => setDelaiUnit(e.target.value)}
                          >
                            <option value="MOIS">Mois</option>
                            <option value="JOUR">Jours</option>
                            <option value="SEMAINE">Semaines</option>
                          </select>
                          <span className="input-group-text">+</span>
                          <input
                            className="filter-select"
                            inputMode="numeric"
                            placeholder="0"
                            aria-label="Jours supplémentaires"
                            value={delaiJours}
                            onChange={(e) => setDelaiJours(e.target.value)}
                          />
                          <span className="input-group-text">j</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. TRONÇONS */}
              <div className="panel mb-4">
                <div className="panel-header">
                  <div className="panel-header__title">
                    <Signpost size={18} weight="bold" aria-hidden="true" />
                    <h6 className="small fw-bold mb-0">4. TRONÇONS DE ROUTE (PK)</h6>
                  </div>
                </div>
                <div className="panel-body">
                  <div id="segment-list">
                    {segments.map((s, i) => (
                      <div key={i} className="segment-item row g-2 mb-2 pb-3 border-bottom align-items-end">
                        <div className="col-md-3">
                          <label className="small fw-bold">PK DÉBUT</label>
                          <div className="input-group pk-multi-field">
                            <input type="number" className="form-control" placeholder="Km" value={s.pk_debut_km ?? ''} onChange={(e) => {
                              const v = e.target.value === '' ? '' : Number(e.target.value)
                              setSegments((arr) => arr.map((it, idx) => idx === i ? { ...it, pk_debut_km: v } : it))
                            }} />
                            <span className="input-group-text">+</span>
                            <input type="number" className="form-control" placeholder="m" value={s.pk_debut_m ?? ''} onChange={(e) => {
                              const v = e.target.value === '' ? '' : Number(e.target.value)
                              setSegments((arr) => arr.map((it, idx) => idx === i ? { ...it, pk_debut_m: v } : it))
                            }} />
                          </div>
                        </div>

                        <div className="col-md-3">
                          <label className="small fw-bold">PK FIN</label>
                          <div className="input-group pk-multi-field">
                            <input type="number" className="form-control" placeholder="Km" value={s.pk_fin_km ?? ''} onChange={(e) => {
                              const v = e.target.value === '' ? '' : Number(e.target.value)
                              setSegments((arr) => arr.map((it, idx) => idx === i ? { ...it, pk_fin_km: v } : it))
                            }} />
                            <span className="input-group-text">+</span>
                            <input type="number" className="form-control" placeholder="m" value={s.pk_fin_m ?? ''} onChange={(e) => {
                              const v = e.target.value === '' ? '' : Number(e.target.value)
                              setSegments((arr) => arr.map((it, idx) => idx === i ? { ...it, pk_fin_m: v } : it))
                            }} />
                          </div>
                        </div>

                        <div className="col-md-4">
                          <label className="small fw-bold">DESCRIPTION</label>
                          <input className="filter-select" placeholder="Ex : Reprise de chaussée" value={s.description ?? ''} onChange={(e) => setSegments((arr) => arr.map((it, idx) => idx === i ? { ...it, description: e.target.value } : it))} />
                        </div>

                        <div className="col-md-2 text-center">
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeSegment(i)}>Suppr.</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button type="button" id="add-segment" className="btn btn-sm btn-primary mt-2 shadow-sm" onClick={addSegment}>
                    Ajouter un tronçon
                  </button>
                </div>
              </div>

              {/* 5. TRAVAUX GLISSÉS */}
              <div className="panel mb-4">
                <div className="panel-header">
                  <div className="panel-header__title">
                    <Stack size={18} weight="bold" aria-hidden="true" />
                    <h6 className="small fw-bold mb-0">5. TRAVAUX GLISSÉS</h6>
                  </div>
                </div>
                <div className="panel-body">
                  <div id="glissement-list">
                    {glissements.map((g, i) => (
                      <div key={i} className="glissement-item p-3 mb-3 border rounded shadow-sm bg-white position-relative">
                        <div className="row g-3 mb-3">
                          <div className="col-md-2">
                            <label className="tiny fw-bold">Année Origine</label>
                            <input type="number" className="filter-select" placeholder="2025" value={g.annee_origine ?? ''} onChange={(e) => setGlissements((arr) => arr.map((it, idx) => idx === i ? { ...it, annee_origine: e.target.value === '' ? '' : Number(e.target.value) } : it))} />
                          </div>
                          <div className="col-md-2">
                            <label className="tiny fw-bold">Reporté en</label>
                            <input type="number" className="filter-select" placeholder="2026" value={g.annee_report ?? ''} onChange={(e) => setGlissements((arr) => arr.map((it, idx) => idx === i ? { ...it, annee_report: e.target.value === '' ? '' : Number(e.target.value) } : it))} />
                          </div>
                          <div className="col-md-4">
                            <label className="tiny fw-bold">Reliquat (Ar)</label>
                            <div className="input-group marche-input-group">
                              <input type="number" step="0.01" className="filter-select" placeholder="0" value={g.montant_reliquat ?? ''} onChange={(e) => setGlissements((arr) => arr.map((it, idx) => idx === i ? { ...it, montant_reliquat: e.target.value === '' ? '' : Number(e.target.value) } : it))} />
                              <span className="input-group-text">Ar</span>
                            </div>
                          </div>
                          <div className="col-md-4">
                            <label className="tiny fw-bold">État Passation</label>
                            <select className="filter-select" value={g.passation} onChange={(e) => setGlissements((arr) => arr.map((it, idx) => idx === i ? { ...it, passation: e.target.value } : it))}>
                              <option value="LANCEMENT">Lancement</option>
                              <option value="ATTRIBUTION">Attribution</option>
                              <option value="CONTRAT">Contrat</option>
                            </select>
                          </div>
                        </div>

                        <div className="row g-3 align-items-end">
                          <div className="col-md-3">
                            <label className="tiny fw-bold">Statut AUC</label>
                            <select className="filter-select" value={g.auc} onChange={(e) => setGlissements((arr) => arr.map((it, idx) => idx === i ? { ...it, auc: e.target.value } : it))}>
                              <option value="EN_ATTENTE">En attente</option>
                              <option value="OBTENU">Obtenu</option>
                            </select>
                          </div>
                          <div className="col-md-3">
                            <label className="tiny fw-bold">Date AUC</label>
                            <input type="date" className="filter-select" value={g.date_auc ?? ''} onChange={(e) => setGlissements((arr) => arr.map((it, idx) => idx === i ? { ...it, date_auc: e.target.value } : it))} />
                          </div>
                          <div className="col-md-5">
                            <label className="tiny fw-bold">Observation</label>
                            <input className="filter-select" placeholder="Ex : Reliquat à reporter sur le marché 2026" value={g.observation ?? ''} onChange={(e) => setGlissements((arr) => arr.map((it, idx) => idx === i ? { ...it, observation: e.target.value } : it))} />
                          </div>
                          <div className="col-md-1 text-center">
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeGlissement(i)}>Suppr.</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button type="button" className="btn btn-sm btn-ghost mt-2 shadow-sm" onClick={addGlissement}>
                    Ajouter un exercice glissé
                  </button>
                </div>
              </div>

            </div>

            <div className="mt-4 pt-3 border-top d-flex justify-content-between align-items-center">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'ENREGISTREMENT...' : 'VALIDER ET ENREGISTRER'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
