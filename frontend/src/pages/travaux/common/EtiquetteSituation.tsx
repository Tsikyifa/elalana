import type { AvancementItem } from '../../../types/travaux'

type Ton = 'success' | 'warning' | 'danger' | 'neutral'

/**
 * Couleur du point de statut : orange tant que le chantier court, vert une
 * fois achevé, rouge dès qu'il est arrêté, résilié ou en retard. Elle ne
 * quitte jamais le point — la pastille qui le porte reste grise.
 */
const tonSituation = (av: AvancementItem): Ton => {
  if (av.est_en_retard) return 'danger'
  switch (av.situation_w) {
    case 'Acheve':
      return 'success'
    case 'Arrete':
    case 'Résilié':
      return 'danger'
    case 'En_cours':
      return 'warning'
    default:
      return 'neutral'
  }
}

/**
 * Statut d'un relevé, restitué à l'identique partout où un relevé est montré :
 * l'historique de l'onglet Détail et le compte rendu de l'onglet Rapport
 * doivent dire la même chose de la même façon.
 */
export default function EtiquetteSituation({ av }: { av: AvancementItem }) {
  return (
    <span className="rapport-pill">
      <span className={`rapport-pill__dot rapport-pill__dot--${tonSituation(av)}`} aria-hidden="true" />
      {av.situation_w_display ?? av.situation_w}
    </span>
  )
}
