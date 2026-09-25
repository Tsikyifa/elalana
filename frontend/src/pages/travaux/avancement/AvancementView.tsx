import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarPlus,
  ChartBar,
  CheckCircle,
  Eye,
  MagnifyingGlass,
  PencilSimple,
  PlusSquare,
  SpinnerGap,
  WarningCircle,
} from '@phosphor-icons/react'
import { deleteMarche, fetchDashboardStats, fetchMarches } from '../../../api/travaux.api'
import type { DashboardStatsResponse, MarcheItem } from '../../../types/travaux'
import type { PpmRow } from '../ppm/types'
import { buildHash } from '../../../routes/hashRoute'
import AvancementModal from '../common/actions/AvancementModal'
import OsAvenantModal from '../common/actions/OsAvenantModal'
import EditMarcheModal from '../common/actions/EditMarcheModal'
import RowActions from '../common/RowActions'

function marcheToRow(m: MarcheItem): PpmRow {
  const av = m.dernier_avancement
  const pct = (v: number | string | undefined) => (v !== undefined && v !== null ? `${Number(v).toFixed(1)}%` : '0%')
  const situation = av?.situation_w_display ?? m.etape_actuelle_display ?? '—'
  return {
    id: String(m.id),
    objet: m.resume ?? m.description ?? '(Sans objet)',
    axe: m.axe_detail?.designation ?? m.axe ?? '—',
    region: m.region || 'Non renseigné',
    mdc: m.categorie ?? m.responsable ?? '—',
    titulaire: m.titulaire ?? '—',
    financement: m.financement_display ?? m.financement ?? '—',
    type_axe: m.axe_detail?.type_axe_display ?? m.axe_detail?.type_axe ?? '—',
    temporel: av ? pct(av.avancement_temporel) : '0%',
    physique: av ? pct(av.avancement_physique) : '0%',
    financier: av ? pct(av.avancement_financier) : '0%',
    situation,
    en_retard: av?.est_en_retard ?? false,
  }
}

type AvancementViewProps = {
  /** Ouvre le formulaire de création d'un marché. Le bouton vit dans l'en-tête du panneau Recherche. */
  onNewMarche?: () => void
}
export default function AvancementView({ onNewMarche }: AvancementViewProps) {
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null)
  const [marches, setMarches] = useState<MarcheItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [scopeFilter, setScopeFilter] = useState('all')
  const [viewType, setViewType] = useState<'axe' | 'region' | 'titulaire'>('axe')
  const [regionFilter, setRegionFilter] = useState('')
  const [axeFilter, setAxeFilter] = useState('')
  const [titulaireFilter, setTitulaireFilter] = useState('')
  const [financementFilter, setFinancementFilter] = useState('')
  const [typeAxeFilter, setTypeAxeFilter] = useState('')
  const [situationFilter, setSituationFilter] = useState('')
  const [retardFilter, setRetardFilter] = useState('')
  const [isEditMode, setIsEditMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('travaux-reporting-edit-mode') === 'true'
  })

  // Modals state
  const [selectedRow, setSelectedRow] = useState<PpmRow | null>(null)
  const [activeModal, setActiveModal] = useState<'detail' | 'avancement' | 'os' | 'edit' | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsData, marchesData] = await Promise.all([
        fetchDashboardStats(),
        fetchMarches(),
      ])
      setStats(statsData)
      setMarches(marchesData ?? [])
    } catch {
      // Keep existing or handle silently
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Listen for external create/update events and persist edit-mode
  useEffect(() => {
    const handler = () => loadData()
    if (typeof window !== 'undefined') {
      window.addEventListener('marche:created', handler)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('marche:created', handler)
      }
    }
  }, [loadData])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('travaux-reporting-edit-mode', String(isEditMode))
    }
  }, [isEditMode])

  // Build rows and grouping similar to PpmView
  const allRows: PpmRow[] = useMemo(() => marches.map(marcheToRow), [marches])

  // Options dynamiques pour les sélecteurs de filtre
  const axeOptions = useMemo(() => [...new Set(allRows.map((r) => r.axe).filter(Boolean))].sort(), [allRows])
  const regionOptions = useMemo(() => [...new Set(allRows.map((r) => r.region).filter(Boolean))].sort(), [allRows])
  const titulaireOptions = useMemo(() => [...new Set(allRows.map((r) => r.titulaire).filter(Boolean))].sort(), [allRows])
  const financementOptions = useMemo(() => [...new Set(allRows.map((r) => r.financement).filter(Boolean))].sort(), [allRows])
  const typeAxeOptions = useMemo(() => [...new Set(allRows.map((r) => r.type_axe).filter(Boolean))].sort(), [allRows])
  const situationOptions = useMemo(() => [...new Set(allRows.map((r) => r.situation).filter(Boolean))].sort(), [allRows])

  function groupByRows(rows: PpmRow[], key: keyof PpmRow) {
    const map = new Map<string, PpmRow[]>()
    for (const row of rows) {
      const k = String(row[key] ?? '—')
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(row)
    }
    return Array.from(map.entries()).map(([title, items]) => ({ title, items }))
  }

  const groupKey = viewType as keyof PpmRow
  const groups = useMemo(() => groupByRows(allRows, groupKey), [allRows, groupKey])

  const showAxeFilter = viewType === 'axe'
  const showRegionFilter = viewType === 'region'
  const showTitulaireFilter = viewType === 'titulaire'
  const showTypeAxeFilter = viewType === 'axe'

  const switchViewType = (nextView: 'axe' | 'region' | 'titulaire') => {
    setViewType(nextView)
    if (nextView === 'axe') {
      setRegionFilter('')
      setTitulaireFilter('')
      setTypeAxeFilter('')
    } else if (nextView === 'region') {
      setAxeFilter('')
      setTitulaireFilter('')
      setTypeAxeFilter('')
    } else {
      setAxeFilter('')
      setRegionFilter('')
      setTypeAxeFilter('')
    }
  }

  const filteredGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          items: group.items.filter((row) => {
            const q = query.trim().toLowerCase()
            const matchesQuery = !q || `${row.objet} ${row.titulaire} ${row.financement}`.toLowerCase().includes(q)
            const matchesScope =
              scopeFilter === 'all' ||
              (scopeFilter === 'active' && row.situation === 'En Cours') ||
              (scopeFilter === 'anticipe' && row.situation === 'En phase préparatoire') ||
              (scopeFilter === 'inactive' && (row.situation === 'Achevé' || row.situation === 'Résilié'))
            const matchesRegion = !regionFilter || row.region === regionFilter
            const matchesAxe = !axeFilter || row.axe === axeFilter
            const matchesTitulaire = !titulaireFilter || row.titulaire === titulaireFilter
            const matchesFin = !financementFilter || row.financement === financementFilter
            const matchesTypeAxe = !typeAxeFilter || row.type_axe === typeAxeFilter
            const matchesSituation = !situationFilter || row.situation === situationFilter
            const matchesRetard =
              !retardFilter ||
              (retardFilter === 'yes' ? row.en_retard === true : retardFilter === 'no' ? row.en_retard === false : true)
            return (
              matchesQuery &&
              matchesScope &&
              matchesRegion &&
              matchesAxe &&
              matchesTitulaire &&
              matchesFin &&
              matchesTypeAxe &&
              matchesSituation &&
              matchesRetard
            )
          }),
        }))
        .filter((group) => group.items.length > 0),
    [groups, query, scopeFilter, regionFilter, axeFilter, titulaireFilter, financementFilter, typeAxeFilter, situationFilter, retardFilter],
  )

  // grouping is handled by `groups` / `filteredGroups` below

  // ─── actions d'une ligne ───
  const openModal = (mode: 'os' | 'avancement' | 'edit' | 'detail', row: PpmRow) => {
    if (mode === 'detail') {
      window.location.hash = buildHash({ page: 'travaux', tab: null, detailId: row.id })
      return
    }

    setSelectedRow(row)
    setActiveModal(mode)
  }

  const handleDelete = async (row: PpmRow) => {
    const confirmed = window.confirm('Supprimer définitivement le marché sélectionné ?')
    if (!confirmed) return
    try {
      await deleteMarche(row.id)
      setMarches((prev) => prev.filter((m) => String(m.id) !== row.id))
    } catch {
      alert('Erreur lors de la suppression du marché.')
    }
  }

  const closeModal = (refresh = false) => {
    setActiveModal(null)
    setSelectedRow(null)
    if (refresh) loadData()
  }

  const summaryCards = [
    {
      label: 'Marchés actifs',
      value: String(marches.length),
      hint: 'Projets répertoriés',
      tone: 'primary',
      icon: ChartBar,
    },
    {
      label: 'Marchés en retard',
      value: stats ? String(stats.summary_cards.marches_en_retard) : '—',
      hint: 'Nécessitent une intervention',
      tone: 'danger',
      icon: WarningCircle,
    },
    {
      label: 'Marchés achevés',
      value: stats ? String(stats.summary_cards.marches_acheves) : '—',
      hint: 'Travaux réceptionnés',
      tone: 'success',
      icon: CheckCircle,
    },
  ]

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <SpinnerGap size={36} className="text-muted" />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ─── KPI Summary Cards ─── */}
      <div className="metrics-grid">
      {summaryCards.map(({ label, value, hint, tone, icon: Icon }) => (
          <article key={label} className={`summary-card summary-card--${tone}`}>
            <div className="summary-card__top">
              <span className="summary-card__icon">
                <Icon size={18} weight="regular" aria-hidden="true" />
              </span>
              <span className="summary-card__trend">{hint}</span>
            </div>
            <span className="summary-card__label">{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      {/* Récapitulatif par Source de Financement supprimé par demande */}

      {/* ─── Recherche Rapide (panneau identique au PPM) ─── */}
      <div className="panel ppm-search-panel" style={{ margin: 0 }}>
        <div className="panel-header">
          <h2>Recherche</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {onNewMarche && (
              <button type="button" className="btn btn-primary btn-sm" onClick={onNewMarche}>
                Nouveau marché
              </button>
            )}
            <button
              type="button"
              className={`mode-toggle ${isEditMode ? 'is-edit' : ''}`}
              onClick={() => setIsEditMode((prev) => !prev)}
              title={isEditMode ? 'Mode Vue' : 'Mode Édition'}
              aria-label={isEditMode ? 'Mode Vue' : 'Mode Édition'}
            >
              {isEditMode ? <Eye size={16} weight="fill" /> : <PencilSimple size={16} weight="fill" />}
            </button>
          </div>
        </div>

        {/* Regroupement de la liste, rattaché aux filtres Axe / Région / Titulaire qu'il pilote. */}
        <div className="travaux-tabs travaux-tabs--header" role="group" aria-label="Regroupement des marchés">
          <button
            type="button"
            className={`travaux-tab ${viewType === 'axe' ? 'is-active' : ''}`}
            aria-pressed={viewType === 'axe'}
            onClick={() => switchViewType('axe')}
          >
            Axe
          </button>
          <button
            type="button"
            className={`travaux-tab ${viewType === 'region' ? 'is-active' : ''}`}
            aria-pressed={viewType === 'region'}
            onClick={() => switchViewType('region')}
          >
            Région
          </button>
          <button
            type="button"
            className={`travaux-tab ${viewType === 'titulaire' ? 'is-active' : ''}`}
            aria-pressed={viewType === 'titulaire'}
            onClick={() => switchViewType('titulaire')}
          >
            Titulaire
          </button>
        </div>

        <div className="panel-body" style={{ padding: '14px 16px 12px' }}>
          <div className="row g-3 align-items-end">
            <div className="col-md-5">
              <label className="field-label" htmlFor="avancement-quick-search">
                Recherche Rapide
              </label>
              <div className="search-field">
                <span className="search-field__icon">
                  <MagnifyingGlass size={15} weight="bold" aria-hidden="true" />
                </span>
                <input
                  id="avancement-quick-search"
                  type="text"
                  placeholder="Objet, titulaire, numéro..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="col-md-2">
              <label className="form-label small fw-bold">Périmètre des marchés</label>
              <select className="form-select form-select-sm" value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}>
                <option value="all">TOUS</option>
                <option value="active">EN COURS</option>
                <option value="anticipe">ANTICIPÉ</option>
                <option value="inactive">NON ACTIFS</option>
              </select>
            </div>

            <div className="col-md-2 d-flex align-items-end">
              <button type="button" className="btn btn-ghost btn-sm w-100" onClick={() => loadData()} disabled={loading}>
                {loading ? <SpinnerGap size={14} className="spin" aria-hidden="true" /> : '↺'} Actualiser
              </button>
            </div>
          </div>

          <div className="row g-3 mt-1">
            {showAxeFilter && (
              <div className="col-md-2">
                <label className="form-label small fw-bold">Axe</label>
                <select className="form-select form-select-sm" value={axeFilter} onChange={(e) => setAxeFilter(e.target.value)}>
                  <option value="">Tout</option>
                  {axeOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}

            {showRegionFilter && (
              <div className="col-md-2">
                <label className="form-label small fw-bold">Région</label>
                <select className="form-select form-select-sm" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
                  <option value="">Tout</option>
                  {regionOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}

            {showTitulaireFilter && (
              <div className="col-md-2">
                <label className="form-label small fw-bold">Titulaire</label>
                <select className="form-select form-select-sm" value={titulaireFilter} onChange={(e) => setTitulaireFilter(e.target.value)}>
                  <option value="">Tout</option>
                  {titulaireOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}

            <div className="col-md-2">
              <label className="form-label small fw-bold">Financement</label>
              <select className="form-select form-select-sm" value={financementFilter} onChange={(e) => setFinancementFilter(e.target.value)}>
                <option value="">Tout</option>
                {financementOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            {showTypeAxeFilter && (
              <div className="col-md-2">
                <label className="form-label small fw-bold">Type d'axe</label>
                <select className="form-select form-select-sm" value={typeAxeFilter} onChange={(e) => setTypeAxeFilter(e.target.value)}>
                  <option value="">Tout</option>
                  {typeAxeOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}

            <div className="col-md-1">
              <label className="form-label small fw-bold">Situation</label>
              <select className="form-select form-select-sm" value={situationFilter} onChange={(e) => setSituationFilter(e.target.value)}>
                <option value="">Tout</option>
                {situationOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div className="col-md-1 d-flex flex-column justify-content-end">
              <label className="form-label small fw-bold">Retard</label>
              <div className="form-check form-switch d-flex align-items-center justify-content-center mt-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={retardFilter === 'yes'}
                  onChange={(e) => setRetardFilter(e.target.checked ? 'yes' : '')}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Liste Interactive des Marchés et de leur Avancement ─── */}
      <div className="panel" style={{ margin: 0 }}>
        <div className="panel-header" style={{ padding: '14px 18px' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.05rem' }}>État d'Avancement des Marchés</h4>
            <span className="small text-muted">{filteredGroups.reduce((s, g) => s + g.items.length, 0)} marché(s) affiché(s)</span>
          </div>
        </div>

          <div className="table-card" style={{ margin: 0, border: 'none' }}>
            {/* Ppm-like grouped rendering */}
            {filteredGroups.length === 0 ? (
              <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
                Aucun marché ne correspond aux filtres sélectionnés.
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.title} style={{ marginBottom: 18 }}>
                  <div className="district-header">
                    <span className="district-header__name">{group.title}</span>
                    <div className="district-header__actions">
                      <span className="district-header__count">{group.items.length}</span>
                    </div>
                  </div>

                  <div className="table-card">
                    <table className="table-fixed">
                      <thead>
                        <tr>
                          <th rowSpan={2} style={{ width: 40, textAlign: 'center' }}>#</th>
                          <th rowSpan={2}>Objet</th>
                          <th rowSpan={2} className="text-center">MDC</th>
                          <th rowSpan={2}>Titulaire</th>
                          <th rowSpan={2}>Financement</th>
                          <th colSpan={3} className="text-center">Avancement</th>
                          <th rowSpan={2}>Situation</th>
                          {isEditMode && (
                            <th rowSpan={2} className="text-center" style={{ width: 56 }}>Action</th>
                          )}
                        </tr>
                        <tr>
                          <th className="text-center small">Temporel</th>
                          <th className="text-center small">Physique</th>
                          <th className="text-center small">Financier</th>
                          {isEditMode && <th />}
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((row, idx) => (
                          <tr key={row.id} onClick={() => openModal('detail', row)} style={{ cursor: 'pointer' }}>
                            <td className="text-center fw-bold">{idx + 1}</td>
                            <td style={{ whiteSpace: 'normal' }}>{row.objet}</td>
                            <td className="text-center"><span className="badge">{row.mdc}</span></td>
                            <td>{row.titulaire}</td>
                            <td>{row.financement}</td>
                            <td style={{ textAlign: 'center' }}>{row.temporel}</td>
                            <td style={{ textAlign: 'center' }}>{row.physique}</td>
                            <td style={{ textAlign: 'center' }}>{row.financier}</td>
                            <td>{row.situation}</td>
                            {isEditMode && (
                              <td className="text-center">
                                <RowActions
                                  row={row}
                                  canDelete
                                  onOpen={openModal}
                                  onDelete={handleDelete}
                                />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
      </div>

      {/* ─── Modals ─── */}
      {activeModal && selectedRow && (
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
            onClick={() => closeModal()}
            style={{ position: 'absolute', inset: 0, background: 'var(--scrim)' }}
          />
          <div
            className="marche-modal"
            style={{
              position: 'relative',
              width: 'min(860px, 96%)',
              maxHeight: '90vh',
              overflow: 'auto',
              zIndex: 61,
              background: 'var(--panel)',
              borderRadius: 18,
              boxShadow: '0 28px 54px rgba(15, 23, 42, 0.25)',
            }}
          >
            <div className="panel" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
              <div
                className="panel-header"
                style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}
              >
                <div className="panel-header__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {activeModal === 'os' && <CalendarPlus size={18} weight="fill" />}
                  {activeModal === 'avancement' && <PlusSquare size={18} weight="fill" />}
                  {activeModal === 'edit' && <PencilSimple size={18} weight="fill" />}
                  <h5 style={{ margin: 0 }}>
                    {activeModal === 'os' && 'Ordre de service / Avenant'}
                    {activeModal === 'avancement' && "Relevé d'avancement"}
                    {activeModal === 'edit' && 'Modifier le marché'}
                  </h5>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => closeModal()}
                  aria-label="Fermer la fenêtre"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>

              {activeModal === 'os' && (
                <OsAvenantModal market={selectedRow} onClose={(r: boolean | undefined) => closeModal(r)} />
              )}
              {activeModal === 'avancement' && (
                <AvancementModal market={selectedRow} onClose={(r: boolean | undefined) => closeModal(r)} />
              )}
              {activeModal === 'edit' && (
                <EditMarcheModal market={selectedRow} onClose={(r: boolean | undefined) => closeModal(r)} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

