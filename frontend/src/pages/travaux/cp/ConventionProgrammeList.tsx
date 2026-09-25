import {
  CurrencyCircleDollar,
  FileText,
  Plus,
  RoadHorizon,
  Ruler,
  Wallet,
} from '@phosphor-icons/react'
import { ApiError } from '../../../api/client'
import { useEffect, useMemo, useState } from 'react'
import {
  createConventionProgramme,
  deleteConventionProgramme,
  fetchConventionProgramme,
  updateConventionProgramme,
} from '../../../api/travaux.api'
import type { ConventionProgrammeItem } from '../../../types/travaux'

import { ConventionProgrammeEditForm } from './ConventionProgrammeEditForm'
import { ConventionProgrammeRowActions } from './ConventionProgrammeRowActions'

const formatCurrency = (value: number) => `${Number(value).toLocaleString('fr-FR')} Ar`

function SummaryCardIcon({ Icon }: { Icon: typeof Wallet }) {
  return <Icon size={18} weight="regular" aria-hidden="true" />
}

export function ConventionProgrammeList() {
  const [items, setItems] = useState<ConventionProgrammeItem[]>([])
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('')
  const [surface, setSurface] = useState('')
  const [annee, setAnnee] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<ConventionProgrammeItem | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetchConventionProgramme()
      setItems(response ?? [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const availableRegions = useMemo(() => {
    const list = Array.from(new Set(items.map((i) => i.region).filter(Boolean)))
    return list.sort()
  }, [items])

  const availableSurfaces = useMemo(() => {
    const list = Array.from(new Set(items.map((i) => i.nature_surface).filter(Boolean)))
    return list.sort()
  }, [items])

  const availableYears = useMemo(() => {
    const list = Array.from(new Set(items.map((i) => i.annee).filter(Boolean)))
    const currentYear = new Date().getFullYear()
    if (!list.includes(currentYear)) list.push(currentYear)
    return list.sort((a, b) => Number(b) - Number(a))
  }, [items])

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = `${item.axe ?? ''} ${item.section ?? ''} ${item.region ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase())
      const matchesRegion = !region || item.region === region
      const matchesSurface = !surface || item.nature_surface === surface
      const matchesAnnee = !annee || String(item.annee ?? '') === String(annee)
      return matchesSearch && matchesRegion && matchesSurface && matchesAnnee
    })
  }, [annee, items, region, search, surface])

  const stats = useMemo(() => {
    const totalMinima = items.reduce((sum, item) => sum + (Number(item.montant_souhaite) || 0), 0)
    const totalSouhaite = items.reduce((sum, item) => sum + (Number(item.montant_souhaite) || 0), 0)
    const kmRb = items
      .filter((item) => item.nature_surface === 'RB')
      .reduce((sum, item) => sum + (Number(item.longueur) || 0), 0)
    const kmRt = items
      .filter((item) => item.nature_surface === 'RT')
      .reduce((sum, item) => sum + (Number(item.longueur) || 0), 0)
    const totalKm = items.reduce((sum, item) => sum + (Number(item.longueur) || 0), 0)

    return {
      totalMinima,
      totalSouhaite,
      kmRb,
      kmRt,
      totalKm,
      totalCount: items.length,
    }
  }, [items])

  const summaryCards = [
    { label: 'Minima', value: formatCurrency(stats.totalMinima), tone: 'primary', icon: Wallet },
    { label: 'Souhaité', value: formatCurrency(stats.totalSouhaite), tone: 'success', icon: CurrencyCircleDollar },
    { label: 'RB', value: `${stats.kmRb.toFixed(2)} km`, tone: 'primary', icon: RoadHorizon },
    { label: 'RT', value: `${stats.kmRt.toFixed(2)} km`, tone: 'warning', icon: RoadHorizon },
    { label: 'Total', value: `${stats.totalKm.toFixed(2)} km`, tone: 'info', icon: Ruler },
    { label: 'Conventions', value: String(stats.totalCount), tone: 'primary', icon: FileText },
  ]

  const handleOpenCreate = () => {
    setEditingItem(null)
    setShowForm(true)
  }

  const handleOpenEdit = (item: ConventionProgrammeItem) => {
    setEditingItem(item)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('Supprimer cette convention programme ?')
    if (!confirmed) return
    // Optimistic UI
    const prev = items
    setItems((current) => current.filter((item) => String(item.id) !== id))
    try {
      await deleteConventionProgramme(id)
    } catch {
      setItems(prev)
      alert('Erreur lors de la suppression. La liste a été restaurée.')
    }
  }

  const handleFormSubmit = async (values: Record<string, string | number>) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const payload: Partial<ConventionProgrammeItem> = {
        // `axe` backend expects the UUID of the axe; ensure the form provides it.
        axe: String(values.axe ?? ''),
        section: String(values.section ?? ''),
        region: String(values.region ?? ''),
        annee: Number(values.annee ?? new Date().getFullYear()),
        // pk_debut/pk_fin and longueur_traite are expected as numbers by the API/serializer
        pk_debut: Number(values.pk_debut ?? NaN),
        pk_fin: Number(values.pk_fin ?? NaN),
        longueur_traite: Number(values.longueur_traite ?? values.longueur ?? NaN),
        // also include `longueur` for backwards compatibility/display
        longueur: Number(values.longueur_traite ?? values.longueur ?? NaN),
        montant_souhaite: Number(values.montant_souhaite ?? 0),
        montant_minima: Number(values.montant_minima ?? 0),
        nature_surface: String(values.nature_surface ?? ''),
        localite_deb: String(values.localite_deb ?? ''),
        localite_fin: String(values.localite_fin ?? ''),
      }

      // Basic client-side validation to provide immediate feedback
      if (!payload.axe) {
        setSubmitError('Le champ Axe est obligatoire (choisir un axe dans la liste).')
        setSubmitting(false)
        return
      }

      if (!Number.isFinite(payload.pk_debut as number) || !Number.isFinite(payload.pk_fin as number)) {
        setSubmitError('PK début et PK fin doivent être des nombres valides.')
        setSubmitting(false)
        return
      }

      if (!Number.isFinite(payload.longueur as number)) {
        setSubmitError('La longueur à traiter doit être un nombre valide.')
        setSubmitting(false)
        return
      }

      if (editingItem) {
        const updated = await updateConventionProgramme(String(editingItem.id), payload)
        setItems((current) => current.map((item) => (item.id === editingItem.id ? updated : item)))
      } else {
        const created = await createConventionProgramme(payload)
        setItems((current) => [created, ...current])
      }

      setShowForm(false)
      setEditingItem(null)
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldParts = Object.entries(err.fields || {}).map(([k, v]) => `${k}: ${v.join('; ')}`)
        const msg = [err.message, ...fieldParts].filter(Boolean).join(' — ')
        setSubmitError(msg)
      } else {
        setSubmitError('Erreur lors de l’enregistrement. Vérifiez votre connexion et réessayez.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="travaux-page">
      <div className="page-header">
        <div>
          <p className="section-kicker">Travaux</p>
          <h1>Conventions programme</h1>
        </div>
      </div>

      {!showForm && (
        <>
          <div className="cp-summary-grid">
            {summaryCards.map((card) => (
              <article key={card.label} className={`summary-card summary-card--${card.tone}`}>
                <div className="summary-card__top">
                  <span className="summary-card__icon">
                    <SummaryCardIcon Icon={card.icon} />
                  </span>
                </div>
                <span className="summary-card__label">{card.label}</span>
                <strong>{card.value}</strong>
              </article>
            ))}
          </div>

          <div className="card shadow-sm border-0 mb-4 rounded-3">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-3" style={{ gap: 12 }}>
                <h5 className="mb-0 fw-bold" style={{ margin: 0 }}>Recherche</h5>
                <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>
                  <Plus size={16} weight="bold" aria-hidden="true" />
                  Nouvelle
                </button>
              </div>

              <form className="row g-2 align-items-end">
                <div className="col-md-4">
                  <div className="input-group">
                    <span className="input-group-text bg-white border-end-0">
                      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={{ display: 'block' }}>
                        <path d="M10.5 3a7.5 7.5 0 0 1 5.92 12.75l4.54 4.54 1.41-1.41-4.54-4.54A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" fill="currentColor"/>
                      </svg>
                    </span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Axe, tronçon, région..."
                      className="form-control border-start-0 ps-0"
                    />
                  </div>
                </div>

                <div className="col-md-2">
                  <select value={region} onChange={(event) => setRegion(event.target.value)} className="form-select">
                    <option value="">Toutes les régions</option>
                    {availableRegions.map((reg) => (
                      <option key={reg} value={reg}>{reg}</option>
                    ))}
                  </select>
                </div>

                <div className="col-md-2">
                  <select value={surface} onChange={(event) => setSurface(event.target.value)} className="form-select">
                    <option value="">Toutes surfaces</option>
                    {availableSurfaces.map((surf) => (
                      <option key={surf} value={surf}>{surf}</option>
                    ))}
                  </select>
                </div>

                <div className="col-md-2">
                  <select value={annee} onChange={(event) => setAnnee(event.target.value)} className="form-select">
                    <option value="">Toutes années</option>
                    {availableYears.map((year) => (
                      <option key={year} value={String(year)}>{year}</option>
                    ))}
                  </select>
                </div>

                <div className="col-md-2 d-flex gap-2">
                  <button type="button" className="btn btn-primary flex-grow-1">Filtrer</button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      setSearch('')
                      setRegion('')
                      setSurface('')
                      setAnnee('')
                    }}
                    title="Réinitialiser"
                  >
                    <span aria-hidden="true">↺</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {showForm && (
        <div
          className="marche-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: 40,
          }}
        >
          <div
            className="marche-modal-backdrop"
            onClick={() => setShowForm(false)}
            style={{ position: 'absolute', inset: 0, background: 'var(--scrim)' }}
          />
          <div
            className="marche-modal"
            style={{
              position: 'relative',
              width: 'min(980px, 96%)',
              maxHeight: '90vh',
              overflow: 'auto',
              zIndex: 61,
              background: 'var(--panel)',
              borderRadius: 18,
              boxShadow: '0 28px 54px rgba(15, 23, 42, 0.25)',
            }}
          >
            <div className="panel" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
              <div className="panel-header" style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
                <div className="panel-header__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={18} weight="fill" aria-hidden="true" />
                  <h5 style={{ margin: 0 }}>
                    {editingItem ? 'Modification de la Convention' : 'Nouvelle Convention Programme'}
                  </h5>
                </div>
                <button type="button" className="btn btn-ghost" onClick={() => {
                  setEditingItem(null)
                  setShowForm(false)
                }} aria-label="Fermer la fenêtre">
                  <span aria-hidden="true">×</span>
                </button>
              </div>

              {submitError && (
                <div style={{ padding: '0 18px 0', marginTop: 12, color: 'var(--danger)', fontWeight: 600, fontSize: '0.875rem' }}>
                  ⚠ {submitError}
                </div>
              )}

              <ConventionProgrammeEditForm
                initialData={editingItem ? (({ axe_detail: _, ...rest }) => rest)(editingItem) as Partial<ConventionProgrammeItem> & Record<string, string | number | undefined> : undefined}
                onSubmit={handleFormSubmit}
                submitting={submitting}
                onCancel={() => {
                  setEditingItem(null)
                  setShowForm(false)
                  setSubmitError(null)
                }}
              />
            </div>
          </div>
        </div>
      )}

      {!showForm && loading && <div className="loading-box">Chargement des conventions...</div>}

      {!showForm && !loading && (
        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Région</th>
                <th>Axe</th>
                <th>PK</th>
                <th className="text-center">KM</th>
                <th className="text-center">Surface</th>
                <th className="text-end">Minima</th>
                <th className="text-end">Souhaité</th>
                {true && <th className="text-end">Action</th>}
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>

                  <td>
                    <span className="badge bg-primary-soft">
                      {item.region ?? '—'}
                    </span>
                  </td>

                  <td>
                    <strong>{item.axe_detail?.designation ?? item.axe ?? '—'}</strong>
                    <br />
                    <small className="text-muted">{item.section ?? '—'}</small>
                  </td>

                  <td className="small">
                    <strong>{item.pk_debut ?? '—'}</strong>
                    <small>→ {item.pk_fin ?? '—'}</small>
                  </td>

                  <td className="text-center fw-bold">{item.longueur != null ? Number(item.longueur).toFixed(2) : '—'}</td>

                  <td className="text-center">
                    <span className={`badge ${item.nature_surface === 'RB' ? 'bg-dark' : 'bg-secondary'}`}>
                      {item.nature_surface ? (item.nature_surface === 'RB' ? 'RB' : item.nature_surface) : '—'}
                    </span>
                  </td>

                  <td className="text-end fw-bold">{item.montant_minima ? Number(item.montant_minima).toLocaleString('fr-FR') + ' Ar' : '—'}</td>

                  <td className="text-end fw-bold">{item.montant_souhaite ? Number(item.montant_souhaite).toLocaleString('fr-FR') + ' Ar' : '—'}</td>

                  <td className="text-end">
                    <ConventionProgrammeRowActions item={item} onEdit={handleOpenEdit} onDelete={handleDelete} />
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
