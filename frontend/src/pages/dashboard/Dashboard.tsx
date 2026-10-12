import { useEffect, useState } from 'react'
import {
  AnchorSimple,
  ArrowClockwise,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ArrowsClockwise,
  ChartBar,
  CheckCircle,
  Clock,
  GridFour,
  MagnifyingGlass,
  MapPin,
  Wallet,
  WarningCircle,
} from '@phosphor-icons/react'
import { fetchDashboardStats, fetchMarches } from '../../api/travaux.api'
import type { DashboardStatsResponse, MarcheItem } from '../../types/travaux'

type PeriodFilter = 'mois' | 'trimestre' | 'annee' | 'tout'

const PERIOD_OPTIONS: Array<{ value: PeriodFilter; label: string }> = [
  { value: 'mois', label: 'Ce mois' },
  { value: 'trimestre', label: 'Ce trimestre' },
  { value: 'annee', label: 'Cette année' },
  { value: 'tout', label: 'Tout' },
]

const formatCurrency = (val: number = 0) => `${Math.round(val).toLocaleString('fr-FR')} Ar`

const renderLoadingState = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem', padding: '1rem', color: 'var(--muted)', minHeight: 88 }}>
    <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(148,163,184,0.35)', borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite' }} />
    <span>Chargement des données…</span>
  </div>
)

const renderActionState = (message: string, canCreate = true) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.8rem', padding: '1rem', borderRadius: 12, background: 'rgba(148, 163, 184, 0.04)', border: '1px solid var(--border)' }}>
    <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.5 }}>{message}</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {canCreate && (
        <button type="button" className="btn btn-primary" onClick={() => {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('open-marche-form', '1')
            window.location.hash = '#/travaux'
          }
        }}>
          + Nouveau marché
        </button>
      )}
      <button type="button" className="btn btn-outline" onClick={() => {
        if (typeof window !== 'undefined') {
          window.location.hash = '#/travaux'
        }
      }}>
        Voir tous les marchés
      </button>
    </div>
  </div>
)

type DashboardProps = {
  userRoles?: string[]
}

export function Dashboard({ userRoles = [] }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null)
  const [assignedProjects, setAssignedProjects] = useState<MarcheItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<PeriodFilter>('annee')
  const [pmFilter, setPmFilter] = useState<'all' | 'delayed' | 'ontime'>('all')
  const [pmSearch, setPmSearch] = useState('')

  const isProjectManager = userRoles.includes('chef_de_projet')
  const isReadOnlyUser = userRoles.some((role) => ['visiteur', 'ministre', 'viewer', 'audience_ministre'].includes(role))

  const loadStats = async (nextPeriod: PeriodFilter = period) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchDashboardStats(nextPeriod)
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des statistiques')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isProjectManager) {
      void fetchMarches()
        .then((projects) => setAssignedProjects(projects))
        .catch(() => setAssignedProjects([]))
    } else {
      setAssignedProjects([])
    }

    void loadStats(period)

    const handleRefresh = () => {
      void loadStats(period)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('avancement:created', handleRefresh)
      window.addEventListener('avancement:updated', handleRefresh)
      window.addEventListener('avancement:deleted', handleRefresh)
      window.addEventListener('marche:created', handleRefresh)
      window.addEventListener('marche:updated', handleRefresh)
      window.addEventListener('marche:deleted', handleRefresh)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('avancement:created', handleRefresh)
        window.removeEventListener('avancement:updated', handleRefresh)
        window.removeEventListener('avancement:deleted', handleRefresh)
        window.removeEventListener('marche:created', handleRefresh)
        window.removeEventListener('marche:updated', handleRefresh)
        window.removeEventListener('marche:deleted', handleRefresh)
      }
    }
  }, [isProjectManager, period])

  useEffect(() => {
    void loadStats(period)
  }, [period])

  const recapFinancement = stats?.recap_financement ?? []
  const alerts = stats?.alerts ?? []
  const aucProgress = stats?.auc_stats.progression_pct ?? 0
  const totalMarchesPermanentes = recapFinancement.find((row) => row.type === 'TOTAL GLOBAL')?.total ?? 0
  const budgetBreakdown = stats?.summary_cards?.budget_breakdown ?? { travaux: 0, bac: 0, convention: 0 }

  const summaryCards = isProjectManager
    ? [
        {
          label: 'Budget alloué (marchés)',
          value: stats ? formatCurrency(stats.summary_cards.budget_engage) : '—',
          tone: 'primary',
          icon: Wallet,
          trend: stats ? `${totalMarchesPermanentes} marchés assignés` : 'Chargement…',
          trendDirection: 'up' as const,
        },
        {
          label: 'Marchés assignés',
          value: stats ? String(totalMarchesPermanentes) : '—',
          tone: 'warning',
          icon: GridFour,
          trend: stats ? `${totalMarchesPermanentes} dans mon périmètre` : 'Chargement…',
          trendDirection: 'up' as const,
        },
        {
          label: 'Avancement moyen',
          value: stats ? `${Number(stats.summary_cards.avancement_physique).toFixed(1)}%` : '—',
          tone: 'success',
          icon: ChartBar,
          trend: stats
            ? stats.summary_cards.avancement_physique >= 75
              ? 'Bon rythme'
              : stats.summary_cards.avancement_physique >= 50
              ? 'En progression'
              : 'Attention'
            : 'Chargement…',
          trendDirection: (stats?.summary_cards.avancement_physique ?? 0) >= 50 ? ('up' as const) : ('down' as const),
        },
        {
          label: 'Marchés en retard',
          value: stats ? String(stats.summary_cards.marches_en_retard) : '—',
          tone: 'danger',
          icon: Clock,
          trend: (stats?.summary_cards.marches_en_retard ?? 0) > 0 ? 'Action req.' : 'À jour',
          trendDirection: (stats?.summary_cards.marches_en_retard ?? 0) > 0 ? ('down' as const) : ('up' as const),
        },
      ]
    : [
        {
          label: 'Budget engagé',
          value: stats ? formatCurrency(stats.summary_cards.budget_engage) : '—',
          tone: 'primary',
          icon: Wallet,
          trend: stats
            ? `${(stats.recap_financement ?? []).filter((r) => r.type !== 'TOTAL GLOBAL').reduce((s, r) => s + r.total, 0)} marchés`
            : 'Chargement…',
          trendDirection: 'up' as const,
        },
        {
          label: 'Avancement physique',
          value: stats ? `${Number(stats.summary_cards.avancement_physique).toFixed(1)}%` : '—',
          tone: 'success',
          icon: ChartBar,
          trend: stats
            ? stats.summary_cards.avancement_physique >= 75
              ? 'Bon rythme'
              : stats.summary_cards.avancement_physique >= 50
              ? 'En progression'
              : 'Attention'
            : 'Chargement…',
          trendDirection: (stats?.summary_cards.avancement_physique ?? 0) >= 50 ? ('up' as const) : ('down' as const),
        },
        {
          label: 'Marchés en retard',
          value: stats ? String(stats.summary_cards.marches_en_retard) : '—',
          tone: 'danger',
          icon: Clock,
          trend: stats?.summary_cards.marches_en_retard ? 'Action req.' : 'OK',
          trendDirection: (stats?.summary_cards.marches_en_retard ?? 0) > 0 ? ('down' as const) : ('up' as const),
        },
        {
          label: 'Reliquats glissements',
          value: stats ? formatCurrency(stats.summary_cards.reliquats_glissements) : '—',
          tone: 'warning',
          icon: ArrowClockwise,
          trend: 'Exercice 2026',
          trendDirection: 'up' as const,
        },
      ]

  const bacStats = [
    { label: 'Besoin entretien', value: stats ? formatCurrency(stats.bac_stats.besoin_entretien) : '—' },
    { label: 'Opérationnels', value: stats ? `${stats.bac_stats.operationnels} / ${stats.bac_stats.total}` : '—' },
    { label: 'Propulsion moteur', value: stats ? String(stats.bac_stats.propulsion['Moteur'] ?? 0) : '—' },
    { label: 'AUC obtenues', value: stats ? String(stats.auc_stats.obtenues) : '—' },
  ]
  
  const showFullDashboard = !isProjectManager

  // Helper function to get trend color based on tone
  const getTrendColor = (tone: string): string => {
    switch (tone) {
      case 'primary': return '#3b82f6'; // blue
      case 'success': return '#10b981'; // green
      case 'danger': return '#ef4444'; // red
      case 'warning': return '#f59e0b'; // amber
      default: return '#6b7280'; // gray
    }
  };

  return (
    <section className="dashboard-page">
      <style>{'@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
      <div className="page-header">
        <div>
          <p className="section-kicker">{isProjectManager ? 'Périmètre chef de projet' : 'Vue Générale MTP'}</p>
          <h1>{isProjectManager ? 'Tableau de bord de mon périmètre' : 'Tableau de bord décisionnel'}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem', borderRadius: 999, background: 'rgba(148, 163, 184, 0.08)', border: '1px solid var(--border)' }}>
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={option.value === period ? 'btn btn-primary' : 'btn btn-outline'}
                style={{ padding: '0.45rem 0.8rem', fontSize: '0.75rem', minWidth: 0 }}
                onClick={() => setPeriod(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {!isProjectManager && !isReadOnlyUser && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem('open-marche-form', '1')
                  window.location.hash = '#/travaux'
                }
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <span>＋</span>
              <span>Nouveau marché</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => void loadStats(period)}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <ArrowsClockwise size={16} className={loading ? 'icon-spin' : ''} />
            <span>{loading ? 'Actualisation...' : 'Actualiser'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      <div className="stats-row">
        <div className="stats-card stats-card-main">
          <div className="stats-card-header">
            <span className="stats-card-label">{summaryCards[0].label}</span>
          </div>
          <div className="stats-card-value">
            <strong>{summaryCards[0].value}</strong>
          </div>
          {/* Sparkline area chart with gradient fill and final point */}
          <div className="stats-sparkline" aria-hidden>
            <svg width="100%" height="36" viewBox="0 0 100 36" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="budgetGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(59,130,246,0.8)" />
                  <stop offset="100%" stopColor="rgba(59,130,246,0)" />
                </linearGradient>
              </defs>
              <path d="M0,28 C15,20 30,16 45,18 C60,20 75,16 90,12 L95,11 L100,10 L100,36 L0,36 Z" fill="url(#budgetGradient)" stroke="none" />
              <path d="M0,28 C15,20 30,16 45,18 C60,20 75,16 90,12 L95,11" fill="none" stroke="rgba(59,130,246,0.95)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="95" cy="11" r="3" fill="rgba(59,130,246,0.95)" />
            </svg>
          </div>

          {!isProjectManager ? (
            <div className="budget-breakdown" aria-label="Répartition du budget engagé">
              {[
                { label: 'Travaux', value: budgetBreakdown.travaux },
                { label: 'Bac', value: budgetBreakdown.bac },
                { label: 'Convention', value: budgetBreakdown.convention },
              ].map((item) => (
                <div key={item.label} className="budget-breakdown__item">
                  <span>{item.label}</span>
                  <strong>{formatCurrency(item.value)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="budget-breakdown" aria-label="Détail des marchés assignés">
              <div className="budget-breakdown__item">
                <span>Marchés assignés</span>
                <strong>{totalMarchesPermanentes}</strong>
              </div>
              <div className="budget-breakdown__item">
                <span>Budget moyen / marché</span>
                <strong>{totalMarchesPermanentes > 0 && stats ? formatCurrency(stats.summary_cards.budget_engage / totalMarchesPermanentes) : '—'}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Right group: asymmetric layout */}
        <div className="stats-right">
          <div className="stats-right-top">
            <div className="stats-card stats-card-right-large">
              <div className="stats-card-header">
                <span className="stats-cell-label">{summaryCards[1].label}</span>
              </div>
              <div className="stats-card-value">
                <strong>{summaryCards[1].value}</strong>
              </div>
            </div>

            <div className="stats-card stats-card-right-small">
              <div className="stats-card-header">
                <span className="stats-cell-label">{summaryCards[2].label}</span>
              </div>
              <div className="stats-card-value">
                <strong>{summaryCards[2].value}</strong>
              </div>
            </div>
          </div>

          <div className="stats-right-bottom">
            <div className="stats-card stats-card-right-wide compact">
              <div className="stats-card-header">
                <span className="stats-cell-label">{summaryCards[3].label}</span>
              </div>
              <div className="stats-card-value">
                <strong>{summaryCards[3].value}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!isProjectManager && (
        <div className="panel stats-panel">
          <div className="panel-header">
            <div className="panel-header__title">
              <span className="panel-header__icon"><GridFour size={15} weight="regular" /></span>
              <h2>Récapitulatif des marchés par source de financement</h2>
            </div>
          </div>

          <div className="table-card compact-table">
            <table>
              <thead>
                <tr>
                  <th>Source financement</th>
                  <th>En PH</th>
                  <th>En passation</th>
                  <th>En cours</th>
                  <th>Arrêté</th>
                  <th>Achevé</th>
                  <th className="compact-table__header compact-table__header--total">Total</th>
                  <th className="compact-table__header compact-table__header--retard">Retard</th>
                </tr>
              </thead>
              <tbody>
                {recapFinancement.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--muted)' }}>
                      {loading ? 'Chargement des données...' : 'Aucun marché enregistré'}
                    </td>
                  </tr>
                ) : (
                  recapFinancement.map((row) => (
                    <tr key={row.type}>
                      <td><strong>{row.type}</strong></td>
                      <td>{row.details.En_ph ?? 0}</td>
                      <td>{row.details.En_passation ?? 0}</td>
                      <td>{row.details.En_cours ?? 0}</td>
                      <td>{row.details.Arrete ?? 0}</td>
                      <td>{row.details.Acheve ?? 0}</td>
                      <td className={row.type === 'TOTAL GLOBAL' ? 'compact-table__cell compact-table__cell--total-summary' : 'compact-table__cell'}>
                        <span>{row.total}</span>
                      </td>
                      <td className="compact-table__cell compact-table__cell--retard">
                        {row.retard > 0 ? <span className="retard-badge">{row.retard}</span> : <span className="text-success">OK</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isProjectManager && (() => {
        const delayedProjects = assignedProjects.filter((project) => Boolean(project.dernier_avancement?.est_en_retard))
        const onTimeProjects = assignedProjects.filter((project) => !project.dernier_avancement?.est_en_retard)

        const filteredProjects = assignedProjects.filter((project) => {
          const isDelayed = Boolean(project.dernier_avancement?.est_en_retard)
          if (pmFilter === 'delayed' && !isDelayed) return false
          if (pmFilter === 'ontime' && isDelayed) return false

          if (pmSearch.trim()) {
            const q = pmSearch.toLowerCase().trim()
            const name = (project.resume || project.description || '').toLowerCase()
            const num = (project.num_marche || '').toLowerCase()
            const axe = (project.axe_detail?.designation || '').toLowerCase()
            const region = (project.region || '').toLowerCase()
            const titulaire = (project.titulaire || '').toLowerCase()
            return name.includes(q) || num.includes(q) || axe.includes(q) || region.includes(q) || titulaire.includes(q)
          }
          return true
        })

        return (
          <div className="panel stats-panel" style={{ marginTop: '1.5rem' }}>
            {/* En-tête avec titre, recherche et filtres rapides */}
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div className="panel-header__title">
                <span className="panel-header__icon"><GridFour size={16} weight="regular" /></span>
                <h2>Suivi opérationnel de mes chantiers ({assignedProjects.length})</h2>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                {/* Recherche textuelle */}
                <div style={{ position: 'relative', minWidth: 220 }}>
                  <MagnifyingGlass size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                  <input
                    type="text"
                    placeholder="Filtrer (nom, axe, région…)"
                    value={pmSearch}
                    onChange={(e) => setPmSearch(e.target.value)}
                    style={{
                      padding: '0.35rem 0.75rem 0.35rem 2rem',
                      fontSize: '0.8rem',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      width: '100%',
                    }}
                  />
                </div>

                {/* Filtres d'état */}
                <div style={{ display: 'inline-flex', padding: '0.2rem', borderRadius: 8, background: 'rgba(148, 163, 184, 0.08)', border: '1px solid var(--border)', gap: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setPmFilter('all')}
                    className={pmFilter === 'all' ? 'btn btn-primary' : 'btn btn-outline'}
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', border: 'none' }}
                  >
                    Tous ({assignedProjects.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPmFilter('delayed')}
                    className={pmFilter === 'delayed' ? 'btn btn-primary' : 'btn btn-outline'}
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', border: 'none', color: delayedProjects.length > 0 && pmFilter !== 'delayed' ? 'var(--danger)' : undefined }}
                  >
                    En retard ({delayedProjects.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPmFilter('ontime')}
                    className={pmFilter === 'ontime' ? 'btn btn-primary' : 'btn btn-outline'}
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', border: 'none' }}
                  >
                    Dans les délais ({onTimeProjects.length})
                  </button>
                </div>
              </div>
            </div>

            {/* Alerte synthétique */}
            {delayedProjects.length > 0 ? (
              <div style={{
                margin: '0.75rem 1.25rem 0.25rem',
                padding: '0.65rem 1rem',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.10)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                fontSize: '0.85rem',
                color: 'var(--danger)',
              }}>
                <WarningCircle size={18} weight="fill" />
                <span><strong>Attention :</strong> {delayedProjects.length} chantier(s) présente(nt) un retard sur le calendrier prévisionnel.</span>
              </div>
            ) : assignedProjects.length > 0 ? (
              <div style={{
                margin: '0.75rem 1.25rem 0.25rem',
                padding: '0.55rem 1rem',
                borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.20)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                fontSize: '0.8rem',
                color: 'var(--success)',
              }}>
                <CheckCircle size={16} weight="fill" />
                <span>Tous les chantiers de votre portefeuille respectent le calendrier d’avancement.</span>
              </div>
            ) : null}

            {/* Tableau unique central */}
            <div className="table-card compact-table" style={{ marginTop: '0.75rem' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: 240 }}>Marché & Localisation</th>
                    <th style={{ minWidth: 140 }}>Titulaire</th>
                    <th style={{ minWidth: 160 }}>Avancement physique</th>
                    <th style={{ minWidth: 120 }}>Statut</th>
                    <th style={{ minWidth: 130 }}>Échéance</th>
                    <th style={{ width: 90, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                        Chargement de vos chantiers…
                      </td>
                    </tr>
                  ) : filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                        {assignedProjects.length === 0
                          ? 'Vous n’avez aucun marché assigné pour le moment.'
                          : 'Aucun chantier ne correspond aux critères de filtre.'}
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((project) => {
                      const avancementVal = Number(project.dernier_avancement?.avancement_physique ?? 0)
                      const isDelayed = Boolean(project.dernier_avancement?.est_en_retard)
                      const situation = project.dernier_avancement?.situation_w
                      const lastDate = project.dernier_avancement?.date_avancement
                        ? new Date(project.dernier_avancement.date_avancement).toLocaleDateString('fr-FR')
                        : null

                      const dateFin = project.date_fin_actualisee
                      let dateFinFormatted = 'Non définie'
                      let delayDays: number | null = null
                      if (dateFin) {
                        const parsed = new Date(dateFin)
                        if (!isNaN(parsed.getTime())) {
                          dateFinFormatted = parsed.toLocaleDateString('fr-FR')
                          delayDays = Math.ceil((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        }
                      }

                      return (
                        <tr key={project.id}>
                          <td>
                            <div style={{ display: 'grid', gap: 3 }}>
                              <strong style={{ fontSize: '0.88rem', color: 'var(--text-strong)' }}>
                                {project.resume || project.description || 'Marché sans intitulé'}
                              </strong>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--muted)' }}>
                                {project.axe_detail?.designation && (
                                  <span style={{ padding: '0.1rem 0.4rem', borderRadius: 4, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', fontWeight: 600 }}>
                                    {project.axe_detail.designation}
                                  </span>
                                )}
                                {project.region && (
                                  <span style={{ padding: '0.1rem 0.4rem', borderRadius: 4, background: 'rgba(148, 163, 184, 0.1)', color: 'var(--muted)' }}>
                                    {project.region}
                                  </span>
                                )}
                                {project.num_marche && (
                                  <span>N° {project.num_marche}</span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td>
                            <span style={{ fontSize: '0.85rem' }}>{project.titulaire || '—'}</span>
                          </td>

                          <td>
                            <div style={{ display: 'grid', gap: 4 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                                <strong style={{ color: avancementVal >= 75 ? 'var(--success)' : 'var(--text-strong)' }}>
                                  {avancementVal.toFixed(1)}%
                                </strong>
                                {lastDate && (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                                    Pointage : {lastDate}
                                  </span>
                                )}
                              </div>
                              <div style={{ height: 6, borderRadius: 99, background: 'rgba(148, 163, 184, 0.2)', overflow: 'hidden' }}>
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${Math.min(avancementVal, 100)}%`,
                                    borderRadius: 99,
                                    background: isDelayed
                                      ? 'var(--danger)'
                                      : avancementVal >= 75
                                      ? 'var(--success)'
                                      : '#3b82f6',
                                    transition: 'width 0.3s ease',
                                  }}
                                />
                              </div>
                            </div>
                          </td>

                          <td>
                            {isDelayed ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: 99, background: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)' }} />
                                En retard
                              </span>
                            ) : situation === 'Acheve' ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: 99, background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 600 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6' }} />
                                Achevé
                              </span>
                            ) : situation === 'Arrete' ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: 99, background: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)', fontSize: '0.75rem', fontWeight: 600 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)' }} />
                                Arrêté
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.55rem', borderRadius: 99, background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)', fontSize: '0.75rem', fontWeight: 600 }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
                                Dans les délais
                              </span>
                            )}
                          </td>

                          <td>
                            <div style={{ display: 'grid', gap: 2, fontSize: '0.8rem' }}>
                              <span>{dateFinFormatted}</span>
                              {delayDays !== null && (
                                <span style={{
                                  fontSize: '0.7rem',
                                  color: delayDays < 0 ? 'var(--danger)' : delayDays <= 30 ? 'var(--warning)' : 'var(--muted)',
                                }}>
                                  {delayDays < 0
                                    ? `Dépassée de ${Math.abs(delayDays)} j`
                                    : delayDays <= 30
                                    ? `J-${delayDays}`
                                    : `Dans ${delayDays} j`}
                                </span>
                              )}
                            </div>
                          </td>

                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-outline"
                              onClick={() => {
                                if (typeof window !== 'undefined') {
                                  window.location.hash = `#/travaux/detail/${project.id}`
                                }
                              }}
                              style={{ padding: '0.3rem 0.55rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                              title="Accéder aux détails du marché"
                            >
                              <span>Détails</span>
                              <ArrowRight size={12} />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {showFullDashboard && (
        <div className="panel-grid dashboard-grid">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-header__title">
                <span className="panel-header__icon"><AnchorSimple size={15} weight="regular" /></span>
                <h2>Statut des bacs de traversée</h2>
              </div>
            </div>

            <div className="mini-stats">
              {bacStats.map((item) => (
                <div key={item.label} className="mini-stat">
                  <small>{item.label}</small>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>

            <table className="compact-table inline-table">
              <thead>
                <tr>
                  <th>Mode propulsion</th>
                  <th>Effectif</th>
                </tr>
              </thead>
              <tbody>
                {stats?.bac_stats.propulsion ? (
                  Object.entries(stats.bac_stats.propulsion).map(([mode, count]) => (
                    <tr key={mode}>
                      <td>{mode.replace(/_/g, ' ')}</td>
                      <td><strong>{count}</strong></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2}>Chargement...</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <aside className="panel">
            <div className="panel-header">
              <div className="panel-header__title">
                <span className="panel-header__icon"><CheckCircle size={15} weight="regular" /></span>
                <h2>Indicateur de passation (AUC)</h2>
              </div>
            </div>

            <div className="auc-box">
              <div>
                <strong>{stats?.auc_stats.obtenues ?? 0}</strong>
                <span>AUC obtenues</span>
              </div>
              <div>
                <strong>{stats?.auc_stats.en_attente ?? 0}</strong>
                <span>En attente</span>
              </div>
            </div>

            <div className="progress-wrap">
              <div className="progress-labels">
                <span>Progression des validations</span>
                <strong>{aucProgress}%</strong>
              </div>
              <div className="progress-bar">
                <span style={{ width: `${Math.min(aucProgress, 100)}%` }} />
              </div>
            </div>

            <div className="alert-list">
              {alerts.length === 0 ? (
                <div className="alert-item">Aucune alerte en cours.</div>
              ) : (
                alerts.map((alert, idx) => (
                  <div key={idx} className="alert-item">{alert}</div>
                ))
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  )
}

