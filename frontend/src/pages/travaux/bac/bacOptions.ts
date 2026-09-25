/**
 * Choix du modèle `Bac`, dupliqués depuis Django.
 * Source de vérité : TPAPP/travaux/models.py (classe Bac).
 * Le backend valide de toute façon : toute valeur ajoutée ici doit exister là-bas.
 */

export const REGION_CHOICES = [
  { value: 'ANALAMANGA', label: 'Analamanga' },
  { value: 'VAKINANKARATRA', label: 'Vakinankaratra' },
  { value: 'ITASY', label: 'Itasy' },
  { value: 'BONGOLAVA', label: 'Bongolava' },
  { value: 'SAVA', label: 'Sava' },
  { value: 'DIANA', label: 'Diana' },
  { value: 'MATSIATRA_AMBONY', label: 'Matsiatra Ambony' },
  { value: 'AMORON_I_MANIA', label: "Amoron'i Mania" },
  { value: 'VATOVAVY', label: 'Vatovavy' },
  { value: 'FITOVINANY', label: 'Fitovinany' },
  { value: 'IHOROMBE', label: 'Ihorombe' },
  { value: 'ATSIMO_ATSINANANA', label: 'Atsimo-Atsinanana' },
  { value: 'BOENY', label: 'Boeny' },
  { value: 'SOFIA', label: 'Sofia' },
  { value: 'BETSIBOKA', label: 'Betsiboka' },
  { value: 'MELAKY', label: 'Melaky' },
  { value: 'ATSINANANA', label: 'Atsinanana' },
  { value: 'ALAOTRA_MANGORO', label: 'Alaotra-Mangoro' },
  { value: 'ANALANJIROFO', label: 'Analanjirofo' },
  { value: 'ATSIMO_ANDREFANA', label: 'Atsimo-Andrefana' },
  { value: 'ANDROY', label: 'Androy' },
  { value: 'ANOSY', label: 'Anosy' },
  { value: 'MENABE', label: 'Menabe' },
] as const

export const PROPULSION_CHOICES = [
  { value: 'Moteur', label: 'Moteur' },
  { value: 'Perche', label: 'Perche' },
  { value: 'Treuil', label: 'Treuil' },
  { value: 'Treuil_a_moteur', label: 'Treuil à moteur' },
] as const

export const ETAT_BAC_CHOICES = [
  { value: 'Operationel', label: 'Opérationnel' },
  { value: 'En maintenance', label: 'En maintenance' },
  { value: 'Fonctionnel_degrade', label: 'Fonctionnel avec dégradation' },
  { value: 'degrade', label: 'Dégradé' },
  { value: 'Hors_usage', label: "Hors d'usage" },
] as const

export const FINANCEMENT_CHOICES = [
  { value: 'ACQUIS', label: 'Acquis' },
  { value: 'A RECHERCHER', label: 'À rechercher' },
] as const

export const EMPLOYEUR_PASSEUR_CHOICES = [
  { value: 'DRTP', label: 'DRTP' },
  { value: 'AR', label: 'AR' },
  { value: 'DRTP/AR', label: 'DRTP / AR' },
] as const
