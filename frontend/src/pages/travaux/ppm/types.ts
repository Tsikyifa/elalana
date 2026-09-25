export type PpmRow = {
  id: string
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
}

export type PpmGroup = {
  title: string
  items: PpmRow[]
}

