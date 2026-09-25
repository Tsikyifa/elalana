import { apiGet } from './client'

export type AudienceItem = {
  id: number
  name: string
  status: string
}

export function fetchAudience() {
  return apiGet<AudienceItem[]>('/audience/')
}
