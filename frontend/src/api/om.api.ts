import { apiGet } from './client'

export type OMItem = {
  id: number
  label: string
  state: string
}

export function fetchOM() {
  return apiGet<OMItem[]>('/om/')
}
