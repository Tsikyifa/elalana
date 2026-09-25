import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarPlus, Eye, GearSix, MagnifyingGlass, PencilSimple, PlusSquare, SpinnerGap } from '@phosphor-icons/react'
import type { PpmGroup, PpmRow } from './types'
import OsAvenantModal from '../common/actions/OsAvenantModal'
import AvancementModal from '../common/actions/AvancementModal'
import EditMarcheModal from '../common/actions/EditMarcheModal'
import AxeConfigModal from '../common/actions/AxeConfigModal'
import RowActions from '../common/RowActions'
import { deleteMarche, fetchMarches } from '../../../api/travaux.api'
import type { MarcheItem } from '../../../types/travaux'
import { buildHash } from '../../../routes/hashRoute'

/** Convertit un MarcheItem backend en PpmRow pour l'affichage. */
function marcheToRow(m: MarcheItem): PpmRow {
  const av = m.dernier_avancement
  const pct = (v: number | string | undefined) => (v !== undefined && v !== null ? `${Number(v).toFixed(2)}%` : '—')
  const situation = av?.situation_w_display ?? m.etape_actuelle_display ?? '—'
  return {
    id: String(m.id),
    objet: m.resume ?? m.description ?? '(Sans objet)',
    axe: m.axe_detail?.designation ?? m.axe ?? '—',
    region: '',
    mdc: m.categorie ?? m.responsable ?? '—',
    titulaire: m.titulaire ?? '—',
    financement: m.financement_display ?? m.financement ?? '—',
    type_axe: m.axe_detail?.type_axe_display ?? m.axe_detail?.type_axe ?? '—',
    temporel: av ? pct(av.avancement_temporel) : '—',
    physique: av ? pct(av.avancement_physique) : '—',
    financier: av ? pct(av.avancement_financier) : '—',
    situation,
    en_retard: av?.est_en_retard ?? false,
  }
}

/** Regroupe une liste de PpmRow par un critère. */
function groupBy(rows: PpmRow[], key: keyof PpmRow): PpmGroup[] {
  const map = new Map<string, PpmRow[]>()
  for (const row of rows) {
    const k = String(row[key] ?? '—')
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(row)
  }
  return Array.from(map.entries()).map(([title, items]) => ({ title, items }))
}

export function PpmView() {
  const [query, setQuery] = useState('')
  const [scopeFilter, setScopeFilter] = useState('all')
  const [viewType, setViewType] = useState('axe')
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

  // ─── données backend ──────────────────────────────────────────────────────
  const [marches, setMarches] = useState<MarcheItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMarches = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchMarches()
      setMarches(data ?? [])
    } catch (err) {
      console.error('Erreur chargement marchés :', err)
      setError('Impossible de charger les marchés. Vérifiez votre connexion au serveur.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadMarches() }, [loadMarches])

  // Écoute d'un événement global pour rafraîchir la liste après création/édition
  useEffect(() => {
    const handler = () => loadMarches()
    window.addEventListener('marche:created', handler)
    return () => window.removeEventListener('marche:created', handler)
  }, [loadMarches])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('travaux-reporting-edit-mode', String(isEditMode))
    }
  }, [isEditMode])

  // ─── transformation et regroupement ──────────────────────────────────────
  const allRows: PpmRow[] = useMemo(() => marches.map(marcheToRow), [marches])

  const groupKey = viewType === 'titulaire' ? 'titulaire' : viewType === 'region' ? 'region' : 'axe'
  const groups: PpmGroup[] = useMemo(() => groupBy(allRows, groupKey as keyof PpmRow), [allRows, groupKey])

  // Options dynamiques pour les sélecteurs de filtre
  const axeOptions = useMemo(() => [...new Set(allRows.map((r) => r.axe).filter(Boolean))].sort(), [allRows])
  const regionOptions = useMemo(() => [...new Set(allRows.map((r) => r.region).filter(Boolean))].sort(), [allRows])
  const titulaireOptions = useMemo(() => [...new Set(allRows.map((r) => r.titulaire).filter(Boolean))].sort(), [allRows])
  const financementOptions = useMemo(() => [...new Set(allRows.map((r) => r.financement).filter(Boolean))].sort(), [allRows])
  const typeAxeOptions = useMemo(() => [...new Set(allRows.map((r) => r.type_axe).filter(Boolean))].sort(), [allRows])
  const situationOptions = useMemo(() => [...new Set(allRows.map((r) => r.situation).filter(Boolean))].sort(), [allRows])

  // ─── filtrage ─────────────────────────────────────────────────────────────
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

  // ─── actions modales ──────────────────────────────────────────────────────
  const [activeModal, setActiveModal] = useState<'os' | 'avancement' | 'edit' | 'detail' | 'axe-config' | null>(null)
  const [selectedMarket, setSelectedMarket] = useState<PpmRow | null>(null)
  const [selectedAxe, setSelectedAxe] = useState<string | null>(null)
  const isDgtpAdmin = true

  const handleDelete = async (rowId: string) => {
    const confirmed = window.confirm('Supprimer définitivement le marché sélectionné ?')
    if (!confirmed) return
    try {
      await deleteMarche(rowId)
      setMarches((prev) => prev.filter((m) => String(m.id) !== rowId))
    } catch {
      alert('Erreur lors de la suppression du marché.')
    }
  }

  const openModal = (mode: 'os' | 'avancement' | 'edit' | 'detail', row: PpmRow) => {
    if (mode === 'detail') {
      window.location.hash = buildHash({ page: 'travaux', tab: null, detailId: row.id })
      return
    }

    setSelectedMarket(row)
    setActiveModal(mode)
  }

  const openAxeConfig = (axeName: string) => {
    setSelectedAxe(axeName)
    setActiveModal('axe-config')
  }

  const closeModal = (refresh = false) => {
    setActiveModal(null)
    setSelectedMarket(null)
    setSelectedAxe(null)
    if (refresh) loadMarches()
  }

  // ─── rendu ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="panel ppm-search-panel" style={{ marginBottom: 14 }}>
        <div className="panel-header">
          <h2>Recherche</h2>
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

        <div className="panel-body" style={{ padding: '14px 16px 12px' }}>
          <div className="row g-3 align-items-end">
            <div className="col-md-5">
              <label className="field-label" htmlFor="ppm-quick-search">
                Recherche Rapide
              </label>
              <div className="search-field">
                <span className="search-field__icon">
                  <MagnifyingGlass size={15} weight="bold" aria-hidden="true" />
                </span>
                <input
                  id="ppm-quick-search"
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

            <div className="col-md-3">
              <label className="form-label small fw-bold">Mode d'Affichage</label>
              <select className="form-select form-select-sm" value={viewType} onChange={(e) => setViewType(e.target.value)}>
                <option value="axe">AXE</option>
                <option value="region">RÉGION</option>
                <option value="titulaire">TITULAIRES</option>
              </select>
            </div>

            <div className="col-md-2 d-flex align-items-end">
              <button type="button" className="btn btn-ghost btn-sm w-100" onClick={() => loadMarches()} disabled={loading}>
                {loading ? <SpinnerGap size={14} className="spin" aria-hidden="true" /> : '↺'} Actualiser
              </button>
            </div>
          </div>

          <div className="row g-3 mt-1">
            <div className="col-md-2">
              <label className="form-label small fw-bold">Axe</label>
              <select className="form-select form-select-sm" value={axeFilter} onChange={(e) => setAxeFilter(e.target.value)}>
                <option value="">Tout</option>
                {axeOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label small fw-bold">Région</label>
              <select className="form-select form-select-sm" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
                <option value="">Tout</option>
                {regionOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label small fw-bold">Titulaire</label>
              <select className="form-select form-select-sm" value={titulaireFilter} onChange={(e) => setTitulaireFilter(e.target.value)}>
                <option value="">Tout</option>
                {titulaireOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label small fw-bold">Financement</label>
              <select className="form-select form-select-sm" value={financementFilter} onChange={(e) => setFinancementFilter(e.target.value)}>
                <option value="">Tout</option>
                {financementOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label small fw-bold">Type d'axe</label>
              <select className="form-select form-select-sm" value={typeAxeFilter} onChange={(e) => setTypeAxeFilter(e.target.value)}>
                <option value="">Tout</option>
                {typeAxeOptions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

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

      {/* État chargement / erreur */}
      {loading && (
        <div className="empty-state" style={{ textAlign: 'center', padding: 40 }}>
          <SpinnerGap size={28} className="spin" aria-hidden="true" />
          <p style={{ marginTop: 12 }}>Chargement des marchés…</p>
        </div>
      )}

      {!loading && error && (
        <div className="panel" style={{ padding: 20, textAlign: 'center', color: 'var(--danger)' }}>
          <p>{error}</p>
          <button type="button" className="btn btn-ghost" onClick={() => loadMarches()}>Réessayer</button>
        </div>
      )}

      {!loading && !error && filteredGroups.length === 0 && (
        <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
          Aucun marché ne correspond aux filtres sélectionnés.
        </div>
      )}

      {!loading && !error && filteredGroups.map((group) => (
        <div key={group.title} style={{ marginBottom: 18 }}>
          <div className="district-header">
            <span className="district-header__name">{group.title}</span>

            <div className="district-header__actions">
              {isDgtpAdmin && (
                <button
                  type="button"
                  className="district-header__action"
                  title="Configurer l'axe"
                  aria-label={`Configurer l'axe ${group.title}`}
                  onClick={() => openAxeConfig(group.title)}
                >
                  <GearSix size={15} weight="bold" aria-hidden="true" />
                  <span>Configurer</span>
                </button>
              )}
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
                    <td className="text-center">
                      <span className="badge">{row.mdc}</span>
                    </td>
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
                          canDelete={isDgtpAdmin}
                          onOpen={openModal}
                          onDelete={(target) => handleDelete(target.id)}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {activeModal && (selectedMarket || selectedAxe) && (
        <div className="marche-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 40 }}>
          <div className="marche-modal-backdrop" onClick={() => closeModal()} style={{ position: 'absolute', inset: 0, background: 'var(--scrim)' }} />
          <div className="marche-modal" style={{ position: 'relative', width: 'min(860px, 96%)', maxHeight: '90vh', overflow: 'auto', zIndex: 61, background: 'var(--panel)', borderRadius: 18, boxShadow: '0 28px 54px rgba(15, 23, 42, 0.25)' }}>
            <div className="panel" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
              <div className="panel-header" style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
                <div className="panel-header__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {activeModal === 'os' && <CalendarPlus size={18} weight="fill" />}
                  {activeModal === 'avancement' && <PlusSquare size={18} weight="fill" />}
                  {activeModal === 'edit' && <PencilSimple size={18} weight="fill" />}
                  {activeModal === 'detail' && <Eye size={18} weight="fill" />}
                  {activeModal === 'axe-config' && <GearSix size={18} weight="fill" />}
                  <h5 style={{ margin: 0 }}>
                    {activeModal === 'os' && 'Ordre de service / Avenant'}
                    {activeModal === 'avancement' && "Relevé d'avancement"}
                    {activeModal === 'edit' && 'Modifier le marché'}
                    {activeModal === 'detail' && 'Détail du marché'}
                    {activeModal === 'axe-config' && "Configuration de l'axe"}
                  </h5>
                </div>
                <button type="button" className="btn btn-ghost" onClick={() => closeModal()} aria-label="Fermer la fenêtre">
                  <span aria-hidden="true">×</span>
                </button>
              </div>

              {activeModal === 'os' && selectedMarket && <OsAvenantModal market={selectedMarket} onClose={(r: boolean | undefined) => closeModal(r)} />}
              {activeModal === 'avancement' && selectedMarket && <AvancementModal market={selectedMarket} onClose={(r: boolean | undefined) => closeModal(r)} />}
              {activeModal === 'edit' && selectedMarket && <EditMarcheModal market={selectedMarket} onClose={(r: boolean | undefined) => closeModal(r)} />}
              {activeModal === 'detail' && selectedMarket && null}
              {activeModal === 'axe-config' && selectedAxe && <AxeConfigModal axeName={selectedAxe} onClose={() => closeModal()} />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

