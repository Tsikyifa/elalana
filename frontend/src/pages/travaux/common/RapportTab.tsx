import { useEffect, useState } from 'react'
import {
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  ClockCounterClockwise,
  MagnifyingGlassPlus,
  Paperclip,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import type { AvancementItem, MediaAvancementItem } from '../../../types/travaux'
import EtiquetteSituation from './EtiquetteSituation'

const formatDate = (s?: string | null) => {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('fr-FR') } catch { return s }
}

const CARD = { border: '1px solid var(--border)' } as const
// Jeton plutôt que la valeur littérale : la même règle vaut pour les deux thèmes.
const CARD_SEPARATOR = { borderBottom: '1px solid var(--border)' } as const

/** Le compte rendu n'ouvre que le relevé le plus récent ; les chevrons du bas
 *  déplient ensuite les précédents, par groupes de cette taille. */
const RELEVES_INITIAUX = 1
const RELEVES_PAR_PALIER = 1

/** Au-delà de cet écart, avancement physique et financier ne racontent plus
 *  la même histoire et méritent d'être signalés. */
const ECART_SIGNIFICATIF = 20

/**
 * Jauge de progression, volontairement neutre : la longueur et le pourcentage
 * chiffré suffisent à lire le niveau, une échelle de couleurs ajouterait du
 * bruit sans rien dire de plus.
 */
function Jauge({ label, valeur }: { label: string; valeur: number }) {
  const borne = Math.min(Math.max(valeur, 0), 100)
  return (
    <div className="rapport-jauge">
      <div className="d-flex justify-content-between align-items-baseline mb-2">
        <small className="text-muted fw-bold text-uppercase" style={{ fontSize: '0.68rem' }}>{label}</small>
        <span className="fw-bold" style={{ color: 'var(--text-strong)' }}>{valeur.toFixed(1)}%</span>
      </div>
      <div className="rapport-jauge__track">
        <div
          className="rapport-jauge__fill"
          style={{ width: `${borne}%` }}
          role="progressbar"
          aria-valuenow={Math.round(valeur)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
      </div>
    </div>
  )
}

/**
 * Alerte d'écart entre avancement physique et financier. Un chantier payé à
 * 50 % pour 10 % de travaux exécutés dérive : la dépense précède l'ouvrage.
 * Ne rend rien tant que l'écart reste dans les clous, conteneur compris —
 * la marge est donc reçue de l'appelant pour ne pas laisser de blanc.
 */
function AlerteEcart({
  physique,
  financier,
  className = '',
}: {
  physique: number
  financier: number
  className?: string
}) {
  const ecart = Math.abs(physique - financier)
  if (ecart <= ECART_SIGNIFICATIF) return null

  const sens =
    physique > financier
      ? "L'avancement physique dépasse le financier : la facturation est en retard sur les travaux."
      : "L'avancement financier dépasse le physique : le marché est payé au-delà des travaux exécutés."

  return (
    <div className={className}>
      <span className="rapport-alerte" title={sens}>
        <WarningCircle size={13} weight="fill" aria-hidden="true" />
        Écart important ({ecart.toFixed(0)} pts)
      </span>
    </div>
  )
}

/** Pièces jointes du relevé : photos en grille de vignettes, autres fichiers en lien. */
function PiecesJointes({ medias }: { medias?: MediaAvancementItem[] }) {
  // Index de la photo ouverte en aperçu ; `null` quand la modale est fermée.
  const [apercu, setApercu] = useState<number | null>(null)

  const images = (medias ?? []).filter((m) => m.est_image && m.fichier_url)
  const autres = (medias ?? []).filter((m) => !m.est_image && m.fichier_url)
  const nombre = images.length
  const photo = apercu === null ? undefined : images[apercu]
  // Position affichée dans la modale, à partir de 1.
  const position = apercu === null ? 0 : apercu + 1

  // Navigation circulaire : on ne bute pas sur les extrémités de la série.
  const reculer = () => setApercu((i) => (i === null ? i : (i - 1 + nombre) % nombre))
  const avancer = () => setApercu((i) => (i === null ? i : (i + 1) % nombre))

  // L'aperçu se pilote au clavier comme à la souris. Tant qu'il est ouvert, la
  // page derrière ne doit pas défiler sous la modale : on gèle le document, et
  // on lui rend son style d'origine à la fermeture.
  const ouvert = photo !== undefined
  useEffect(() => {
    if (!ouvert) return

    const auClavier = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setApercu(null)
      else if (event.key === 'ArrowLeft') reculer()
      else if (event.key === 'ArrowRight') avancer()
    }
    window.addEventListener('keydown', auClavier)

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', auClavier)
      document.body.style.overflow = overflow
    }
    // Les mises à jour passent par la forme fonctionnelle : la position courante
    // n'a pas à figurer ici, seule compte l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, nombre])

  if (images.length === 0 && autres.length === 0) {
    return <p className="text-muted small mb-0">Aucune pièce jointe pour ce relevé.</p>
  }

  return (
    <>
      {images.length > 0 && (
        <div className="rapport-medias">
          {images.map((m, index) => (
            <figure key={m.id} style={{ margin: 0 }}>
              <button
                type="button"
                className="rapport-media__frame"
                onClick={() => setApercu(index)}
                title={m.legende || 'Agrandir la photo'}
              >
                <img
                  className="rapport-media__image"
                  src={m.fichier_url ?? ''}
                  alt={m.legende || 'Photo du relevé'}
                  loading="lazy"
                />
                <span className="rapport-media__zoom" aria-hidden="true">
                  <MagnifyingGlassPlus size={20} weight="bold" />
                </span>
              </button>
              {m.legende ? (
                <figcaption className="text-muted small mt-1">{m.legende}</figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      )}

      {/* Les pièces non image (PDF…) ne s'affichent pas en grand : elles
          gardent leur lien, faute de visionneuse dans l'application. */}
      {autres.length > 0 && (
        <div className="d-flex flex-column align-items-start gap-2" style={{ marginTop: images.length > 0 ? 12 : 0 }}>
          {autres.map((m) => (
            <a
              key={m.id}
              href={m.fichier_url ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="d-inline-flex align-items-center gap-2 small border rounded px-3 py-2"
              style={{ borderColor: 'var(--border)', color: 'var(--text)', textDecoration: 'none' }}
            >
              <Paperclip size={14} weight="bold" aria-hidden="true" />
              {m.legende || 'Pièce jointe'}
            </a>
          ))}
        </div>
      )}

      {photo && (
        <div
          className="rapport-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Aperçu de la pièce jointe"
          // Tout clic qui n'atteint pas l'image ferme l'aperçu ; la figure
          // arrête la propagation pour se protéger de ce repli.
          onClick={() => setApercu(null)}
        >
          <button
            type="button"
            className="rapport-lightbox__close"
            onClick={() => setApercu(null)}
            aria-label="Fermer l'aperçu"
            autoFocus
          >
            <X size={20} weight="bold" aria-hidden="true" />
          </button>

          {nombre > 1 && (
            <button
              type="button"
              className="rapport-lightbox__nav rapport-lightbox__nav--precedent"
              onClick={(event) => { event.stopPropagation(); reculer() }}
              aria-label="Photo précédente"
            >
              <CaretLeft size={20} weight="bold" aria-hidden="true" />
            </button>
          )}

          <figure className="rapport-lightbox__figure" onClick={(event) => event.stopPropagation()}>
            <img
              className="rapport-lightbox__image"
              src={photo.fichier_url ?? ''}
              alt={photo.legende || 'Photo du relevé'}
            />
            <figcaption className="rapport-pill">
              {photo.legende || 'Photo du relevé'}
              {nombre > 1 && (
                <span className="rapport-lightbox__compteur">{position} / {nombre}</span>
              )}
            </figcaption>
          </figure>

          {nombre > 1 && (
            <button
              type="button"
              className="rapport-lightbox__nav rapport-lightbox__nav--suivant"
              onClick={(event) => { event.stopPropagation(); avancer() }}
              aria-label="Photo suivante"
            >
              <CaretRight size={20} weight="bold" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </>
  )
}

type RapportTabProps = {
  avancements: AvancementItem[]
  /** Relevé à mettre en avant et à amener sous les yeux, si l'on arrive depuis
   *  l'historique de l'onglet Détail. */
  focusId?: string | null
  /** Bascule sur l'historique complet des relevés, qui vit dans l'onglet Détail. */
  onVoirHistorique?: () => void
}

/**
 * Onglet « Rapport » : le compte rendu de suivi du marché, construit à partir
 * des relevés d'avancement. Chaque relevé y est restitué tel qu'il a été saisi —
 * date, situation, indicateurs, situation détaillée, observations, pièces jointes.
 */
export default function RapportTab({ avancements, focusId = null, onVoirHistorique }: RapportTabProps) {
  // Nombre de relevés dépliés par l'utilisateur. `null` tant qu'il n'a pas
  // touché au pliage : seule la sélection venue de l'historique décide alors
  // du nombre de cartes ouvertes.
  const [visibles, setVisibles] = useState<number | null>(null)

  // L'API renvoie les relevés du plus récent au plus ancien ; on sécurise le tri
  // ici pour que la série s'affiche toujours dans le même ordre.
  const chronologique = [...avancements].sort(
    (a, b) => new Date(b.date_avancement).getTime() - new Date(a.date_avancement).getTime(),
  )

  // Un relevé mis en avant depuis l'historique peut tomber au-delà du premier
  // palier : on déplie juste ce qu'il faut pour qu'il soit rendu, sans quoi le
  // défilement n'aurait pas de cible. Ce plancher ne vaut que tant que
  // l'utilisateur n'a pas repris la main — sinon « Voir moins » se heurterait à
  // lui et la liste refuserait de se replier.
  const indexCible = focusId == null ? -1 : chronologique.findIndex((av) => String(av.id) === focusId)
  const plancher = visibles === null ? indexCible + 1 : 0
  const nombreAffiche = Math.max(visibles ?? RELEVES_INITIAUX, plancher)
  const affiches = chronologique.slice(0, nombreAffiche)
  const restants = chronologique.length - affiches.length
  const repliable = nombreAffiche > RELEVES_INITIAUX

  // L'effet est déclaré avant le retour anticipé : les hooks doivent être
  // appelés dans le même ordre à chaque rendu.
  useEffect(() => {
    if (focusId == null) return
    const cible = document.getElementById(`releve-${focusId}`)
    cible?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focusId])

  if (avancements.length === 0) {
    return (
      <div className="card border-0 shadow-sm" style={CARD}>
        <div className="card-header bg-white py-3" style={CARD_SEPARATOR}>
          <h6 className="mb-0 fw-bold text-dark">Rapport de suivi</h6>
        </div>
        <div className="card-body">
          <p className="text-muted small mb-0">
            Aucun relevé d'avancement enregistré pour ce marché : le rapport sera généré
            à partir du premier relevé saisi.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h6 className="text-muted text-uppercase small fw-bold mb-0" style={{ color: 'var(--muted)' }}>
          Compte rendu des relevés d'avancement
        </h6>
        {onVoirHistorique && (
          <button type="button" className="rapport-lien" onClick={onVoirHistorique}>
            <ClockCounterClockwise size={14} weight="bold" aria-hidden="true" />
            Voir l'historique complet
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {affiches.map((av, index) => {
          const estCible = focusId != null && String(av.id) === focusId

          return (
          <div
            key={av.id ?? av.date_avancement}
            id={av.id != null ? `releve-${av.id}` : undefined}
            className="card border-0 shadow-sm"
            style={{
              border: estCible ? '1px solid var(--border-strong)' : '1px solid var(--border)',
              // Le défilement s'arrête un peu avant la carte, pas collé au bord.
              scrollMarginTop: 16,
            }}
          >
            <div
              className="card-header bg-white py-3 d-flex justify-content-between align-items-center flex-wrap gap-2"
              style={CARD_SEPARATOR}
            >
              <div>
                <div className="fw-bold" style={{ color: 'var(--text-strong)' }}>
                  Relevé du {formatDate(av.date_avancement)}
                </div>
                <div className="text-muted small">
                  {index === 0 ? 'Relevé le plus récent' : `Relevé n°${chronologique.length - index}`}
                </div>
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <EtiquetteSituation av={av} />
                {av.est_en_retard && (
                  <span className="rapport-pill">
                    <WarningCircle size={13} weight="fill" style={{ color: 'var(--danger)' }} aria-hidden="true" />
                    En retard
                  </span>
                )}
              </div>
            </div>

            <div className="card-body">
              <div className="row g-4">
                {/* Colonne gauche : indicateurs et compte rendu écrit */}
                <div className="col-lg-7">
                  <small className="text-muted d-block fw-bold text-uppercase mb-2" style={{ fontSize: '0.68rem' }}>
                    Indicateurs
                  </small>
                  <div className="d-flex flex-column gap-2 mb-3">
                    <Jauge label="Avancement physique" valeur={Number(av.avancement_physique ?? 0)} />
                    <Jauge label="Avancement financier" valeur={Number(av.avancement_financier ?? 0)} />
                    <Jauge label="Délai consommé" valeur={Number(av.avancement_temporel ?? 0)} />
                  </div>

                  <AlerteEcart
                    className="mb-3"
                    physique={Number(av.avancement_physique ?? 0)}
                    financier={Number(av.avancement_financier ?? 0)}
                  />

                  <small className="text-muted d-block fw-bold text-uppercase mb-2" style={{ fontSize: '0.68rem' }}>
                    Situation détaillée
                  </small>
                  <div className="rapport-note mb-3">
                    {av.detail_situation?.trim() || <span className="text-muted fst-italic">Aucun détail saisi.</span>}
                  </div>

                  <small className="text-muted d-block fw-bold text-uppercase mb-2" style={{ fontSize: '0.68rem' }}>
                    Observations particulières
                  </small>
                  <div className="rapport-note">
                    {av.observation?.trim() || <span className="text-muted fst-italic">Aucune observation.</span>}
                  </div>
                </div>

                {/* Colonne droite : pièces jointes du relevé */}
                <div className="col-lg-5">
                  <small className="text-muted d-block fw-bold text-uppercase mb-2" style={{ fontSize: '0.68rem' }}>
                    Pièces jointes
                  </small>
                  <PiecesJointes medias={av.medias} />
                </div>
              </div>
            </div>
          </div>
          )
        })}
      </div>

      {(repliable || restants > 0) && (
        <div className="d-flex justify-content-center align-items-center gap-2 mt-3">
          {repliable && (
            <button
              type="button"
              className="rapport-depliage"
              onClick={() => setVisibles(RELEVES_INITIAUX)}
            >
              Voir moins
              <CaretUp size={18} weight="bold" aria-hidden="true" />
            </button>
          )}
          {restants > 0 && (
            <button
              type="button"
              className="rapport-depliage"
              onClick={() => setVisibles(nombreAffiche + RELEVES_PAR_PALIER)}
              // Le décompte reste en infobulle : il n'a pas sa place dans un
              // libellé qui doit rester court.
              title={`${restants} relevé${restants > 1 ? 's' : ''} plus ancien${restants > 1 ? 's' : ''}`}
            >
              Voir plus
              <CaretDown size={18} weight="bold" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
