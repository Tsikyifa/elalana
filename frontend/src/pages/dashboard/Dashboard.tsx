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
  Wallet,
} from '@phosphor-icons/react'
import { fetchDashboardStats } from '../../api/travaux.api'
import type { DashboardStatsResponse } from '../../types/travaux'

const formatCurrency = (val: number = 0) => `${Math.round(val).toLocaleString('fr-FR')} Ar`


export function Dashboard() {
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStats = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchDashboardStats()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des statistiques')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  const summaryCards = [
    {
      label: 'Budget engagé',
      value: stats ? formatCurrency(stats.summary_cards.budget_engage) : '—',
      tone: 'primary',
      icon: Wallet,
      trend: stats ? `${(stats.recap_financement ?? []).reduce((s, r) => s + r.total, 0)} marchés` : 'Chargement…',
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

  const recapFinancement = stats?.recap_financement ?? []
  const alerts = stats?.alerts ?? []
  const aucProgress = stats?.auc_stats.progression_pct ?? 0

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
      <div className="page-header">
        <div>
          <p className="section-kicker">Vue Générale MTP</p>
          <h1>Tableau de bord décisionnel</h1>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={loadStats}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <ArrowsClockwise size={16} className={loading ? 'icon-spin' : ''} />
          <span>{loading ? 'Actualisation...' : 'Actualiser'}</span>
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      <div className="stats-row">
        {/* Budget engagé (main) */}
        <div className="stats-card stats-card-main">
          <div className="stats-card-header">
            <span className="stats-card-label">Budget engagé</span>
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
              <path d="M0,28 C15,20 30,16 45,18 C60,20 75,16 90,12 L100,10 L100,36 L0,36 Z" fill="url(#budgetGradient)" stroke="none" />
              <path d="M0,28 C15,20 30,16 45,18 C60,20 75,16 90,12 95,11" fill="none" stroke="rgba(59,130,246,0.95)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="95" cy="11" r="3" fill="rgba(59,130,246,0.95)" />
            </svg>
          </div>
        </div>

        {/* Right group: asymmetric layout */}
        <div className="stats-right">
          <div className="stats-right-top">
            {/* Avancement physique (slightly larger) */}
            <div className="stats-card stats-card-right-large">
          <div className="stats-card-header">
            <span className="stats-cell-label">Avancement physique</span>
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

          {/* Marchés en retard (slightly smaller) */}
          <div className="stats-card stats-card-right-small">
          <div className="stats-card-header">
            <span className="stats-cell-label">Marchés en retard</span>
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

          <div className="stats-right-bottom">
            {/* Reliquats glissements (compact height, spans full width of right column) */}
            <div className="stats-card stats-card-right-wide compact">
          <div className="stats-card-header">
            <span className="stats-cell-label">Reliquats glissements</span>
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
        </div>
      </div>

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
    </section>
  )
}

