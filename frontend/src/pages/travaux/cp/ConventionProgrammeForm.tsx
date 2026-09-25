import { ArrowLeft, CheckCircle, FileText } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'

type ConventionProgrammeFormValues = {
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

type ConventionProgrammeFormProps = {
  initialData?: Record<string, string | number | undefined>
  onCancel: () => void
  onSubmit?: (values: Record<string, string | number>) => void
}

const emptyForm: ConventionProgrammeFormValues = {
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
  montant_minima: String(initialData?.montant_minima ?? '0'),
  montant_souhaite: String(initialData?.montant_souhaite ?? '0'),
})

export function ConventionProgrammeForm({ initialData, onCancel, onSubmit }: ConventionProgrammeFormProps) {
  const [form, setForm] = useState<ConventionProgrammeFormValues>(() => normalizeInitialData(initialData))

  useEffect(() => {
    setForm(normalizeInitialData(initialData))
  }, [initialData])

  const updateField = (field: keyof ConventionProgrammeFormValues, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const isEditing = Boolean(initialData && Object.keys(initialData).length > 0)

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="panel-header" style={{ background: 'var(--inverse-bg)', color: 'var(--on-primary)', borderRadius: '12px 12px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={20} weight="fill" aria-hidden="true" />
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {isEditing ? 'Modification de la Convention' : 'Nouvelle Convention Programme'}
          </h3>
        </div>
      </div>

      <div className="panel-body" style={{ padding: 24 }}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit?.(form)
            onCancel()
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
              <select className="form-select" value={form.axe} onChange={(e) => updateField('axe', e.target.value)}>
                <option value="">-- Choisir --</option>
                <option value="RN1">RN1</option>
                <option value="RN5">RN5</option>
                <option value="RN10">RN10</option>
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-bold">Section / Tronçon</label>
              <input
                className="form-control"
                value={form.section}
                onChange={(e) => updateField('section', e.target.value)}
                placeholder="Ex : Section A"
              />
            </div>

            <div className="col-md-3">
              <label className="form-label fw-bold">Année Budgétaire</label>
              <input
                className="form-control"
                type="number"
                value={form.annee}
                onChange={(e) => updateField('annee', e.target.value)}
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
                <option value="ANALAMANGA">Analamanga</option>
                <option value="HAUTE-MATSIATRA">Haute Matsiatra</option>
                <option value="DIANA">Diana</option>
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-bold">Nature de la Surface</label>
              <select className="form-select" value={form.nature_surface} onChange={(e) => updateField('nature_surface', e.target.value)}>
                <option value="RB">RB</option>
                <option value="RT">RT</option>
                <option value="BC">BC</option>
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-bold">Linéaire à traiter (km)</label>
              <input
                className="form-control"
                value={form.longueur_traite}
                onChange={(e) => updateField('longueur_traite', e.target.value)}
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
                />
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-between align-items-center border-top pt-4" style={{ gap: 16 }}>
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              <ArrowLeft size={16} weight="bold" aria-hidden="true" />
              Retour à la liste
            </button>

            <button type="submit" className="btn btn-primary">
              <CheckCircle size={16} weight="bold" aria-hidden="true" />
              {isEditing ? 'Enregistrer les modifications' : 'Enregistrer la Convention'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ConventionProgrammeForm
