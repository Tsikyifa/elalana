export type Travaux = {
  id: string
  num_marche?: string
  description?: string
  resume?: string
  titulaire?: string
  montant?: number | string
  status?: string
}

export type AnnuaireContact = {
  id: string
  nom?: string
  fonction?: string
  region?: string
  telephone?: string
  telephone1?: string
  whatsapp?: string
  whatsapp1?: string
  email?: string
}

/** Axe routier, tel que renvoyé par /api/travaux/axes/ (lecture seule). */
export type AxeOption = {
  id: string
  designation: string
  type_axe?: string
  type_axe_display?: string
  longueur_total?: number | string
}

/**
 * Bac de traversée, tel que renvoyé par /api/travaux/bacs/.
 */
export type BacItem = {
  id: number
  axe?: string | null
  axe_detail?: AxeOption | null
  region?: string
  region_display?: string
  localite?: string
  pk_bac?: string | number | null
  riviere?: string
  longitude?: string | number | null
  latitude?: string | number | null

  // Caractéristiques techniques
  propulsion?: string
  portance?: string | number
  nbr_capacite?: string | number
  longueur_travers?: string | number
  constructeur?: string

  // Gestion et personnel
  gestionnaire?: string
  chef_bac?: string
  employeur_passeur?: string
  nbre_passeur_fonc?: string | number | null
  nbre_passeur_ecd?: string | number | null
  nbre_passeur_ar?: string | number | null

  // État et maintenance
  etat_bac?: string
  etat_bac_display?: string
  detail_etat_bac?: string
  observation?: string
  annee_entretien?: string | number | null
  annee_acquisition?: string | number | null
  image?: string | null

  // Finances et projets
  besoin_entretien_bac?: string | number | null
  etat_financement_bac?: string | null
  etat_financement_display?: string | null
  annee_exercice?: string | number | null
  projet_en_cours?: string
  projet_en_perspective?: string
}

export type ConventionProgrammeItem = {
  id: number | string
  axe: string
  axe_detail?: AxeOption
  section: string
  region: string
  region_display?: string
  annee: number | string
  pk_debut: string | number
  localite_deb?: string
  pk_fin: string | number
  localite_fin?: string
  longueur?: string | number
  longueur_traite?: string | number
  nature_surface?: string
  nature_surface_display?: string
  montant_minima?: number | string
  montant_souhaite?: number | string
  created_at?: string
  updated_at?: string
}

export type PKMarcheItem = {
  id?: number | string
  marche?: string
  pk_debut: number | string
  pk_fin: number | string
  description?: string
}

export type OSItem = {
  id?: number | string
  marche: string
  type_os: 'COMMENCEMENT' | 'ARRET' | 'REPRISE' | 'AVENANT_DELAI'
  type_os_display?: string
  date_os: string
  delai_supplementaire?: number
  delai_unit?: 'JOUR' | 'SEMAINE' | 'MOIS'
  delai_unit_display?: string
  delai_jours_supplementaire?: number
  os_arret_concerne?: number | null
  commentaire?: string
}

/**
 * Pièce jointe d'un relevé d'avancement (photo de chantier, PDF…).
 * `fichier_url` est une URL absolue fournie par l'API.
 */
export type MediaAvancementItem = {
  id: number | string
  fichier?: string | null
  fichier_url?: string | null
  legende?: string
  date_upload?: string
  est_image?: boolean
}

export type AvancementItem = {
  id?: number | string
  marche: string
  date_avancement: string
  avancement_physique: number | string
  avancement_financier: number | string
  situation_w: 'En_cours' | 'Arrete' | 'Acheve' | 'Résilié'
  situation_w_display?: string
  detail_situation?: string
  observation?: string
  avancement_temporel?: number
  est_en_retard?: boolean
  /** Présent sur le détail d'un marché (`/travaux/marches/<id>/`). */
  medias?: MediaAvancementItem[]
}

/** Message du fil de discussion d'un marché. */
export type MessageMarcheItem = {
  id: number | string
  marche: string
  auteur?: number | null
  auteur_nom: string
  contenu: string
  fichier?: string | null
  fichier_url?: string | null
  fichier_nom?: string | null
  fichier_taille?: number | null
  est_image?: boolean
  created_at: string
  /** Vrai si le message a été écrit par l'utilisateur connecté. */
  est_moi: boolean
}

export type MarcheItem = {
  id: string
  num_marche?: string
  axe: string
  region?: string
  axe_detail?: AxeOption
  description?: string
  resume: string
  categorie?: string
  responsable?: string
  financement: string
  financement_display?: string
  detail_financement?: string
  tiers?: string
  montant?: number | string
  titulaire?: string
  os_com?: string | null
  delai_unit?: string
  delai_nombre?: number | null
  delai_jours?: number
  est_anticipe?: boolean
  etape_actuelle?: string
  etape_actuelle_display?: string
  dernier_avancement?: {
    avancement_physique: number
    avancement_financier: number
    avancement_temporel: number
    situation_w: string
    situation_w_display: string
    est_en_retard: boolean
  }
  date_demarrage_effective?: string | null
  date_fin_actualisee?: string | null
  longueur_totale?: number
  segments_pk?: PKMarcheItem[]
  ordres_service?: OSItem[]
  avancements?: AvancementItem[]
}

export type TravauxGlisseItem = {
  id: number | string
  axe: string
  axe_detail?: AxeOption
  marche: string
  marche_detail?: MarcheItem
  auc?: string
  auc_display?: string
  date_auc?: string | null
  passation?: string
  passation_display?: string
  observation?: string
  annee_origine: number
  annee_report: number
  montant_reliquat: number | string
}

export type DashboardStatsResponse = {
  summary_cards: {
    budget_engage: number
    avancement_physique: number
    marches_en_retard: number
    marches_acheves: number
    reliquats_glissements: number
  }
  recap_financement: Array<{
    type: string
    details: {
      En_ph: number
      En_passation: number
      En_cours: number
      Arrete: number
      Acheve: number
    }
    total: number
    retard: number
  }>
  bac_stats: {
    total: number
    operationnels: number
    hors_usage: number
    besoin_entretien: number
    propulsion: Record<string, number>
  }
  auc_stats: {
    obtenues: number
    en_attente: number
    progression_pct: number
  }
  alerts: string[]
}

