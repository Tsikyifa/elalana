import { useEffect, useMemo, useState } from 'react'
import {
  CurrencyCircleDollar,
  Drop,
  Gauge,
  MapPin,
  Ruler,
  Users,
  WarningDiamond,
} from '@phosphor-icons/react'
import { ApiError } from '../../../api/client'
import { createBac, fetchAxes } from '../../../api/travaux.api'
import type { AxeOption, BacItem } from '../../../types/travaux'
import {
  EMPLOYEUR_PASSEUR_CHOICES,
  ETAT_BAC_CHOICES,
  FINANCEMENT_CHOICES,
  PROPULSION_CHOICES,
  REGION_CHOICES,
} from './bacOptions'

type BacFormProps = {
  onClose: () => void
  onCreated?: (bac: BacItem) => void
  // When editing an existing bac, provide initialData and onUpdated
  initialData?: BacItem | null
  onUpdated?: (bac: BacItem) => void
}

/** Tous les champs texte du formulaire, en string : le nettoyage se fait à l'envoi. */
const EMPTY_FORM = {
  axe: '',
  region: '',
  localite: '',
  riviere: '',
  longitude: '',
  latitude: '',
  propulsion: '',
  portance: '',
  nbr_capacite: '',
  longueur_travers: '',
  constructeur: '',
  etat_bac: 'Operationel',
  detail_etat_bac: '',
  observation: '',
  annee_entretien: '',
  annee_acquisition: '',
  gestionnaire: '',
  chef_bac: '',
  employeur_passeur: '',
  nbre_passeur_fonc: '',
  nbre_passeur_ecd: '',
  nbre_passeur_ar: '',
  besoin_entretien_bac: '',
  etat_financement_bac: '',
  annee_exercice: '',
  projet_en_cours: '',
  projet_en_perspective: '',
}

type FormState = typeof EMPTY_FORM

export default function BacForm({ onClose, onCreated, initialData = null, onUpdated }: BacFormProps) {
  const [form, setForm] = useState<FormState>(() => {
    if (!initialData) return EMPTY_FORM
    return {
      axe: initialData.axe ?? '',
      region: initialData.region ?? '',
      localite: initialData.localite ?? '',
      riviere: initialData.riviere ?? '',
      longitude: String(initialData.longitude ?? ''),
      latitude: String(initialData.latitude ?? ''),
      propulsion: initialData.propulsion ?? '',
      portance: String(initialData.portance ?? ''),
      nbr_capacite: String(initialData.nbr_capacite ?? ''),
      longueur_travers: String(initialData.longueur_travers ?? ''),
      constructeur: initialData.constructeur ?? '',
      etat_bac: initialData.etat_bac ?? 'Operationel',
      detail_etat_bac: initialData.detail_etat_bac ?? '',
      observation: initialData.observation ?? '',
      annee_entretien: String(initialData.annee_entretien ?? ''),
      annee_acquisition: String(initialData.annee_acquisition ?? ''),
      gestionnaire: initialData.gestionnaire ?? '',
      chef_bac: initialData.chef_bac ?? '',
      employeur_passeur: initialData.employeur_passeur ?? '',
      nbre_passeur_fonc: String(initialData.nbre_passeur_fonc ?? ''),
      nbre_passeur_ecd: String(initialData.nbre_passeur_ecd ?? ''),
      nbre_passeur_ar: String(initialData.nbre_passeur_ar ?? ''),
      besoin_entretien_bac: String(initialData.besoin_entretien_bac ?? ''),
      etat_financement_bac: initialData.etat_financement_bac ?? '',
      annee_exercice: String(initialData.annee_exercice ?? ''),
      projet_en_cours: initialData.projet_en_cours ?? '',
      projet_en_perspective: initialData.projet_en_perspective ?? '',
    }
  })
  const [axes, setAxes] = useState<AxeOption[]>([])
  const [pkKm, setPkKm] = useState('')
  const [pkM, setPkM] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [globalError, setGlobalError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Les axes viennent de /api/travaux/axes/ : impossible de les coder en dur.
  useEffect(() => {
    let mounted = true

    fetchAxes()
      .then((data) => {
        if (mounted) setAxes(data ?? [])
      })
      .catch(() => {
        if (mounted) setGlobalError("Impossible de charger la liste des axes routiers.")
      })

    return () => {
      mounted = false
    }
  }, [])

  // Si on reçoit des données initiales (édition), pré-remplir les PK
  useEffect(() => {
    if (!initialData) return
    const pk = String(initialData.pk_bac ?? '')
    if (pk) {
      const parts = pk.split('.')
      const km = parts.length ? Number(parts[0]) : 0
      const m = parts.length > 1 ? Math.round((Number('0.' + parts[1]) || 0) * 1000) : 0
      setPkKm(km ? String(km) : '')
      setPkM(m ? String(m) : '')
    }
  }, [initialData])

  const update = (field: keyof FormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  // PK saisi en km + m, recomposé en décimal à 3 chiffres (12 km + 450 m = 12.450).
  const pkBac = useMemo(() => {
    if (!pkKm && !pkM) return ''
    const km = Number(pkKm || 0)
    const m = Number(pkM || 0)
    if (!Number.isFinite(km) || !Number.isFinite(m)) return ''
    return (km + m / 1000).toFixed(3)
  }, [pkKm, pkM])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrors({})
    setGlobalError('')
    setSubmitting(true)

    try {
      if (initialData) {
        // Update existing
        const { updateBac } = await import('../../../api/travaux.api')
        const updated = await updateBac(initialData.id, { ...form, pk_bac: pkBac })
        onUpdated?.(updated)
        onClose()
      } else {
        const created = await createBac({ ...form, pk_bac: pkBac }, image)
        onCreated?.(created)
        onClose()
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fields)
        setGlobalError(error.message)
      } else {
        setGlobalError("Échec de l'enregistrement du bac. Vérifiez que le serveur est démarré.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  /** Affiche l'erreur renvoyée par DRF sous le champ concerné. */
  const fieldError = (field: string) =>
    errors[field]?.[0] ? <div className="form-text tiny text-danger">{errors[field][0]}</div> : null

  return (
    <div
      className="marche-modal-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 40 }}
    >
      <div className="marche-modal-backdrop" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'var(--scrim)' }} />
      <div className="marche-modal" style={{ position: 'relative', width: 'min(1150px,96%)', maxHeight: '90vh', overflow: 'auto', zIndex: 61 }}>
        <div className="panel">
          <div className="panel-header">
            <div className="panel-header__title">
              <h5>{initialData ? 'Modifier le bac de traversée' : 'Nouveau bac de traversée'}</h5>
            </div>
            <div>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Annuler
              </button>
            </div>
          </div>

          <form className="panel-body marche-form" onSubmit={handleSubmit}>
            {globalError && (
              <div className="alert alert-danger py-2 px-3 small" role="alert">
                {globalError}
              </div>
            )}

            {/* 1. LOCALISATION ET GPS */}
            <div className="row g-3 mb-4 p-3 bg-white rounded shadow-sm mx-0">
              <div className="col-12 border-bottom pb-2 mb-3">
                <h6 className="fw-bold mb-0">
                  <MapPin size={16} weight="bold" aria-hidden="true" />LOCALISATION ET GPS
                </h6>
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold small">AXE ROUTIER</label>
                <select className="filter-select" value={form.axe} onChange={update('axe')}>
                  <option value="">-- Choisir un axe --</option>
                  {axes.map((axe) => (
                    <option key={axe.id} value={axe.id}>
                      {axe.designation}
                      {axe.type_axe_display ? ` (${axe.type_axe_display})` : ''}
                    </option>
                  ))}
                </select>
                <div className="form-text tiny">Champ facultatif : un bac peut exister hors axe référencé.</div>
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold small">RÉGION *</label>
                <select className="filter-select" value={form.region} onChange={update('region')} required>
                  <option value="">-- Choisir une région --</option>
                  {REGION_CHOICES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {fieldError('region')}
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold small">LOCALITÉ</label>
                <input className="filter-select" placeholder="Ex : Andranomanelatra" value={form.localite} onChange={update('localite')} />
                {fieldError('localite')}
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold small">RIVIÈRE / FRANCHISSEMENT</label>
                <input className="filter-select" placeholder="Ex : Rivière Mania" value={form.riviere} onChange={update('riviere')} />
                {fieldError('riviere')}
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold small">PK</label>
                <div className="input-group pk-multi-field">
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Km"
                    aria-label="PK en kilomètres"
                    value={pkKm}
                    onChange={(event) => setPkKm(event.target.value)}
                  />
                  <span className="input-group-text">+</span>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="m"
                    aria-label="PK en mètres"
                    value={pkM}
                    onChange={(event) => setPkM(event.target.value)}
                  />
                </div>
                <div className="form-text tiny">{pkBac ? `Soit PK ${pkBac}` : 'Km + mètres, ex : 12 + 450'}</div>
                {fieldError('pk_bac')}
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold small">LONGITUDE</label>
                <input className="filter-select" type="number" step="0.000001" placeholder="Ex : 47.516000" value={form.longitude} onChange={update('longitude')} />
                {fieldError('longitude')}
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold small">LATITUDE</label>
                <input className="filter-select" type="number" step="0.000001" placeholder="Ex : -18.879000" value={form.latitude} onChange={update('latitude')} />
                {fieldError('latitude')}
              </div>
            </div>

            {/* 2. CARACTÉRISTIQUES TECHNIQUES */}
            <div className="row g-3 mb-4 p-3 bg-white rounded shadow-sm mx-0">
              <div className="col-12 border-bottom pb-2 mb-3">
                <h6 className="fw-bold mb-0">
                  <Ruler size={16} weight="bold" aria-hidden="true" />CARACTÉRISTIQUES TECHNIQUES
                </h6>
              </div>

              <div className="col-md-3">
                <label className="form-label fw-bold small">PROPULSION</label>
                <select className="filter-select" value={form.propulsion} onChange={update('propulsion')}>
                  <option value="">-- Choisir --</option>
                  {PROPULSION_CHOICES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {fieldError('propulsion')}
              </div>

              <div className="col-md-3">
                <label className="form-label fw-bold small">PORTANCE (T)</label>
                <input className="filter-select" type="number" min="0" placeholder="0" value={form.portance} onChange={update('portance')} />
                {fieldError('portance')}
              </div>

              <div className="col-md-3">
                <label className="form-label fw-bold small">CAPACITÉ (PERS/VÉH)</label>
                <input className="filter-select" type="number" min="0" placeholder="0" value={form.nbr_capacite} onChange={update('nbr_capacite')} />
                {fieldError('nbr_capacite')}
              </div>

              <div className="col-md-3">
                <label className="form-label fw-bold small">LONGUEUR TRAVERSÉE (ml)</label>
                <input className="filter-select" type="number" min="0" placeholder="0" value={form.longueur_travers} onChange={update('longueur_travers')} />
                {fieldError('longueur_travers')}
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold small">CONSTRUCTEUR</label>
                <input className="filter-select" placeholder="Ex : SOCOBAT" value={form.constructeur} onChange={update('constructeur')} />
                {fieldError('constructeur')}
              </div>
            </div>

            {/* 3. ÉTAT ET MAINTENANCE */}
            <div className="row g-3 mb-4 p-3 bg-white rounded shadow-sm mx-0">
              <div className="col-12 border-bottom pb-2 mb-3">
                <h6 className="fw-bold mb-0">
                  <WarningDiamond size={16} weight="bold" aria-hidden="true" />ÉTAT ET MAINTENANCE
                </h6>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold small">ÉTAT DU BAC</label>
                <select className="filter-select" value={form.etat_bac} onChange={update('etat_bac')}>
                  {ETAT_BAC_CHOICES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {fieldError('etat_bac')}
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold small">ANNÉE DERNIER ENTRETIEN</label>
                <input className="filter-select" type="number" placeholder="2025" value={form.annee_entretien} onChange={update('annee_entretien')} />
                {fieldError('annee_entretien')}
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold small">ANNÉE D'ACQUISITION</label>
                <input className="filter-select" type="number" placeholder="2019" value={form.annee_acquisition} onChange={update('annee_acquisition')} />
                {fieldError('annee_acquisition')}
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold small">DÉTAILS SUR L'ÉTAT</label>
                <textarea className="form-control marche-textarea" rows={2} placeholder="Nature des dégradations..." value={form.detail_etat_bac} onChange={update('detail_etat_bac')} />
                {fieldError('detail_etat_bac')}
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold small">OBSERVATIONS</label>
                <textarea className="form-control marche-textarea" rows={2} placeholder="Remarques diverses..." value={form.observation} onChange={update('observation')} />
                {fieldError('observation')}
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold small">PHOTO DU BAC</label>
                <input
                  type="file"
                  accept="image/*"
                  className="form-control"
                  onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                />
                <div className="form-text tiny">Facultatif. JPEG ou PNG.</div>
                {fieldError('image')}
              </div>
            </div>

            {/* 4. RESSOURCES HUMAINES */}
            <div className="row g-3 mb-4 p-3 bg-white rounded shadow-sm mx-0">
              <div className="col-12 border-bottom pb-2 mb-3">
                <h6 className="fw-bold mb-0">
                  <Users size={16} weight="bold" aria-hidden="true" /> RESSOURCES HUMAINES
                </h6>
                <div className="form-text tiny mb-0">Répartition des passeurs par statut.</div>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold small">GESTIONNAIRE ACTUEL</label>
                <input className="filter-select" placeholder="Ex : MTP" value={form.gestionnaire} onChange={update('gestionnaire')} />
                {fieldError('gestionnaire')}
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold small">RESPONSABLE DU BAC</label>
                <input className="filter-select" placeholder="Ex : RAKOTO Jean" value={form.chef_bac} onChange={update('chef_bac')} />
                {fieldError('chef_bac')}
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold small">EMPLOYEUR DES PASSEURS</label>
                <select className="filter-select" value={form.employeur_passeur} onChange={update('employeur_passeur')}>
                  <option value="">-- Choisir --</option>
                  {EMPLOYEUR_PASSEUR_CHOICES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {fieldError('employeur_passeur')}
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold small">PASSEURS FONCTIONNAIRES</label>
                <input className="filter-select" type="number" min="0" placeholder="0" value={form.nbre_passeur_fonc} onChange={update('nbre_passeur_fonc')} />
                {fieldError('nbre_passeur_fonc')}
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold small">PASSEURS ECD</label>
                <input className="filter-select" type="number" min="0" placeholder="0" value={form.nbre_passeur_ecd} onChange={update('nbre_passeur_ecd')} />
                {fieldError('nbre_passeur_ecd')}
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold small">PASSEURS AR</label>
                <input className="filter-select" type="number" min="0" placeholder="0" value={form.nbre_passeur_ar} onChange={update('nbre_passeur_ar')} />
                {fieldError('nbre_passeur_ar')}
              </div>
            </div>

            {/* 5. BUDGET ET EXERCICE */}
            <div className="row g-3 mb-4 p-3 bg-white rounded shadow-sm mx-0">
              <div className="col-12 border-bottom pb-2 mb-3">
                <h6 className="fw-bold mb-0">
                  <CurrencyCircleDollar size={16} weight="bold" aria-hidden="true" /> BUDGET ET EXERCICE
                </h6>
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold small">BESOIN FINANCEMENT (Ar)</label>
                <div className="input-group marche-input-group">
                  <input className="filter-select" type="number" step="0.01" min="0" placeholder="0" value={form.besoin_entretien_bac} onChange={update('besoin_entretien_bac')} />
                  <span className="input-group-text">Ar</span>
                </div>
                {fieldError('besoin_entretien_bac')}
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold small">STATUT FINANCEMENT</label>
                <select className="filter-select" value={form.etat_financement_bac} onChange={update('etat_financement_bac')}>
                  <option value="">-- Choisir --</option>
                  {FINANCEMENT_CHOICES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {fieldError('etat_financement_bac')}
              </div>

              <div className="col-md-4">
                <label className="form-label fw-bold small">ANNÉE D'EXERCICE</label>
                <input className="filter-select" type="number" placeholder="2026" value={form.annee_exercice} onChange={update('annee_exercice')} />
                {fieldError('annee_exercice')}
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold small">PROJET EN COURS</label>
                <textarea className="form-control marche-textarea" rows={2} placeholder="Travaux engagés sur le bac..." value={form.projet_en_cours} onChange={update('projet_en_cours')} />
                {fieldError('projet_en_cours')}
              </div>

              <div className="col-md-6">
                <label className="form-label fw-bold small">PROJET EN PERSPECTIVE</label>
                <textarea className="form-control marche-textarea" rows={2} placeholder="Réhabilitation envisagée..." value={form.projet_en_perspective} onChange={update('projet_en_perspective')} />
                {fieldError('projet_en_perspective')}
              </div>

              <div className="col-12">
                <div className="marche-alert-box">
                  <label className="form-label fw-bold small mb-0">
                    <Gauge size={14} weight="bold" aria-hidden="true" /> RÉCAPITULATIF
                  </label>
                  <div className="form-text tiny mb-0">
                    <Drop size={12} /> {form.localite || 'Localité non renseignée'} —{' '}
                    {form.riviere || 'rivière non renseignée'}
                    {pkBac ? ` — PK ${pkBac}` : ''}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-top d-flex justify-content-between align-items-center">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'ENREGISTREMENT...' : 'VALIDER ET ENREGISTRER'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
