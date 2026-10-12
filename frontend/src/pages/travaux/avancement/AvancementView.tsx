import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowsOut,
  CalendarBlank,
  CalendarPlus,
  ChartBar,
  ChatText,
  CheckCircle,
  Eye,
  FileText,
  MagnifyingGlass,
  NotePencil,
  Paperclip,
  PencilSimple,
  PlusSquare,
  SpinnerGap,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import {
  createAvancement,
  deleteMarche,
  fetchDashboardStats,
  fetchMarches,
  fetchAxes,
  updateAvancement,
} from '../../../api/travaux.api'
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
    pk_debut: (m as any).pk_debut ?? null,
    pk_fin: (m as any).pk_fin ?? null,
  }
}

type AvancementViewProps = {
  /** Ouvre le formulaire de création d'un marché. Le bouton vit dans l'en-tête du panneau Recherche. */
  onNewMarche?: () => void
  canCreateMarche?: boolean
  canManageProgress?: boolean
}
export default function AvancementView({ onNewMarche, canCreateMarche = true, canManageProgress = true }: AvancementViewProps) {
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null)
  const [marches, setMarches] = useState<MarcheItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [scopeFilter, setScopeFilter] = useState('all')
  const [viewType, setViewType] = useState<'axe' | 'region' | 'titulaire'>('axe')
  const [regionFilter, setRegionFilter] = useState('')
  const [axeFilter, setAxeFilter] = useState('')
  const [decoupageFilter, setDecoupageFilter] = useState<'' | 'avec' | 'sans'>('')
  const [axesAvecDecoupage, setAxesAvecDecoupage] = useState<string[]>([])
  const [axisSegmentsMap, setAxisSegmentsMap] = useState<Record<string, Array<{pk_debut: number; pk_fin: number; deb?: string; fin?: string}>>>({})
  const [titulaireFilter, setTitulaireFilter] = useState('')
  const [financementFilter, setFinancementFilter] = useState('')
  const [typeAxeFilter, setTypeAxeFilter] = useState('')
  const [situationFilter, setSituationFilter] = useState('')
  const [retardFilter, setRetardFilter] = useState('')
  const [isEditMode, setIsEditMode] = useState(false)

  // Modals state
  const [selectedRow, setSelectedRow] = useState<PpmRow | null>(null)
  const [activeModal, setActiveModal] = useState<'detail' | 'avancement' | 'os' | 'edit' | null>(null)
  const [quickSavingIds, setQuickSavingIds] = useState<Record<string, boolean>>({})
  const [draftProgress, setDraftProgress] = useState<Record<string, { physique: number | ''; financier: number | '' }>>({})
  const [draftDate, setDraftDate] = useState<Record<string, string>>({})
  const [draftDetailSituation, setDraftDetailSituation] = useState<Record<string, string>>({})
  const [draftObservation, setDraftObservation] = useState<Record<string, string>>({})
  const [draftFiles, setDraftFiles] = useState<Record<string, File[]>>({})
  const [expandedTextModal, setExpandedTextModal] = useState<{
    row: PpmRow
    field: 'detail' | 'obs'
    title: string
    value: string
  } | null>(null)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    index: 52,
    objet: 180,
    pk: 150,
    date: 130,
    mdc: 110,
    titulaire: 170,
    financement: 130,
    temporel: 120,
    observation: 320,
    physique: 110,
    financier: 110,
    piecesJointes: 170,
    action: 150,
    situation: 120,
  })
  const activeResizeRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null)

  const beginColumnResize = useCallback((key: string, event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    activeResizeRef.current = {
      key,
      startX: event.clientX,
      startWidth: columnWidths[key] ?? 120,
    }
  }, [columnWidths])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!activeResizeRef.current) return
      const { key, startX, startWidth } = activeResizeRef.current
      const delta = event.clientX - startX
      const nextWidth = Math.max(80, startWidth + delta)
      setColumnWidths((prev) => ({ ...prev, [key]: nextWidth }))
    }

    const handleMouseUp = () => {
      activeResizeRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const resizeHandle = (key: string) => (
    <div
      onMouseDown={(event) => beginColumnResize(key, event)}
      style={{
        position: 'absolute',
        top: 0,
        right: -4,
        width: 10,
        height: '100%',
        cursor: 'col-resize',
        zIndex: 2,
        background: 'transparent',
      }}
    />
  )

  const isProgressOnlyManager = !canCreateMarche && canManageProgress
  const allowInlineProgressEdit = isEditMode && canManageProgress
  const showTemporalColumn = !isProgressOnlyManager || !isEditMode

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (isProgressOnlyManager || !canManageProgress) {
      setIsEditMode(false)
      window.localStorage.setItem('travaux-reporting-edit-mode', 'false')
      return
    }

    const saved = window.localStorage.getItem('travaux-reporting-edit-mode') === 'true'
    setIsEditMode(saved)
  }, [isProgressOnlyManager, canManageProgress])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const results = await Promise.allSettled([fetchDashboardStats(), fetchMarches()])

      const statsRes = results[0]
      const marchesRes = results[1]

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value)
      }

      if (marchesRes.status === 'fulfilled') {
        setMarches(marchesRes.value ?? [])
      }

      // Show alert only if both calls failed
      if (statsRes.status === 'rejected' && marchesRes.status === 'rejected') {
        alert('Erreur lors du chargement des données. Veuillez réessayer.')
      }
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
      window.addEventListener('avancement:deleted', handler)
      window.addEventListener('avancement:created', handler)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('marche:created', handler)
        window.removeEventListener('avancement:deleted', handler)
        window.removeEventListener('avancement:created', handler)
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

  const normalizeAxeName = (value?: string | null) => (value ?? '').trim().toLowerCase()
  const axesAvecDecoupageSet = useMemo(
    () => new Set(axesAvecDecoupage.map((v) => normalizeAxeName(v)).filter(Boolean)),
    [axesAvecDecoupage],
  )

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
      // keep decoupage when switching to axe
    } else if (nextView === 'region') {
      setAxeFilter('')
      setTitulaireFilter('')
      setTypeAxeFilter('')
      setDecoupageFilter('')
    } else {
      setAxeFilter('')
      setRegionFilter('')
      setTypeAxeFilter('')
      setDecoupageFilter('')
    }
  }

  // Charger la liste des axes qui ont un découpage PK (backend filter decoupage=avec)
  useEffect(() => {
    let mounted = true
    fetchAxes('avec')
      .then((data) => {
        if (!mounted || !data) return
        const list = data.map((a) => (a.designation ? a.designation : (a as any).designation)).filter(Boolean) as string[]
        setAxesAvecDecoupage(list)
        // build segments map (backend may return different field names)
        const map: Record<string, Array<{pk_debut: number; pk_fin: number; deb?: string; fin?: string}>> = {}
        for (const a of data) {
          const name = (a as any).designation
          const segs = (a as any).segments_districts || (a as any).segments || (a as any).segments_district || []
          if (Array.isArray(segs) && segs.length) {
            map[name] = segs.map((s: any) => ({ pk_debut: Number(s.pk_debut ?? s.pk_debut_raw ?? 0), pk_fin: Number(s.pk_fin ?? s.pk_fin_raw ?? 0), deb: s.deb || s.localite_deb || s.start || s.from, fin: s.fin || s.localite_fin || s.end || s.to }))
          }
        }
        setAxisSegmentsMap(map)
      })
      .catch(() => {
        if (mounted) setAxesAvecDecoupage([])
      })
    return () => {
      mounted = false
    }
  }, [])

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
            const axeName = normalizeAxeName(row.axe)
            const axeDetailName = normalizeAxeName((row as any)?.axe_detail?.designation)
            const matchesDecoupage =
              !decoupageFilter ||
              (decoupageFilter === 'avec' && (axesAvecDecoupageSet.has(axeName) || axesAvecDecoupageSet.has(axeDetailName))) ||
              (decoupageFilter === 'sans' && !axesAvecDecoupageSet.has(axeName) && !axesAvecDecoupageSet.has(axeDetailName))
            return (
              matchesQuery &&
              matchesScope &&
              matchesRegion &&
              matchesAxe &&
              matchesTitulaire &&
              matchesFin &&
              matchesTypeAxe &&
              matchesSituation &&
              matchesRetard &&
              matchesDecoupage
            )
          }),
        }))
        .filter((group) => group.items.length > 0),
    [groups, query, scopeFilter, regionFilter, axeFilter, titulaireFilter, financementFilter, typeAxeFilter, situationFilter, retardFilter, decoupageFilter, axesAvecDecoupageSet],
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

  const handleInlineProgressSave = useCallback(async (row: PpmRow, nextPhysique: number, nextFinancier: number) => {
    const market = marches.find((m) => String(m.id) === row.id)
    if (!market) return

    const latest = market.dernier_avancement
    // Use dernier_avancement for detecting existing records — the list API
    // (/travaux/marches/) does NOT populate `avancements`, so
    // `market.avancements?.[0]` was always undefined, causing a new
    // avancement to be created every time instead of updating the existing one.
    const existing = (market.avancements?.[0]) ?? (latest?.id ? latest as any : undefined)
    const selectedDetailSituation = draftDetailSituation[row.id] ?? (latest?.detail_situation ?? '')
    const selectedObservation = draftObservation[row.id] ?? (latest?.observation ?? '')
    const selectedDate = draftDate[row.id] || latest?.date_avancement || new Date().toISOString().slice(0, 10)
    const selectedFiles = draftFiles[row.id] ?? []
    const payload = {
      marche: market.id,
      date_avancement: selectedDate,
      avancement_physique: Number.isFinite(nextPhysique) ? nextPhysique : Number(latest?.avancement_physique ?? 0),
      avancement_financier: Number.isFinite(nextFinancier) ? nextFinancier : Number(latest?.avancement_financier ?? 0),
      situation_w: (latest?.situation_w ?? 'En_cours') as 'En_cours' | 'Arrete' | 'Acheve' | 'Résilié',
      detail_situation: selectedDetailSituation,
      observation: selectedObservation,
    }

    setQuickSavingIds((prev) => ({ ...prev, [row.id]: true }))
    try {
      if (existing?.id) {
        await updateAvancement(existing.id, payload)
      } else {
        const file = selectedFiles[0] ?? null
        const legend = file ? 'Pièce jointe du relevé' : undefined
        await createAvancement(payload, file, legend, selectedFiles)
      }
      await loadData()
      setDraftProgress((prev) => {
        const next = { ...prev }
        delete next[row.id]
        return next
      })
      setDraftDate((prev) => {
        const next = { ...prev }
        delete next[row.id]
        return next
      })
      setDraftDetailSituation((prev) => {
        const next = { ...prev }
        delete next[row.id]
        return next
      })
      setDraftObservation((prev) => {
        const next = { ...prev }
        delete next[row.id]
        return next
      })
      setDraftFiles((prev) => {
        const next = { ...prev }
        delete next[row.id]
        return next
      })
      if (isProgressOnlyManager) {
        setIsEditMode(false)
      }
    } catch {
      alert('Erreur lors de l\'enregistrement du relevé d\'avancement.')
    } finally {
      setQuickSavingIds((prev) => ({ ...prev, [row.id]: false }))
    }
  }, [marches, draftDate, draftDetailSituation, draftObservation, draftFiles, loadData, isProgressOnlyManager])

  const handleProgressValidation = async (row: PpmRow) => {
    const draft = draftProgress[row.id] ?? {
      physique: Number.parseFloat(row.physique.replace('%', '')) || 0,
      financier: Number.parseFloat(row.financier.replace('%', '')) || 0,
    }
    const physique = draft.physique === '' ? 0 : Number(draft.physique)
    const financier = draft.financier === '' ? 0 : Number(draft.financier)
    await handleInlineProgressSave(row, physique, financier)
  }

  const handleCancelProgressMode = () => {
    setIsEditMode(false)
    setDraftProgress({})
    setDraftDate({})
    setDraftDetailSituation({})
    setDraftObservation({})
    setDraftFiles({})
    setExpandedTextModal(null)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('travaux-reporting-edit-mode', 'false')
    }
  }

  const handleDelete = async (row: PpmRow) => {
    const confirmed = window.confirm('Supprimer définitivement le marché sélectionné ?')
    if (!confirmed) return
    try {
      await deleteMarche(row.id)
      setMarches((prev) => prev.filter((m) => String(m.id) !== row.id))
      await loadData()
      window.dispatchEvent(new CustomEvent('marche:deleted'))
      window.dispatchEvent(new CustomEvent('marche:created'))
    } catch (error: any) {
      if (error?.status === 404) {
        setMarches((prev) => prev.filter((m) => String(m.id) !== row.id))
        await loadData()
        window.dispatchEvent(new CustomEvent('marche:deleted'))
        window.dispatchEvent(new CustomEvent('marche:created'))
        return
      }
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
      kind: 'metric',
    },
    {
      label: 'Marchés en retard',
      value: stats ? String(stats.summary_cards.marches_en_retard) : '—',
      hint: 'Nécessitent une intervention',
      tone: 'danger',
      icon: WarningCircle,
      kind: 'metric',
    },
    {
      label: 'Travaux réceptionnés',
      value: stats ? String(stats.summary_cards.marches_acheves) : '—',
      hint: 'Travaux réceptionnés',
      tone: 'success',
      icon: CheckCircle,
      kind: 'metric',
    },
    {
      label: 'Nouveau marché',
      value: '',
      hint: 'Action rapide',
      tone: 'info',
      icon: PlusSquare,
      kind: 'action',
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
      <div className="avancement-summary-grid">
      {summaryCards.map(({ label, value, hint, tone, icon: Icon, kind }) => {
          const isAction = kind === 'action'
          if (isAction && !canCreateMarche) return null
          return (
            <article key={label} className={`summary-card summary-card--${tone} ${isAction ? 'summary-card--action' : ''}`}>
              {isAction ? (
                <button
                  type="button"
                  className="summary-card__action-button"
                  onClick={onNewMarche}
                  aria-label={label}
                >
                  <span className="summary-card__action-plus" aria-hidden="true">+</span>
                  <span className="summary-card__label summary-card__label--muted">{label}</span>
                </button>
              ) : (
                <>
                  <div className="summary-card__top">
                    <span className="summary-card__icon">
                      <Icon size={18} weight="regular" aria-hidden="true" />
                    </span>
                    <span className="summary-card__trend">{hint}</span>
                  </div>
                  <span className="summary-card__label">{label}</span>
                  <strong>{value}</strong>
                </>
              )}
            </article>
          )
        })}
      </div>

      {/* Récapitulatif par Source de Financement supprimé par demande */}

      {/* ─── Recherche Rapide (panneau identique au PPM) ─── */}
      <div className="panel ppm-search-panel" style={{ margin: 0 }}>
        <div className="panel-header">
          <h2>Recherche</h2>
          <div className="avancement-search-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {canCreateMarche && onNewMarche && (
              <button type="button" className="btn btn-primary btn-sm avancement-search-new" onClick={onNewMarche}>
                Nouveau marché
              </button>
            )}
            {!isProgressOnlyManager && canManageProgress && (
              <button
                type="button"
                className={`mode-toggle ${isEditMode ? 'is-edit' : ''}`}
                onClick={() => setIsEditMode((prev) => !prev)}
                title={isEditMode ? 'Mode Vue' : 'Mode Édition'}
                aria-label={isEditMode ? 'Mode Vue' : 'Mode Édition'}
              >
                {isEditMode ? <Eye size={16} weight="fill" /> : <PencilSimple size={16} weight="fill" />}
              </button>
            )}
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

            {showAxeFilter && (
              <div className="col-md-2">
                <label className="form-label small fw-bold">Découpage PK</label>
                <div className="d-flex align-items-center gap-2 mt-1">
                  <div className="form-check form-switch mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={decoupageFilter === 'avec'}
                      onChange={(e) => setDecoupageFilter(e.target.checked ? 'avec' : '')}
                    />
                  </div>
                  <span className="small text-muted">{decoupageFilter === 'avec' ? 'Actif' : 'Off'}</span>
                </div>
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
                    <div className="district-header__actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {isProgressOnlyManager && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setIsEditMode(true)}
                      >
                        Nouveau relevé d'avancement
                      </button>
                    )}
                    <span className="district-header__count">{group.items.length}</span>
                  </div>
                </div>
                  {/* per-axis découpage header removed; PK shown in main table below */}

                  {/* per-market PK sub-table removed; PK column moved into main table */}

                  <div className="table-card">
                    <table className="table-fixed">
                      {isProgressOnlyManager && isEditMode ? (
                        <>
                          <thead>
                            <tr>
                              <th rowSpan={2} style={{ width: columnWidths.index ?? 52, minWidth: 52, textAlign: 'center', position: 'relative' }}>
                                #
                                {resizeHandle('index')}
                              </th>
                              <th rowSpan={2} style={{ width: columnWidths.objet ?? 180, minWidth: 120, position: 'relative' }}>
                                Objet
                                {resizeHandle('objet')}
                              </th>
                              {decoupageFilter === 'avec' && group.items.some((r) => r.pk_debut !== undefined && r.pk_fin !== undefined && r.pk_debut !== null && r.pk_fin !== null) && (
                                <th rowSpan={2} style={{ width: columnWidths.pk ?? 150, minWidth: 120, textAlign: 'center', position: 'relative' }}>
                                  PK début → fin
                                  {resizeHandle('pk')}
                                </th>
                              )}
                              <th rowSpan={2} className="text-center" style={{ width: columnWidths.date ?? 130, minWidth: 120, position: 'relative' }}>
                                Date
                                {resizeHandle('date')}
                              </th>
                              <th rowSpan={2} className="text-center" style={{ width: columnWidths.observation ?? 320, minWidth: 260, position: 'relative' }}>
                                Observation & Situation
                                {resizeHandle('observation')}
                              </th>
                              <th colSpan={2} className="text-center" style={{ width: (columnWidths.physique ?? 110) + (columnWidths.financier ?? 110) + 12, minWidth: 220, position: 'relative' }}>
                                Avancement
                                {resizeHandle('physique')}
                              </th>
                              <th rowSpan={2} className="text-center" style={{ width: columnWidths.piecesJointes ?? 170, minWidth: 140, position: 'relative' }}>
                                Pièces jointes
                                {resizeHandle('piecesJointes')}
                              </th>
                              <th rowSpan={2} className="text-center" style={{ width: columnWidths.action ?? 150, minWidth: 120, position: 'relative' }}>
                                Action
                                {resizeHandle('action')}
                              </th>
                            </tr>
                            <tr>
                              <th className="text-center small" style={{ width: columnWidths.physique ?? 110, minWidth: 100, position: 'relative' }}>
                                Physique
                                {resizeHandle('physique')}
                              </th>
                              <th className="text-center small" style={{ width: columnWidths.financier ?? 110, minWidth: 100, position: 'relative' }}>
                                Financier
                                {resizeHandle('financier')}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map((row, idx) => {
                              const market = marches.find((m) => String(m.id) === row.id)
                              const latestAv = market?.dernier_avancement
                              const initialDetail = latestAv?.detail_situation ?? ''
                              const initialObs = latestAv?.observation ?? ''
                              const currentDetail = draftDetailSituation[row.id] ?? initialDetail
                              const currentObs = draftObservation[row.id] ?? initialObs
                              const physVal = draftProgress[row.id]?.physique ?? (Number.parseFloat(row.physique.replace('%', '')) || 0)
                              const finVal = draftProgress[row.id]?.financier ?? (Number.parseFloat(row.financier.replace('%', '')) || 0)

                              return (
                                <tr
                                  key={row.id}
                                  onClick={() => {
                                    if (!(isProgressOnlyManager && isEditMode)) {
                                      openModal('detail', row)
                                    }
                                  }}
                                  style={{ cursor: isProgressOnlyManager && isEditMode ? 'default' : 'pointer' }}
                                >
                                  <td className="text-center fw-bold avancement-edit-cell">{idx + 1}</td>
                                  <td className="avancement-edit-cell" style={{ whiteSpace: 'normal' }}>
                                    <div className="fw-semibold text-break">{row.objet}</div>
                                    <div className="small text-muted mt-1">{row.titulaire}</div>
                                  </td>
                                  {decoupageFilter === 'avec' && row.pk_debut !== undefined && row.pk_fin !== undefined && row.pk_debut !== null && row.pk_fin !== null && (
                                    <td className="text-center small text-muted avancement-edit-cell">{`${Number(row.pk_debut).toFixed(3)} → ${Number(row.pk_fin).toFixed(3)}`}</td>
                                  )}
                                  <td onClick={(e) => e.stopPropagation()} className="avancement-edit-cell" style={{ width: columnWidths.date ?? 130, minWidth: 120 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <CalendarBlank size={13} weight="bold" />
                                        Date
                                      </label>
                                      <input
                                        type="date"
                                        value={draftDate[row.id] ?? (latestAv?.date_avancement ?? new Date().toISOString().slice(0, 10))}
                                        className="form-control form-control-sm"
                                        style={{
                                          borderRadius: 8,
                                          background: 'rgba(15, 23, 42, 0.5)',
                                          border: '1px solid var(--border)',
                                          color: 'var(--text)',
                                          fontSize: 12,
                                          padding: '6px 8px',
                                        }}
                                        onChange={(e) => setDraftDate((prev) => ({ ...prev, [row.id]: e.target.value }))}
                                      />
                                    </div>
                                  </td>
                                  <td onClick={(e) => e.stopPropagation()} className="avancement-edit-cell" style={{ width: columnWidths.observation ?? 320, minWidth: 260 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      {/* Champ : Situation détaillée */}
                                      <div className="avancement-textarea-box">
                                        <div className="avancement-textarea-box__header">
                                          <span className="avancement-textarea-box__label" style={{ color: '#93c5fd' }}>
                                            <NotePencil size={13} weight="bold" />
                                            Situation détaillée
                                          </span>
                                          <button
                                            type="button"
                                            className="avancement-textarea-box__expand-btn"
                                            title="Agrandir en plein écran pour rédiger confortablement"
                                            onClick={() => setExpandedTextModal({
                                              row,
                                              field: 'detail',
                                              title: `Situation détaillée — ${row.objet}`,
                                              value: currentDetail,
                                            })}
                                          >
                                            <ArrowsOut size={12} weight="bold" />
                                            <span>Agrandir</span>
                                          </button>
                                        </div>
                                        <textarea
                                          rows={2}
                                          className="avancement-textarea-input"
                                          value={currentDetail}
                                          placeholder="Ex: Travaux en cours, terrassement achevé à 80%..."
                                          onChange={(e) => setDraftDetailSituation((prev) => ({ ...prev, [row.id]: e.target.value }))}
                                        />
                                      </div>

                                      {/* Champ : Observation particulière */}
                                      <div className="avancement-textarea-box">
                                        <div className="avancement-textarea-box__header">
                                          <span className="avancement-textarea-box__label" style={{ color: '#fcd34d' }}>
                                            <ChatText size={13} weight="bold" />
                                            Observation particulière
                                          </span>
                                          <button
                                            type="button"
                                            className="avancement-textarea-box__expand-btn"
                                            title="Agrandir en plein écran pour rédiger confortablement"
                                            onClick={() => setExpandedTextModal({
                                              row,
                                              field: 'obs',
                                              title: `Observation particulière — ${row.objet}`,
                                              value: currentObs,
                                            })}
                                          >
                                            <ArrowsOut size={12} weight="bold" />
                                            <span>Agrandir</span>
                                          </button>
                                        </div>
                                        <textarea
                                          rows={2}
                                          className="avancement-textarea-input"
                                          value={currentObs}
                                          placeholder="Ex: Aléas météo, retards d'approvisionnement..."
                                          onChange={(e) => setDraftObservation((prev) => ({ ...prev, [row.id]: e.target.value }))}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="avancement-edit-cell" style={{ textAlign: 'center', width: columnWidths.physique ?? 110, minWidth: 100 }} onClick={(e) => e.stopPropagation()}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>
                                        Physique
                                      </label>
                                      <div className="avancement-percent-wrapper">
                                        <input
                                          type="number"
                                          min={0}
                                          max={100}
                                          step={0.1}
                                          value={physVal}
                                          className="avancement-percent-input"
                                          disabled={Boolean(quickSavingIds[row.id])}
                                          onChange={(e) => {
                                            const raw = e.target.value
                                            if (raw === '') {
                                              setDraftProgress((prev) => ({
                                                ...prev,
                                                [row.id]: {
                                                  physique: '',
                                                  financier: prev[row.id]?.financier ?? (Number.parseFloat(row.financier.replace('%', '')) || 0),
                                                },
                                              }))
                                              return
                                            }
                                            const val = Number(raw)
                                            if (!Number.isNaN(val)) {
                                              setDraftProgress((prev) => ({
                                                ...prev,
                                                [row.id]: {
                                                  physique: val,
                                                  financier: prev[row.id]?.financier ?? (Number.parseFloat(row.financier.replace('%', '')) || 0),
                                                },
                                              }))
                                            }
                                          }}
                                        />
                                        <span className="avancement-percent-suffix">%</span>
                                      </div>
                                      <div className="avancement-progress-mini">
                                        <div
                                          className="avancement-progress-mini__fill"
                                          style={{
                                            width: `${Math.min(100, Math.max(0, Number(physVal) || 0))}%`,
                                            background: 'var(--primary)',
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="avancement-edit-cell" style={{ textAlign: 'center', width: columnWidths.financier ?? 110, minWidth: 100 }} onClick={(e) => e.stopPropagation()}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>
                                        Financier
                                      </label>
                                      <div className="avancement-percent-wrapper">
                                        <input
                                          type="number"
                                          min={0}
                                          max={100}
                                          step={0.1}
                                          value={finVal}
                                          className="avancement-percent-input"
                                          disabled={Boolean(quickSavingIds[row.id])}
                                          onChange={(e) => {
                                            const raw = e.target.value
                                            if (raw === '') {
                                              setDraftProgress((prev) => ({
                                                ...prev,
                                                [row.id]: {
                                                  physique: prev[row.id]?.physique ?? (Number.parseFloat(row.physique.replace('%', '')) || 0),
                                                  financier: '',
                                                },
                                              }))
                                              return
                                            }
                                            const val = Number(raw)
                                            if (!Number.isNaN(val)) {
                                              setDraftProgress((prev) => ({
                                                ...prev,
                                                [row.id]: {
                                                  physique: prev[row.id]?.physique ?? (Number.parseFloat(row.physique.replace('%', '')) || 0),
                                                  financier: val,
                                                },
                                              }))
                                            }
                                          }}
                                        />
                                        <span className="avancement-percent-suffix">%</span>
                                      </div>
                                      <div className="avancement-progress-mini">
                                        <div
                                          className="avancement-progress-mini__fill"
                                          style={{
                                            width: `${Math.min(100, Math.max(0, Number(finVal) || 0))}%`,
                                            background: '#10b981',
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td onClick={(e) => e.stopPropagation()} className="avancement-edit-cell" style={{ width: columnWidths.piecesJointes ?? 170, minWidth: 140 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>
                                        Pièces jointes
                                      </label>
                                      <label
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: 6,
                                          width: '100%',
                                          padding: '6px 10px',
                                          borderRadius: 8,
                                          border: '1px dashed var(--border)',
                                          background: 'rgba(15, 23, 42, 0.4)',
                                          color: 'var(--text)',
                                          fontSize: 12,
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                          lineHeight: 1.2,
                                          transition: 'all 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)' }}
                                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                                      >
                                        <input
                                          type="file"
                                          multiple
                                          style={{ display: 'none' }}
                                          onChange={(e) => {
                                            const files = Array.from(e.target.files ?? [])
                                            setDraftFiles((prev) => ({ ...prev, [row.id]: [...(prev[row.id] ?? []), ...files] }))
                                          }}
                                        />
                                        <Paperclip size={14} weight="bold" />
                                        Joindre
                                      </label>
                                      {draftFiles[row.id]?.length ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
                                          {draftFiles[row.id].map((f, fIdx) => (
                                            <div
                                              key={`${f.name}-${fIdx}`}
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 4,
                                                background: 'rgba(15, 23, 42, 0.6)',
                                                border: '1px solid var(--border)',
                                                borderRadius: 6,
                                                padding: '3px 6px',
                                                fontSize: 11,
                                              }}
                                            >
                                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 105, color: 'var(--text)' }} title={f.name}>
                                                {f.name}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setDraftFiles((prev) => ({
                                                    ...prev,
                                                    [row.id]: (prev[row.id] ?? []).filter((_, idx2) => idx2 !== fIdx),
                                                  }))
                                                }}
                                                style={{
                                                  background: 'transparent',
                                                  border: 'none',
                                                  color: '#f87171',
                                                  cursor: 'pointer',
                                                  padding: 0,
                                                  display: 'inline-flex',
                                                  lineHeight: 1,
                                                }}
                                                title="Supprimer cette pièce jointe"
                                              >
                                                <X size={12} weight="bold" />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', fontStyle: 'italic' }}>
                                          Aucun fichier
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="text-center avancement-edit-cell" onClick={(e) => e.stopPropagation()} style={{ width: columnWidths.action ?? 150, minWidth: 120 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
                                      <button
                                        type="button"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: 6,
                                          background: 'var(--primary)',
                                          color: 'var(--on-primary)',
                                          border: '1px solid var(--primary)',
                                          borderRadius: 8,
                                          padding: '7px 12px',
                                          fontSize: 12,
                                          fontWeight: 700,
                                          boxShadow: 'var(--shadow-sm)',
                                          cursor: quickSavingIds[row.id] ? 'not-allowed' : 'pointer',
                                          opacity: quickSavingIds[row.id] ? 0.7 : 1,
                                          transition: 'all 0.15s ease',
                                        }}
                                        disabled={Boolean(quickSavingIds[row.id])}
                                        onClick={async () => { await handleProgressValidation(row) }}
                                      >
                                        {quickSavingIds[row.id] ? (
                                          <>
                                            <SpinnerGap size={14} className="spin" aria-hidden="true" />
                                            <span>...</span>
                                          </>
                                        ) : (
                                          <>
                                            <CheckCircle size={14} weight="bold" />
                                            <span>Valider</span>
                                          </>
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: 4,
                                          background: 'transparent',
                                          color: 'var(--muted)',
                                          border: '1px solid var(--border)',
                                          borderRadius: 8,
                                          padding: '6px 10px',
                                          fontSize: 12,
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                          transition: 'all 0.15s ease',
                                        }}
                                        onClick={handleCancelProgressMode}
                                      >
                                        <X size={13} />
                                        <span>Annuler</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </>
                      ) : (
                        <>
                          <thead>
                            <tr>
                              <th rowSpan={2} style={{ width: columnWidths.index ?? 52, minWidth: 52, textAlign: 'center', position: 'relative' }}>
                                #
                                {resizeHandle('index')}
                              </th>
                              <th rowSpan={2} style={{ width: columnWidths.objet ?? 180, minWidth: 120, position: 'relative' }}>
                                Objet
                                {resizeHandle('objet')}
                              </th>
                              {decoupageFilter === 'avec' && group.items.some((r) => r.pk_debut !== undefined && r.pk_fin !== undefined && r.pk_debut !== null && r.pk_fin !== null) && (
                                <th rowSpan={2} style={{ width: columnWidths.pk ?? 150, minWidth: 120, textAlign: 'center', position: 'relative' }}>
                                  PK début → fin
                                  {resizeHandle('pk')}
                                </th>
                              )}
                              <th rowSpan={2} className="text-center" style={{ width: columnWidths.mdc ?? 110, minWidth: 90, position: 'relative' }}>
                                MDC
                                {resizeHandle('mdc')}
                              </th>
                              <th rowSpan={2} style={{ width: columnWidths.titulaire ?? 170, minWidth: 120, position: 'relative' }}>
                                Titulaire
                                {resizeHandle('titulaire')}
                              </th>
                              <th rowSpan={2} style={{ width: columnWidths.financement ?? 130, minWidth: 100, position: 'relative' }}>
                                Financement
                                {resizeHandle('financement')}
                              </th>
                              {showTemporalColumn && (
                                <th rowSpan={2} className="text-center small" style={{ width: columnWidths.temporel ?? 120, minWidth: 100, position: 'relative' }}>
                                  Temporel
                                  {resizeHandle('temporel')}
                                </th>
                              )}
                              <th colSpan={2} className="text-center" style={{ width: (columnWidths.physique ?? 120) + (columnWidths.financier ?? 120) + 12, minWidth: 220, position: 'relative' }}>
                                Avancement
                                {resizeHandle('physique')}
                              </th>
                              <th rowSpan={2} style={{ width: columnWidths.situation ?? 120, minWidth: 110, position: 'relative' }}>
                                Situation
                                {resizeHandle('situation')}
                              </th>
                              {!isProgressOnlyManager && isEditMode && canManageProgress && (
                                <th rowSpan={2} className="text-center" style={{ width: columnWidths.action ?? 160, minWidth: 100, position: 'relative' }}>
                                  Action
                                  {resizeHandle('action')}
                                </th>
                              )}
                            </tr>
                            <tr>
                              <th className="text-center small" style={{ width: columnWidths.physique ?? 120, minWidth: 100, position: 'relative' }}>
                                Physique
                                {resizeHandle('physique')}
                              </th>
                              <th className="text-center small" style={{ width: columnWidths.financier ?? 120, minWidth: 100, position: 'relative' }}>
                                Financier
                                {resizeHandle('financier')}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map((row, idx) => (
                              <tr key={row.id} onClick={() => openModal('detail', row)} style={{ cursor: 'pointer' }}>
                                <td className="text-center fw-bold">{idx + 1}</td>
                                <td style={{ whiteSpace: 'normal' }}>{row.objet}</td>
                                {decoupageFilter === 'avec' && row.pk_debut !== undefined && row.pk_fin !== undefined && row.pk_debut !== null && row.pk_fin !== null && (
                                  <td className="text-center small text-muted">{`${Number(row.pk_debut).toFixed(3)} → ${Number(row.pk_fin).toFixed(3)}`}</td>
                                )}
                                <td className="text-center"><span className="badge">{row.mdc}</span></td>
                                <td>{row.titulaire}</td>
                                <td>{row.financement}</td>
                                {showTemporalColumn && <td style={{ textAlign: 'center' }}>{row.temporel}</td>}
                                <td style={{ textAlign: 'center' }}>{row.physique}</td>
                                <td style={{ textAlign: 'center' }}>{row.financier}</td>
                                <td>{row.situation}</td>
                                {!isProgressOnlyManager && isEditMode && canManageProgress && (
                                  <td className="text-center">
                                    <RowActions
                                      row={row}
                                      canDelete={canManageProgress}
                                      mode={canCreateMarche ? 'full' : 'avancement-only'}
                                      onOpen={openModal}
                                      onDelete={handleDelete}
                                    />
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </>
                      )}
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
      </div>

      {/* ─── Modale Plein Écran de Rédaction du Texte ─── */}
      {expandedTextModal && (
        <div
          className="marche-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            className="marche-modal-backdrop"
            onClick={() => setExpandedTextModal(null)}
            style={{ position: 'absolute', inset: 0, background: 'var(--scrim)' }}
          />
          <div
            className="marche-modal"
            style={{
              position: 'relative',
              width: 'min(640px, 94%)',
              background: 'var(--panel)',
              borderRadius: 16,
              border: '1px solid var(--border)',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4)',
              zIndex: 81,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--panel-soft)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {expandedTextModal.field === 'detail' ? (
                  <NotePencil size={18} weight="bold" style={{ color: '#93c5fd' }} />
                ) : (
                  <ChatText size={18} weight="bold" style={{ color: '#fcd34d' }} />
                )}
                <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                  {expandedTextModal.title}
                </h5>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setExpandedTextModal(null)}
                style={{ padding: '4px 8px' }}
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 18 }}>
              <label style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, display: 'block' }}>
                {expandedTextModal.field === 'detail'
                  ? 'Rédigez la situation détaillée de ce marché :'
                  : 'Rédigez vos observations particulières sur ce marché :'}
              </label>
              <textarea
                autoFocus
                rows={8}
                value={expandedTextModal.value}
                onChange={(e) => setExpandedTextModal((prev) => prev ? { ...prev, value: e.target.value } : null)}
                style={{
                  width: '100%',
                  borderRadius: 10,
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: 13,
                  lineHeight: 1.55,
                  padding: '12px 14px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
                placeholder="Saisissez votre texte ici..."
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {expandedTextModal.value.length} caractère(s)
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setExpandedTextModal(null)}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      if (expandedTextModal.field === 'detail') {
                        setDraftDetailSituation((prev) => ({ ...prev, [expandedTextModal.row.id]: expandedTextModal.value }))
                      } else {
                        setDraftObservation((prev) => ({ ...prev, [expandedTextModal.row.id]: expandedTextModal.value }))
                      }
                      setExpandedTextModal(null)
                    }}
                  >
                    Appliquer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

