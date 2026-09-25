import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowCounterClockwise,
  CheckCircle,
  CurrencyCircleDollar,
  Drop,
  Funnel,
  MagnifyingGlass,
  MapPin,
  Plus,
  Toolbox,
  WarningDiamond,
  XCircle,
} from '@phosphor-icons/react'
import { fetchBacs } from '../../../api/travaux.api'
import type { BacItem } from '../../../types/travaux'
import BacForm from './BacForm'
import { deleteBac } from '../../../api/travaux.api'
import BacRowActions from './BacRowActions'
import { ETAT_BAC_CHOICES, REGION_CHOICES } from './bacOptions'

const formatCurrency = (value?: number | string | null) => {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric)) return '0 Ar'
  return `${numeric.toLocaleString('fr-FR')} Ar`
}

/**
 * Formate un montant de façon compacte pour les petits espaces :
 * 60 000 000 → "60 M Ar" | 1 200 000 000 → "1,2 Md Ar" | 45 000 → "45 k Ar"
 */
const formatCompact = (value?: number | string | null) => {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return '0 Ar'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Md Ar`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M Ar`
  if (n >= 1_000)         return `${(n / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k Ar`
  return `${n.toLocaleString('fr-FR')} Ar`
}

function SummaryCardIcon({ Icon }: { Icon: typeof Drop }) {
  return <Icon size={18} weight="regular" aria-hidden="true" />
}

const getStatusClassName = (etat?: string) => {
  switch (etat) {
    case 'Operationel':
      return 'status-success'
    case 'En maintenance':
      return 'status-warning'
    case 'Fonctionnel_degrade':
    case 'degrade':
      return 'status-info'
    case 'Hors_usage':
      return 'status-danger'
    default:
      return 'status-default'
  }
}

export function BacList() {
  const [items, setItems] = useState<BacItem[]>([])
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('')
  const [etat, setEtat] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<BacItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')

    try {
      setItems(await fetchBacs())
    } catch {
      setItems([])
      setLoadError(
        'Impossible de charger les bacs. Vérifiez que le serveur est démarré et que vous êtes connecté.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const total = items.length
    const operationnel = items.filter((item) => item.etat_bac === 'Operationel').length
    const maintenance = items.filter((item) => item.etat_bac === 'En maintenance').length
    const degrade = items.filter((item) => item.etat_bac === 'Fonctionnel_degrade' || item.etat_bac === 'degrade').length
    const horsUsage = items.filter((item) => item.etat_bac === 'Hors_usage').length
    const besoinTotal = items.reduce((sum, item) => sum + Number(item.besoin_entretien_bac ?? 0), 0)

    return {
      total,
      operationnel,
      maintenance,
      degrade,
      horsUsage,
      besoinTotal,
    }
  }, [items])

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      const haystack = `${item.localite ?? ''} ${item.axe_detail?.designation ?? ''} ${item.region_display ?? item.region ?? ''} ${item.riviere ?? ''}`.toLowerCase()
      const matchesSearch = haystack.includes(search.toLowerCase())
      const matchesRegion = !region || item.region === region
      const matchesEtat = !etat || item.etat_bac === etat
      return matchesSearch && matchesRegion && matchesEtat
    })
  }, [etat, items, region, search])

  const bacSummaryCards = [
    {
      label: 'Total',
      value: String(stats.total),
      valueCompact: String(stats.total),
      tone: 'primary',
      icon: Drop,
      trend: stats.total > 0 ? `${stats.total} bacs` : 'Aucun',
      trendDirection: 'up' as const,
    },
    {
      label: 'Opérationnels',
      value: String(stats.operationnel),
      valueCompact: String(stats.operationnel),
      tone: 'success',
      icon: CheckCircle,
      trend: stats.total > 0 ? `${Math.round((stats.operationnel / stats.total) * 100)}%` : '—',
      trendDirection: (stats.operationnel > 0 ? 'up' : 'down') as 'up' | 'down',
    },
    {
      label: 'Maintenance',
      value: String(stats.maintenance),
      valueCompact: String(stats.maintenance),
      tone: 'warning',
      icon: Toolbox,
      trend: stats.maintenance > 0 ? 'À surveiller' : 'RAS',
      trendDirection: (stats.maintenance > 0 ? 'down' : 'up') as 'up' | 'down',
    },
    {
      label: 'Dégradés',
      value: String(stats.degrade),
      valueCompact: String(stats.degrade),
      tone: 'info',
      icon: WarningDiamond,
      trend: stats.degrade > 0 ? 'Intervention req.' : 'RAS',
      trendDirection: (stats.degrade > 0 ? 'down' : 'up') as 'up' | 'down',
    },
    {
      label: 'Hors Usage',
      value: String(stats.horsUsage),
      valueCompact: String(stats.horsUsage),
      tone: 'danger',
      icon: XCircle,
      trend: stats.horsUsage > 0 ? 'Hors service' : 'RAS',
      trendDirection: (stats.horsUsage > 0 ? 'down' : 'up') as 'up' | 'down',
    },
    {
      label: 'Besoin Global',
      value: formatCurrency(stats.besoinTotal),
      valueCompact: formatCompact(stats.besoinTotal),
      tone: 'primary',
      icon: CurrencyCircleDollar,
      trend: 'Entretien total',
      trendDirection: 'up' as const,
    },
  ]

  return (
    <section className="travaux-page">
      <div className="page-header">
        <div>
          <p className="section-kicker">Travaux</p>
          <h1>Suivi des bacs de traversée</h1>
        </div>
      </div>

      <div className="bac-summary-grid">
        {bacSummaryCards.map((card) => (
          <article key={card.label} className={`summary-card summary-card--${card.tone}`}>
            <div className="summary-card__top">
              <span className="summary-card__icon">
                <SummaryCardIcon Icon={card.icon} />
              </span>
            </div>
            <span className="summary-card__label">{card.label}</span>
            <strong className="summary-card__value">
              <span className="summary-card__value--full">{card.value}</span>
              {'valueCompact' in card && (
                <span className="summary-card__value--compact">{card.valueCompact}</span>
              )}
            </strong>
          </article>
        ))}
      </div>

      <div className="panel bac-filter-panel">
        <div className="panel-header">
          <div className="panel-header__title">
            <span className="panel-header__icon"><Funnel size={16} weight="fill" /></span>
            <h2>Filtres</h2>
          </div>
          <button
            type="button"
            className="btn btn-primary d-inline-flex align-items-center gap-2"
            onClick={() => { setEditingItem(null); setShowForm(true) }}
          >
            <Plus size={16} weight="bold" aria-hidden="true" />
            Nouveau bac
          </button>
        </div>

        <div className="toolbar bac-toolbar">
          <label className="bac-field bac-field--search">
            <span className="bac-field__icon"><MagnifyingGlass size={16} /></span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Localité, axe, rivière..."
            />
          </label>

          <select value={region} onChange={(event) => setRegion(event.target.value)} className="filter-select">
            <option value="">Toutes les régions</option>
            {REGION_CHOICES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select value={etat} onChange={(event) => setEtat(event.target.value)} className="filter-select">
            <option value="">Tous les états</option>
            {ETAT_BAC_CHOICES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn-secondary bac-reset-button"
            onClick={() => {
              setSearch('')
              setRegion('')
              setEtat('')
            }}
            aria-label="Réinitialiser les filtres"
          >
            <ArrowCounterClockwise size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-box">Chargement des bacs...</div>
      ) : loadError ? (
        <div className="table-card">
          <div className="empty-state py-5">
            <WarningDiamond size={28} />
            <span>{loadError}</span>
            <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={load}>
              Réessayer
            </button>
          </div>
        </div>
      ) : (
        <div className="table-card">
          <table className="bac-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>#</th>
                <th>Aperçu</th>
                <th>Localisation &amp; Axe</th>
                <th>Spécifications</th>
                <th>Année Entr.</th>
                <th>État Actuel</th>
                <th>Financement</th>
                <th style={{ width: 120 }} >Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item, index) => (
                <tr key={item.id}>
                  <td className="bac-row-index">{index + 1}</td>
                  <td>
                    <div className="bac-thumb">
                      {item.image ? (
                        <img className="bac-thumb__image" src={item.image} alt={`Bac de ${item.localite ?? 'traversée'}`} />
                      ) : (
                        <span className="bac-thumb__placeholder">
                          <Drop size={18} />
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="bac-cell__title">{item.localite ?? '—'}</div>
                    <div className="bac-cell__meta">
                      <span className="bac-tag">{item.axe_detail?.designation ?? '—'}</span>
                      <span>PK {item.pk_bac ?? '—'}</span>
                    </div>
                    <div className="bac-cell__location">
                      <MapPin size={12} />
                      {item.region_display ?? item.region ?? '—'}
                    </div>
                  </td>
                  <td>
                    <div className="bac-cell__spec">
                      <strong>{item.riviere ?? '—'}</strong>
                      <span>
                        {item.portance ? `${item.portance}T` : '—'} • {item.propulsion ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="bac-cell__year">{item.annee_entretien ?? '—'}</span>
                  </td>
                  <td>
                    <span className={`badge ${getStatusClassName(item.etat_bac)}`}>
                      {item.etat_bac_display ?? item.etat_bac ?? '—'}
                    </span>
                  </td>
                  <td>
                    <div className={`bac-finance ${item.etat_financement_bac === 'ACQUIS' ? 'is-acquis' : 'is-risk'}`}>
                      {formatCurrency(item.besoin_entretien_bac)}
                    </div>
                    <div className="bac-finance__status">{item.etat_financement_display ?? item.etat_financement_bac ?? '—'}</div>
                  </td>
                  <td>
                    <BacRowActions
                      item={item}
                      onEdit={(it) => { setEditingItem(it); setShowForm(true) }}
                      onDelete={async (id) => {
                        const ok = window.confirm('Supprimer ce bac ?')
                        if (!ok) return
                        try {
                          await deleteBac(id)
                          setItems((cur) => cur.filter((i) => i.id !== id))
                        } catch {
                          alert('Erreur lors de la suppression')
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}

              {visibleItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-5 text-muted">
                    <div className="empty-state">
                      <Drop size={28} />
                      <span>
                        {items.length === 0
                          ? 'Aucun bac enregistré pour le moment.'
                          : 'Aucun résultat trouvé pour votre recherche.'}
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <BacForm
          onClose={() => { setShowForm(false); setEditingItem(null) }}
          initialData={editingItem}
          onCreated={(created) => {
            setItems((current) => [created, ...current])
            setShowForm(false)
          }}
          onUpdated={(updated) => {
            setItems((current) => current.map((it) => (it.id === updated.id ? updated : it)))
            setShowForm(false)
            setEditingItem(null)
          }}
        />
      )}
    </section>
  )
}
