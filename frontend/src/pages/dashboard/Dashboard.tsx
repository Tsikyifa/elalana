import { useEffect, useState } from 'react'
import {
  AnchorSimple,
  ArrowClockwise,
  ArrowDownRight,
  ArrowUpRight,
  ArrowsClockwise,
  ChartBar,
  CheckCircle,
  Clock,
  GridFour,
  MapPin,
  Wallet,
} from '@phosphor-icons/react'
import { fetchCurrentUser } from '../../api/users.api'
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

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null)
  const [assignedProjects, setAssignedProjects] = useState<MarcheItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isProjectManager, setIsProjectManager] = useState(false)
  const [isReadOnlyUser, setIsReadOnlyUser] = useState(false)
  const [period, setPeriod] = useState<PeriodFilter>('annee')

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
    void fetchCurrentUser()
      .then((response) => {
        const roles = response.user.roles ?? []
        const isManager = roles.includes('chef_de_projet')
        const readOnly = roles.some((role) => ['visiteur', 'ministre', 'viewer', 'audience_ministre'].includes(role))

        setIsProjectManager(isManager)
        setIsReadOnlyUser(readOnly)

        if (isManager) {
          void fetchMarches().then((projects) => {
            setAssignedProjects(projects)
          }).catch(() => setAssignedProjects([]))
        } else {
          setAssignedProjects([])
        }
      })
      .catch(() => {
        setIsProjectManager(false)
        setIsReadOnlyUser(false)
        setAssignedProjects([])
      })

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
  }, [])

  useEffect(() => {
    void loadStats(period)
  }, [period])

  const recapFinancement = stats?.recap_financement ?? []
  const alerts = stats?.alerts ?? []
  const aucProgress = stats?.auc_stats.progression_pct ?? 0
  const totalMarchesPermanentes = recapFinancement.find((row) => row.type === 'TOTAL GLOBAL')?.total ?? 0

  const summaryCards = isProjectManager
    ? [
        {
          label: 'Budget engagé',
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
          icon: Wallet,
          trend: stats ? `${totalMarchesPermanentes} marchés` : 'Chargement…',
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
          label: 'Retards',
          value: stats ? String(stats.summary_cards.marches_en_retard) : '—',
          tone: 'danger',
          icon: Clock,
          trend: stats?.summary_cards.marches_en_retard ? 'Action req.' : 'OK',
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
            <span className="stats-trend-badge">
              <span className="trend-dot" style={{ backgroundColor: getTrendColor('primary') }}></span>
              {summaryCards[0].trendDirection === 'up' ? <ArrowUpRight size={10} className="trend-arrow" /> : <ArrowDownRight size={10} className="trend-arrow" />}
              <span className="trend-text">{summaryCards[0].trend}</span>
            </span>
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
              {/* Area path: simplified sample curve; preserves accessibility by being decorative */}
              <path d="M0,28 C15,20 30,16 45,18 C60,20 75,16 90,12 L95,11 L100,10 L100,36 L0,36 Z" fill="url(#budgetGradient)" stroke="none" />
              <path d="M0,28 C15,20 30,16 45,18 C60,20 75,16 90,12 L95,11" fill="none" stroke="rgba(59,130,246,0.95)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="95" cy="11" r="3" fill="rgba(59,130,246,0.95)" />
            </svg>
          </div>
        </div>

        {/* Right group: asymmetric layout */}
        <div className="stats-right">
          <div className="stats-right-top">
            <div className="stats-card stats-card-right-large">
          <div className="stats-card-header">
            <span className="stats-cell-label">{summaryCards[1].label}</span>
            <span className="stats-trend-badge">
              <span className="trend-dot" style={{ backgroundColor: getTrendColor('success') }}></span>
              {summaryCards[1].trendDirection === 'up' ? <ArrowUpRight size={10} className="trend-arrow" /> : <ArrowDownRight size={10} className="trend-arrow" />}
              <span className="trend-text">{summaryCards[1].trend}</span>
            </span>
          </div>
          <div className="stats-card-value">
            <strong>{summaryCards[1].value}</strong>
          </div>
          </div>

          <div className="stats-card stats-card-right-small">
          <div className="stats-card-header">
            <span className="stats-cell-label">{summaryCards[2].label}</span>
            <span className="stats-trend-badge">
              <span className="trend-dot" style={{ backgroundColor: getTrendColor('danger') }}></span>
              {summaryCards[2].trendDirection === 'up' ? <ArrowUpRight size={10} className="trend-arrow" /> : <ArrowDownRight size={10} className="trend-arrow" />}
              <span className="trend-text">{summaryCards[2].trend}</span>
            </span>
          </div>
          <div className="stats-card-value">
            <strong>{summaryCards[2].value}</strong>
          </div>
            </div>
          </div>

          {!isProjectManager && (
            <div className="stats-right-bottom">
              <div className="stats-card stats-card-right-wide compact">
            <div className="stats-card-header">
              <span className="stats-cell-label">{summaryCards[3].label}</span>
              <span className="stats-trend-badge">
                <span className="trend-dot" style={{ backgroundColor: getTrendColor('warning') }}></span>
                {summaryCards[3].trendDirection === 'up' ? <ArrowUpRight size={10} className="trend-arrow" /> : <ArrowDownRight size={10} className="trend-arrow" />}
                <span className="trend-text">{summaryCards[3].trend}</span>
              </span>
            </div>
            <div className="stats-card-value">
              <strong>{summaryCards[3].value}</strong>
            </div>
              </div>
            </div>
          )}
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
        const regionBreakdown = Array.from(new Set(assignedProjects.map((project) => project.region).filter(Boolean))).slice(0, 4).map((region) => ({
          label: region || 'Région',
          value: assignedProjects.filter((project) => project.region === region).length,
        }))
        const axisProgress = assignedProjects.slice(0, 4).map((project) => ({
          label: project.axe_detail?.designation || project.resume || 'Projet',
          value: Number(project.dernier_avancement?.avancement_physique ?? 0),
        }))
        const nearDeadlineProjects = assignedProjects
          .filter((project) => project.date_fin_actualisee)
          .slice(0, 3)

        return (
          <>
            <div className="panel-grid dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-header__title">
                    <span className="panel-header__icon"><GridFour size={15} weight="regular" /></span>
                    <h2>Répartition par région</h2>
                  </div>
                </div>

                <div className="mini-stats">
                  {loading ? (
                    renderLoadingState()
                  ) : regionBreakdown.length === 0 ? (
                    renderActionState('Vous n’avez pas encore de marché dans ce périmètre pour la période sélectionnée.', !isProjectManager)
                  ) : (
                    regionBreakdown.map((entry) => (
                      <div key={entry.label} className="mini-stat" style={{ minHeight: 'auto' }}>
                        <small>{entry.label}</small>
                        <strong>{entry.value}</strong>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-header__title">
                    <span className="panel-header__icon"><ChartBar size={15} weight="regular" /></span>
                    <h2>Avancement par axe</h2>
                  </div>
                </div>

                <div className="alert-list">
                  {loading ? (
                    renderLoadingState()
                  ) : axisProgress.length === 0 ? (
                    renderActionState('Aucun axe n’est encore associé à votre périmètre pour cette période.', !isProjectManager)
                  ) : (
                    axisProgress.map((entry) => (
                      <div key={entry.label} className="progress-wrap" style={{ marginBottom: '0.75rem' }}>
                        <div className="progress-labels">
                          <span>{entry.label}</span>
                          <strong>{entry.value.toFixed(1)}%</strong>
                        </div>
                        <div className="progress-bar">
                          <span style={{ width: `${Math.min(entry.value, 100)}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="panel-grid dashboard-grid" style={{ gridTemplateColumns: '1.2fr 0.8fr' }}>
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-header__title">
                    <span className="panel-header__icon"><Clock size={15} weight="regular" /></span>
                    <h2>Marchés en retard ({delayedProjects.length})</h2>
                  </div>
                </div>

                <div className="alert-list">
                  {loading ? (
                    renderLoadingState()
                  ) : delayedProjects.length === 0 ? (
                    renderActionState('Vous n’avez pas encore de marché assigné. Consultez l’ensemble de vos marchés.', !isProjectManager)
                  ) : (
                    delayedProjects.slice(0, 5).map((project) => (
                      <div key={project.id} className="alert-item" style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                        <span>
                          <strong>{project.axe_detail?.designation || 'Projet'}</strong> | {project.num_marche || '—'} | {project.titulaire || 'Titulaire'}
                        </span>
                        <span>{Number(project.dernier_avancement?.avancement_physique ?? 0).toFixed(1)}%</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-header__title">
                    <span className="panel-header__icon"><CheckCircle size={15} weight="regular" /></span>
                    <h2>Échéances proches (30 j)</h2>
                  </div>
                </div>

                <div className="alert-list">
                  {loading ? (
                    renderLoadingState()
                  ) : nearDeadlineProjects.length === 0 ? (
                    renderActionState('Aucune échéance proche n’est actuellement identifiée sur votre périmètre.', !isProjectManager)
                  ) : (
                    nearDeadlineProjects.map((project) => (
                      <div key={project.id} className="alert-item" style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                        <span>{project.resume || project.description || 'Projet'}</span>
                        <span>{project.date_fin_actualisee ? new Date(project.date_fin_actualisee).toLocaleDateString('fr-FR') : '—'}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="panel" style={{ marginTop: '1rem' }}>
              <div className="panel-header">
                <div className="panel-header__title">
                  <span className="panel-header__icon"><MapPin size={15} weight="regular" /></span>
                  <h2>Carte des travaux en cours</h2>
                </div>
              </div>

              <div style={{ height: 180, borderRadius: 12, background: 'linear-gradient(135deg, rgba(59,130,246,0.10), rgba(16,185,129,0.08))', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <svg viewBox="0 0 600 180" width="100%" height="100%" preserveAspectRatio="none" aria-label="Mini carte des travaux">
                  <path d="M30 130 C110 40, 170 70, 220 120 S330 160, 390 80 S520 50, 570 120" fill="none" stroke="rgba(59,130,246,0.7)" strokeWidth="4" strokeLinecap="round" />
                  <path d="M80 30 L150 90 L250 50 L390 100 L480 30" fill="none" stroke="rgba(16,185,129,0.7)" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 8" />
                  <circle cx="120" cy="80" r="6" fill="#22c55e" />
                  <circle cx="240" cy="110" r="6" fill="#f59e0b" />
                  <circle cx="420" cy="72" r="6" fill="#ef4444" />
                  <circle cx="500" cy="90" r="6" fill="#38bdf8" />
                </svg>
              </div>
            </div>
          </>
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

