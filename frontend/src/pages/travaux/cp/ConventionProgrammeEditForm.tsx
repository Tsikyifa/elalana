import { ArrowLeft, CheckCircle, SpinnerGap } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import type { AxeOption, ConventionProgrammeItem } from '../../../types/travaux'
import { fetchAxes } from '../../../api/travaux.api'

type ConventionProgrammeEditFormValues = {
  axe: string
  section: string
  annee: string
  region: string
  nature_surface: string
  longueur_traite: string
  pk_debut: string
  localite_deb: string
  pk_fin: string
  localite_fin: string
  montant_minima: string
  montant_souhaite: string
}

type ConventionProgrammeEditFormProps = {
  initialData?: Partial<ConventionProgrammeItem> & Record<string, string | number | undefined>
  onCancel: () => void
  onSubmit?: (values: Record<string, string | number>) => void
  submitting?: boolean
}

const REGIONS = [
  'ANALAMANGA',
  'VAKINANKARATRA',
  'ITASY',
  'BONGOLAVA',
  'HAUTE-MATSIATRA',
  'AMORON\'I MANIA',
  'VATOVAVY',
  'FITOVINANY',
  'ATSIMO-ATSINANANA',
  'IHOROMBE',
  'ATSINANANA',
  'ANALANJIROFO',
  'ALAOTRA-MANGORO',
  'BOENY',
  'SOFIA',
  'BETSIBOKA',
  'MELAKY',
  'ATSIMO-ANDREFANA',
  'ANDROY',
  'ANOSY',
  'MENABE',
  'DIANA',
  'SAVA',
]

const emptyForm: ConventionProgrammeEditFormValues = {
  axe: '',
  section: '',
  annee: String(new Date().getFullYear()),
  region: '',
  nature_surface: 'RB',
  longueur_traite: '',
  pk_debut: '',
  localite_deb: '',
  pk_fin: '',
  localite_fin: '',
  montant_minima: '',
  montant_souhaite: '',
}

const normalizeInitialData = (initialData?: Record<string, string | number | undefined>) => ({
  ...emptyForm,
  ...(initialData ?? {}),
  annee: String(initialData?.annee ?? emptyForm.annee),
  longueur_traite: String(initialData?.longueur_traite ?? initialData?.longueur ?? emptyForm.longueur_traite),
  montant_minima: String(initialData?.montant_minima ?? ''),
  montant_souhaite: String(initialData?.montant_souhaite ?? ''),
})

export function ConventionProgrammeEditForm({ initialData, onCancel, onSubmit, submitting = false }: ConventionProgrammeEditFormProps) {
  const [form, setForm] = useState<ConventionProgrammeEditFormValues>(() => normalizeInitialData(initialData))
  const [axes, setAxes] = useState<AxeOption[]>([])

  useEffect(() => {
    setForm(normalizeInitialData(initialData))
  }, [initialData])

  useEffect(() => {
    fetchAxes()
      .then((data) => setAxes(data ?? []))
      .catch(() => {})
  }, [])

  const updateField = (field: keyof ConventionProgrammeEditFormValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const isEditing = Boolean(initialData && Object.keys(initialData).length > 0)

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-body" style={{ padding: 24 }}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit?.(form)
          }}
          style={{ display: 'grid', gap: 20 }}
        >
          <div className="row g-3" style={{ margin: 0 }}>
            <div className="col-12" style={{ padding: 0 }}>
              <h6 className="marche-section__title small fw-bold text-uppercase border-bottom pb-2 mb-3">
                1. Identification de l'Axe
              </h6>
            </div>

            <div className="col-md-5">
              <label className="form-label fw-bold">Axe Routier</label>
              <select className="form-select" value={form.axe} onChange={(e) => updateField('axe', e.target.value)} required>
                <option value="">-- Choisir un axe --</option>
                {axes.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.designation || `Axe #${a.id}`}
                  </option>
                ))}
                {/* Fallback if axe from data is not in axes list */}
                {form.axe && !axes.some((a) => String(a.id) === form.axe) && (
                  <option value={form.axe}>{form.axe}</option>
                )}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-bold">Section / Tronçon</label>
              <input
                className="form-control"
                value={form.section}
                onChange={(e) => updateField('section', e.target.value)}
                placeholder="Ex : PK 0 - PK 45"
              />
            </div>

            <div className="col-md-3">
              <label className="form-label fw-bold">Année Budgétaire</label>
              <input
                className="form-control"
                type="number"
                value={form.annee}
                onChange={(e) => updateField('annee', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="row g-3" style={{ margin: 0, background: 'var(--panel-soft)', borderRadius: 12, padding: 16, border: '1px solid var(--border)' }}>
            <div className="col-12" style={{ padding: 0 }}>
              <h6 className="marche-section__title small fw-bold text-uppercase border-bottom pb-2 mb-3">
                2. Localisation (PK et Villages)
              </h6>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-bold">Départ (PK Début)</label>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <input
                  className="form-control"
                  value={form.pk_debut}
                  onChange={(e) => updateField('pk_debut', e.target.value)}
                  placeholder="Ex : PK 0+000"
                />
              </div>
              <input
                className="form-control"
                value={form.localite_deb}
                onChange={(e) => updateField('localite_deb', e.target.value)}
                placeholder="Nom du village ou point de repère de début"
              />
              <small className="text-muted">Nom du village ou point de repère de début</small>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-bold">Arrivée (PK Fin)</label>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <input
                  className="form-control"
                  value={form.pk_fin}
                  onChange={(e) => updateField('pk_fin', e.target.value)}
                  placeholder="Ex : PK 45+000"
                />
              </div>
              <input
                className="form-control"
                value={form.localite_fin}
                onChange={(e) => updateField('localite_fin', e.target.value)}
                placeholder="Nom du village ou point de repère de fin"
              />
              <small className="text-muted">Nom du village ou point de repère de fin</small>
            </div>
          </div>

          <div className="row g-3" style={{ margin: 0 }}>
            <div className="col-12" style={{ padding: 0 }}>
              <h6 className="marche-section__title small fw-bold text-uppercase border-bottom pb-2 mb-3">
                3. Données Techniques et Budget
              </h6>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-bold">Région</label>
              <select className="form-select" value={form.region} onChange={(e) => updateField('region', e.target.value)}>
                <option value="">-- Sélectionner une région --</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-bold">Nature de la Surface</label>
              <select className="form-select" value={form.nature_surface} onChange={(e) => updateField('nature_surface', e.target.value)}>
                <option value="RB">RB (Revêtement Bitumineux)</option>
                <option value="RT">RT (Route en Terre)</option>
                <option value="BC">BC (Béton de Ciment)</option>
                <option value="PAVE">Pavé</option>
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-bold">Linéaire à traiter (km)</label>
              <input
                className="form-control"
                value={form.longueur_traite}
                onChange={(e) => updateField('longueur_traite', e.target.value)}
                placeholder="Ex : 12.5"
              />
              <small className="text-muted">Partie de la section concernée par les travaux</small>
            </div>

            <div className="col-md-6">
              <div className="p-3 border rounded" style={{ background: 'var(--panel-soft)', borderColor: 'var(--border)' }}>
                <label className="form-label fw-bold">Montant Minima (Ar)</label>
                <input
                  className="form-control"
                  type="number"
                  value={form.montant_minima}
                  onChange={(e) => updateField('montant_minima', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="col-md-6">
              <div className="p-3 border rounded" style={{ background: 'var(--panel-soft)', borderColor: 'var(--border)' }}>
                <label className="form-label fw-bold">Montant Souhaité (Ar)</label>
                <input
                  className="form-control"
                  type="number"
                  value={form.montant_souhaite}
                  onChange={(e) => updateField('montant_souhaite', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-between align-items-center border-top pt-4" style={{ gap: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
              <ArrowLeft size={16} weight="bold" aria-hidden="true" />
              Retour à la liste
            </button>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <SpinnerGap size={16} weight="bold" className="spin-icon" aria-hidden="true" />
                  Enregistrement en cours…
                </>
              ) : (
                <>
                  <CheckCircle size={16} weight="bold" aria-hidden="true" />
                  {isEditing ? 'Enregistrer les modifications' : 'Enregistrer la Convention'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ConventionProgrammeEditForm
