import { useEffect, useState } from 'react'
import { Building, MapPin, Ruler, SpinnerGap, User } from '@phosphor-icons/react'
import { deleteAvancement, fetchMarche } from '../../../api/travaux.api'
import { buildHash } from '../../../routes/hashRoute'
import type { AvancementItem, OSItem } from '../../../types/travaux'
import type { MarcheItem } from '../../../types/travaux'
import type { PpmRow } from '../ppm/types'
import AvancementModal from './actions/AvancementModal'
import AvancementRowActions from './actions/AvancementRowActions'
import MarcheActions from './actions/MarcheActions'
import DiscussionTab from './DiscussionTab'
import EtiquetteSituation from './EtiquetteSituation'
import RapportTab from './RapportTab'

const formatDate = (s?: string | null) => {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('fr-FR') } catch { return s }
}

const ETAPE_LABELS: Record<string, string> = {
  EXE: "En cours d'Exécution (OS délivré)",
  ETUDE: "En cours d'Étude / Montage APD",
  VISE_TECH: "Dossier Visé (Technique)",
  PASSATION: "En passation du marché",
  TEF: "Transmis pour Examen Financier (TEF)",
  AO_LANCE: "Appel d'Offres Lancé",
  EVALUATION: "En cours d'Évaluation / Attribution",
  SIGNATURE: "En cours de Signature / Approbation",
  ATTRIBUE: "Attribué (En attente OS)",
}

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
const formatMoney = (v?: number | string | null) => {
  if (v == null || v === '') return '—'
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return String(v)
  return Math.round(n).toLocaleString('fr-FR') + ' Ar'
}

type MarcheDetailPageProps = {
  marcheId: string
}

export default function MarcheDetailPage({ marcheId }: MarcheDetailPageProps) {
  const [market, setMarket] = useState<PpmRow | null>(null)
  const [marcheRaw, setMarcheRaw] = useState<MarcheItem | null>(null)
  const [tab, setTab] = useState<'detail' | 'rapport' | 'discussion'>('detail')
  const [avancements, setAvancements] = useState<AvancementItem[]>([])
  const [ordres, setOrdres] = useState<OSItem[]>([])
  const [detail, setDetail] = useState<{ longueur_totale?: number; axe_detail?: { designation?: string } } | null>(null)
  const [numMarche, setNumMarche] = useState<string | null>(null)
  const [descriptionText, setDescriptionText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingAv, setEditingAv] = useState<AvancementItem | null>(null)
  // Relevé vers lequel l'onglet Rapport doit défiler, quand on vient de
  // l'historique de l'onglet Détail.
  const [rapportFocus, setRapportFocus] = useState<string | null>(null)

  const loadMarche = async () => {
    setLoading(true)
    try {
      const m = await fetchMarche(marcheId)
      setMarcheRaw(m)
      setMarket(marcheToRow(m))
      setAvancements(m.avancements ?? [])
      setOrdres(m.ordres_service ?? [])
      setDetail({ longueur_totale: m.longueur_totale, axe_detail: m.axe_detail })
      setNumMarche(m.num_marche ?? null)
      setDescriptionText(m.description ?? null)
    } catch {
      setMarket(null)
      setAvancements([])
      setOrdres([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMarche()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marcheId])

  const goBack = () => {
    window.location.hash = buildHash({ page: 'travaux', tab: null, detailId: null })
  }

  // L'historique est rendu par l'onglet Détail. On y bascule d'abord, puis on
  // défile une fois la frame suivante atteinte, le temps que React ait monté
  // le tableau — la cible n'existe pas encore dans le DOM au moment du clic.
  const voirHistorique = () => {
    setRapportFocus(null)
    setTab('detail')
    requestAnimationFrame(() => {
      document.getElementById('historique-releves')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
        <SpinnerGap size={36} className="text-muted" />
      </div>
    )
  }

  if (!market) {
    return (
      <div className="panel" style={{ padding: 32 }}>
        <h3>Marché introuvable</h3>
        <button type="button" className="btn btn-ghost" onClick={goBack}>Retour à la liste</button>
      </div>
    )
  }

  return (
    <div className="marche-detail">
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="marche-entete marche-onglets-bar">
          <ul className="marche-onglets" role="tablist">
            {[
              { key: 'detail', label: 'Détail de marché' },
              { key: 'rapport', label: 'Rapport' },
              { key: 'discussion', label: 'Discussion' },
            ].map((option) => {
              const actif = tab === option.key
              return (
                <li key={option.key} role="presentation">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={actif}
                    className={`marche-onglet${actif ? ' is-active' : ''}`}
                    onClick={() => {
                      setTab(option.key as 'detail' | 'rapport' | 'discussion')
                      // Un clic sur l'onglet est une navigation libre : on oublie
                      // le relevé mis en avant depuis l'historique.
                      setRapportFocus(null)
                    }}
                  >
                    {option.label}
                  </button>
                </li>
              )
            })}
          </ul>

          <button type="button" className="btn btn-ghost marche-retour" onClick={goBack}>Retour</button>
        </div>
        <div className="panel-body" style={{ display: 'grid', gap: 18, padding: 0 }}>
          <div className="marche-contenu">
            {/* En-tête et pied de page décrivent le marché lui-même : ils n'ont
                de sens que dans l'onglet Détail. */}
            {tab === 'detail' && (
            <div className="row g-3">
              <div className="col-12">
                <div className="card border-0 shadow-sm bg-white rounded-3" style={{ border: '1px solid var(--border)' }}>
                  <div className="card-body p-4">
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                      <div className="flex-grow-1">
                        <div className="text-muted small fw-bold text-uppercase mb-2 border-bottom pb-2" style={{ color: 'var(--muted)' }}>
                          Description du Marché
                        </div>
                        <h4 className="fw-bold mb-2" style={{ color: 'var(--text)', margin: 0 }}>
                          {market.objet}
                        </h4>
                        {descriptionText ? (
                          <p className="text-muted small mb-2" style={{ margin: '6px 0' }}>{descriptionText}</p>
                        ) : null}
                        <div className="text-muted small">
                          <span aria-hidden="true">#</span>
                          N° Marché :
                          <strong className="text-dark" style={{ marginLeft: 6 }}>{numMarche ?? market.id}</strong>
                        </div>
                      </div>

                      <div className="text-end d-flex align-items-center gap-2 flex-wrap justify-content-end marche-description__badges">
                        {market.mdc && (
                          <div className="badge px-3 py-2" style={{ background: 'var(--hover)', color: 'var(--text)', borderRadius: 999, border: '1px solid var(--border-strong)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <Building size={14} weight="bold" />
                              {market.mdc}
                            </span>
                          </div>
                        )}
                        {detail?.longueur_totale != null && (
                          <div className="badge px-3 py-2" style={{ background: 'var(--border)', color: 'var(--text)', borderRadius: 999, border: '1px solid var(--border-strong)' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <Ruler size={14} weight="bold" />
                              {Number(detail.longueur_totale).toFixed(2)} km
                            </span>
                          </div>
                        )}
                        <MarcheActions
                          ariaLabel={`Actions marché ${market.id}`}
                          onEdit={() => { window.alert('Modifier marché — à implémenter') }}
                          onDelete={() => { if (window.confirm('Supprimer ce marché ?')) { window.alert('Suppression déclenchée — implémenter') } }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {tab === 'detail' && (
              <div>
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <div className="p-3 border rounded bg-white shadow-sm" style={{ borderColor: 'var(--border)' }}>
                      <small className="text-muted d-block fw-bold small text-uppercase mb-1">Axe</small>
                      <p className="mb-0 fw-bold small" style={{ color: 'var(--text-strong)' }}>
                        <MapPin size={14} weight="fill" style={{ color: 'var(--muted)', marginRight: 6 }} aria-hidden="true" />
                        {market.axe}
                      </p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-3 border rounded bg-white shadow-sm" style={{ borderColor: 'var(--border)' }}>
                      <small className="text-muted d-block fw-bold small text-uppercase mb-1">Titulaire</small>
                      <p className="mb-0 fw-bold small text-truncate" style={{ color: 'var(--text-strong)' }}>
                        <User size={14} weight="regular" style={{ color: 'var(--muted)', marginRight: 6 }} aria-hidden="true" />
                        {market.titulaire}
                      </p>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-3 border rounded bg-white shadow-sm d-flex align-items-center" style={{ borderColor: 'var(--border)' }}>
                      <div style={{ flex: 1 }}>
                        <small className="text-muted d-block fw-bold small text-uppercase mb-1">Financement</small>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--muted)' }} aria-hidden="true">
                            <MapPin size={14} weight="regular" />
                          </span>
                          <div style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{market.financement}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Détails saisis dans le formulaire Nouveau marché */}
                <div className="row g-3 mb-4">
                  <div className="col-12">
                    <div className="card border-0 shadow-sm bg-white rounded-3" style={{ border: '1px solid var(--border)' }}>
                      <div className="card-body p-3">
                        <h6 className="fw-bold small mb-3">Détails saisis</h6>

                        <div className="marche-detail__threecols">
                          <div className="marche-detail__group">
                            <small className="text-muted d-block fw-bold small mb-2">Identification</small>
                            <div className="table-card compact-table" style={{ width: '100%' }}>
                              <table className="table table-hover align-middle mb-0">
                                <thead className="bg-light small fw-bold text-uppercase" style={{ color: 'var(--muted)' }}>
                                  <tr>
                                    <th>CHAMP</th>
                                    <th>VALEUR</th>
                                  </tr>
                                </thead>
                                <tbody className="small">
                                  <tr>
                                    <td className="kv-label">Marché anticipé</td>
                                    <td className="kv-value">{marcheRaw?.est_anticipe ? 'Oui' : 'Non'}</td>
                                  </tr>
                                  <tr>
                                    <td className="kv-label">N° Marché</td>
                                    <td className="kv-value">{marcheRaw?.num_marche ?? '—'}</td>
                                  </tr>
                                  <tr>
                                    <td className="kv-label">Tiers / Maître d'œuvre</td>
                                    <td className="kv-value">{marcheRaw?.tiers ?? '—'}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="marche-detail__group">
                            <small className="text-muted d-block fw-bold small mb-2">Exécution</small>
                            <div className="table-card compact-table" style={{ width: '100%' }}>
                              <table className="table table-hover align-middle mb-0">
                                <thead className="bg-light small fw-bold text-uppercase" style={{ color: 'var(--muted)' }}>
                                  <tr>
                                    <th>CHAMP</th>
                                    <th>VALEUR</th>
                                  </tr>
                                </thead>
                                <tbody className="small">
                                  <tr>
                                    <td className="kv-label">Étape actuelle</td>
                                    <td className="kv-value">{marcheRaw?.etape_actuelle_display ?? ETAPE_LABELS[marcheRaw?.etape_actuelle ?? ''] ?? marcheRaw?.etape_actuelle ?? '—'}</td>
                                  </tr>
                                  <tr>
                                    <td className="kv-label">Responsable</td>
                                    <td className="kv-value">{marcheRaw?.responsable ?? '—'}</td>
                                  </tr>
                                  <tr>
                                    <td className="kv-label">Date OS</td>
                                    <td className="kv-value">{marcheRaw?.os_com ?? '—'}</td>
                                  </tr>
                                  <tr>
                                    <td className="kv-label">Délai contractuel</td>
                                    <td className="kv-value">{marcheRaw?.delai_nombre ?? '—'} {marcheRaw?.delai_unit ?? ''} {marcheRaw?.delai_jours ? `+ ${marcheRaw.delai_jours} j` : ''}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="marche-detail__group">
                            <small className="text-muted d-block fw-bold small mb-2">Financier</small>
                            <div className="table-card compact-table" style={{ width: '100%' }}>
                              <table className="table table-hover align-middle mb-0">
                                <thead className="bg-light small fw-bold text-uppercase" style={{ color: 'var(--muted)' }}>
                                  <tr>
                                    <th>CHAMP</th>
                                    <th>VALEUR</th>
                                  </tr>
                                </thead>
                                <tbody className="small">
                                  <tr>
                                    <td className="kv-label">Montant total</td>
                                    <td className="kv-value">{formatMoney(marcheRaw?.montant)}</td>
                                  </tr>
                                  <tr>
                                    <td className="kv-label">Détails financement</td>
                                    <td className="kv-value">{marcheRaw?.detail_financement ?? '—'}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        {/* Segments PK */}
                        {marcheRaw?.segments_pk && marcheRaw.segments_pk.length > 0 && (
                          <div className="marche-detail__group">
                            <small className="text-muted d-block">Tronçons</small>
                            <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {marcheRaw.segments_pk.map((s: any, idx: number) => (
                                  <div key={idx} className="badge bg-white border shadow-sm" style={{ padding: '8px 10px', borderColor: 'var(--border-strong)', color: 'var(--text)', minWidth: 160 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{s.pk_debut} → {s.pk_fin}</div>
                                    {s.description ? <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{s.description}</div> : null}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Glissements */}
                        {((marcheRaw as any)?.glissements) && (marcheRaw as any).glissements.length > 0 && (
                          <div className="marche-detail__group">
                            <small className="text-muted d-block">Glissements / Reliquats</small>
                            <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
                              {(marcheRaw as any).glissements.map((g: any, idx: number) => (
                                <li key={idx}>{g.annee_report} — {formatMoney(g.montant_reliquat)} {g.auc ? `(${g.auc})` : ''}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="card border-0 shadow-sm"
                  id="historique-releves"
                  style={{ border: '1px solid var(--border)', scrollMarginTop: 16 }}
                >
                  <div className="card-header bg-white py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                    <h6 className="mb-0 fw-bold text-dark">Historique des relevés d'avancement</h6>
                  </div>
                  <div className="table-responsive">
                    {avancements.length === 0 ? (
                      <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
                        Aucun relevé d'avancement enregistré pour ce marché.
                      </div>
                    ) : (
                      <table className="table table-hover align-middle mb-0 marche-table">
                        <thead className="bg-light small fw-bold text-uppercase" style={{ color: 'var(--muted)' }}>
                          <tr>
                            <th className="ps-3">Date</th>
                            <th>Situation</th>
                            <th className="text-center">Délai Consommé</th>
                            <th className="text-center">Physique</th>
                            <th className="text-center">Financier</th>
                            <th className="text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="small">
                          {avancements.map((av) => (
                            <tr
                              key={av.id ?? av.date_avancement}
                              // La ligne ouvre le relevé dans l'onglet Rapport, où il
                              // est restitué en entier (situation détaillée, photos).
                              onClick={() => {
                                if (av.id == null) return
                                setRapportFocus(String(av.id))
                                setTab('rapport')
                              }}
                              title="Ouvrir ce relevé dans le rapport"
                              style={{ cursor: av.id != null ? 'pointer' : 'default' }}
                            >
                              <td className="ps-3 fw-bold" style={{ color: 'var(--text-strong)' }}>{formatDate(av.date_avancement)}</td>
                              <td>
                                <EtiquetteSituation av={av} />
                              </td>
                              <td className="text-center fw-bold" style={{ color: 'var(--text-2)' }}>
                                {av.avancement_temporel != null ? `${Number(av.avancement_temporel).toFixed(1)}%` : '—'}
                              </td>
                              <td className="text-center">
                                <div className="progress mb-1" style={{ height: 6, borderRadius: 999, background: 'var(--border)' }}>
                                  <div
                                    className="progress-bar"
                                    style={{
                                      width: `${Number(av.avancement_physique)}%`,
                                      background: 'var(--muted)',
                                      borderRadius: 999,
                                    }}
                                  />
                                </div>
                                <span className="fw-bold" style={{ color: 'var(--text-strong)' }}>
                                  {Number(av.avancement_physique).toFixed(1)}%
                                </span>
                              </td>
                              <td className="text-center fw-bold">
                                {Number(av.avancement_financier).toFixed(1)}%
                              </td>
                              <td className="text-center" onClick={(event) => event.stopPropagation()}>
                                <AvancementRowActions
                                  av={av}
                                  onEdit={(a) => setEditingAv(a)}
                                  onDelete={async (a) => {
                                    if (!a.id) return
                                    if (!window.confirm('Supprimer ce relevé d\'avancement ?')) return
                                    try {
                                      await deleteAvancement(a.id)
                                      await loadMarche()
                                    } catch {
                                      alert('Impossible de supprimer le relevé.')
                                    }
                                  }}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === 'rapport' && (
              <RapportTab
                avancements={avancements}
                focusId={rapportFocus}
                onVoirHistorique={voirHistorique}
              />
            )}

            {tab === 'discussion' && <DiscussionTab marcheId={marcheId} />}

            {tab === 'detail' && (
              <div className="card border-0 shadow-sm" style={{ border: '1px solid var(--border)' }}>
                <div className="card-header bg-white py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <h6 className="mb-0 fw-bold text-dark">Actes Administratifs (OS / Avenants)</h6>
                </div>
                <div className="table-responsive">
                  {ordres.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
                      Aucun ordre de service enregistré pour ce marché.
                    </div>
                  ) : (
                    <table className="table table-hover align-middle mb-0 marche-table">
                      <thead className="bg-light small fw-bold text-uppercase" style={{ color: 'var(--muted)' }}>
                        <tr>
                          <th className="ps-3">Date d'effet</th>
                          <th>Nature de l'OS</th>
                          <th>Délai Accordé</th>
                          <th>Commentaires</th>
                        </tr>
                      </thead>
                      <tbody className="small">
                        {ordres.map((os) => (
                          <tr key={os.id ?? os.date_os}>
                            <td className="ps-3 fw-bold" style={{ color: 'var(--text-strong)' }}>{formatDate(os.date_os)}</td>
                            <td>
                              <span className="rapport-pill">
                                {os.type_os_display ?? os.type_os}
                              </span>
                            </td>
                            <td className="fw-bold" style={{ color: 'var(--text-2)' }}>
                              {os.delai_supplementaire
                                ? `+ ${os.delai_supplementaire} ${os.delai_unit_display ?? os.delai_unit ?? ''}`
                                : '—'}
                              {os.delai_jours_supplementaire
                                ? ` / ${os.delai_jours_supplementaire} j`
                                : ''}
                            </td>
                            <td className="text-muted">{os.commentaire ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {tab === 'detail' && (
            <div className="mt-4 px-2 pb-3">
              <h6 className="text-muted text-uppercase small fw-bold mb-2" style={{ color: 'var(--muted)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={14} weight="bold" />
                  Zone d'intervention
                </span>
              </h6>
              <div className="d-flex flex-wrap gap-2">
                <span className="badge rounded-pill bg-white text-dark border px-3 py-2 shadow-sm" style={{ fontSize: '0.75rem', borderColor: 'var(--border-strong)', color: 'var(--text)' }}>
                  {detail?.axe_detail?.designation ?? market.axe}
                </span>
                {market.region && (
                  <span className="badge rounded-pill bg-white text-dark border px-3 py-2 shadow-sm" style={{ fontSize: '0.75rem', borderColor: 'var(--border-strong)', color: 'var(--text)' }}>
                    {market.region}
                  </span>
                )}
              </div>
            </div>
            )}

          </div>
        </div>
      </div>

      {editingAv && (
        <div className="marche-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 160, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 40 }}>
          <div className="marche-modal-backdrop" onClick={() => setEditingAv(null)} style={{ position: 'absolute', inset: 0, background: 'var(--scrim)' }} />
          <div className="marche-modal" style={{ position: 'relative', width: 'min(860px, 96%)', maxHeight: '90vh', overflow: 'auto', zIndex: 161 }}>
            <div className="panel" style={{ margin: 0, border: 'none', boxShadow: 'none' }}>
              <div className="panel-header" style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
                <div className="panel-header__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h5 style={{ margin: 0 }}>Modifier le relevé d'avancement</h5>
                </div>
                <button type="button" className="btn btn-ghost" onClick={() => setEditingAv(null)} aria-label="Fermer la fenêtre">×</button>
              </div>

              <AvancementModal market={market} avancement={editingAv} onClose={async (refresh) => { setEditingAv(null); if (refresh) await loadMarche() }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
