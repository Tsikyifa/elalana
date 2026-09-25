import { useEffect, useState } from 'react'
import { fetchGlissements } from '../../../api/travaux.api'
import type { TravauxGlisseItem } from '../../../types/travaux'

type GlissementItem = {
  id: number | string
  marche: {
    axe: { nom: string }
    resume?: string
    num_marche?: string
    titulaire?: string
  }
  montant_reliquat?: number | string
  annee_origine?: number | string
  auc?: string
  date_auc?: string
  passation?: string
  dernier_pourcentage?: number
  observation?: string
}

function apiToLocal(g: TravauxGlisseItem): GlissementItem {
  return {
    id: g.id,
    marche: {
      axe: { nom: g.axe_detail?.designation ?? g.axe ?? '—' },
      resume: g.marche_detail?.resume ?? g.marche_detail?.description ?? undefined,
      num_marche: g.marche_detail?.num_marche ?? undefined,
      titulaire: g.marche_detail?.titulaire ?? undefined,
    },
    montant_reliquat: g.montant_reliquat,
    annee_origine: g.annee_origine,
    auc: g.auc_display ?? g.auc,
    date_auc: g.date_auc ?? undefined,
    passation: g.passation_display ?? g.passation,
    dernier_pourcentage: g.marche_detail?.dernier_avancement?.avancement_physique
      ? Number(g.marche_detail.dernier_avancement.avancement_physique)
      : undefined,
    observation: g.observation,
  }
}

export function GlissementsView() {
  const [items, setItems] = useState<GlissementItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchGlissements(2026)
      .then((data) => setItems((data ?? []).map(apiToLocal)))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="panel-header">
          <div className="panel-header__title">
            <div>
              <h3 style={{ margin: 0 }}>Suivi des Reports Budgétaires</h3>
              <div className="small" style={{ color: 'var(--muted)' }}>Exercice 2026 — {items.length} marché(s) en glissement</div>
            </div>
          </div>
          <div>
            <button className="btn btn-ghost" onClick={() => window.print()}>Exporter PDF</button>
          </div>
        </div>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Identification du Marché</th>
              <th style={{ width: 180, textAlign: 'center' }}>Financement & Reliquat</th>
              <th style={{ width: 140, textAlign: 'center' }}>Statut AUC</th>
              <th style={{ width: 120, textAlign: 'center' }}>Passation</th>
              <th style={{ width: 170, textAlign: 'center' }}>Exécution Phys.</th>
              <th>Observations / Motifs</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center" style={{ padding: 30 }}>Chargement…</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center">
                  <div className="empty-state">Aucun marché en glissement répertorié pour cet exercice.</div>
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr key={item.id}>
                  <td className="bac-row-index">{idx + 1}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span className="badge badge-primary">{item.marche.axe.nom}</span>
                      <div style={{ fontWeight: 700 }}>{item.marche.resume ?? '(Pas d\'objet défini)'}</div>
                      <small className="text-muted">#{item.marche.num_marche}</small>
                      <small style={{ fontWeight: 600 }}>{item.marche.titulaire}</small>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700 }}>{typeof item.montant_reliquat === 'number' ? `${item.montant_reliquat.toLocaleString()} Ar` : item.montant_reliquat ?? '—'}</div>
                    <small className="text-muted">Origine : {item.annee_origine ?? '—'}</small>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {item.auc === 'Obtenue' ? (
                      <span className="badge badge-success">{item.auc}</span>
                    ) : (
                      <span className="badge badge-warning">{item.auc ?? '—'}</span>
                    )}
                    {item.date_auc && <small className="text-muted" style={{ display: 'block' }}>{new Date(item.date_auc).toLocaleDateString()}</small>}
                  </td>
                  <td style={{ textAlign: 'center' }}>{item.passation ?? '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div className="progress-bar" style={{ height: 8 }}>
                      <span style={{ width: `${item.dernier_pourcentage ?? 0}%` }} />
                    </div>
                    <div style={{ fontWeight: 700, marginTop: 6 }}>{item.dernier_pourcentage ?? 0}%</div>
                  </td>
                  <td>
                    <div className="small text-muted" style={{ maxWidth: 260 }}>{item.observation ?? 'Aucune observation'}</div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default GlissementsView
