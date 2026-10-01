export type PpmRow = {
  id: string
  axe_id?: string
  objet: string
  axe: string
  region: string
  mdc: string
  titulaire: string
  financement: string
  type_axe: string
  temporel: string
  physique: string
  financier: string
  situation: string
  en_retard: boolean
  pk_debut?: number | null
  pk_fin?: number | null
}

export type PpmGroup = {
  title: string
  items: PpmRow[]
}

