import { apiDelete, apiGet, apiPatch, apiPost, apiPostForm } from './client'
import type {
  AnnuaireContact,
  AvancementItem,
  AxeOption,
  BacItem,
  ConventionProgrammeItem,
  DashboardStatsResponse,
  MarcheItem,
  MessageMarcheItem,
  OSItem,
  Travaux,
  TravauxGlisseItem,
} from '../types/travaux'

export type TravauxListItem = {
  id: string
  name: string
  status: string
  progress: number
}

export function fetchTravaux() {
  return apiGet<Travaux[]>('/travaux/')
}

export function fetchAnnuaire() {
  return apiGet<AnnuaireContact[]>('/travaux/annuaire/')
}

export function fetchBacs() {
  return apiGet<BacItem[]>('/travaux/bacs/')
}

/** Axes routiers, pour le sélecteur « Axe routier ». */
export function fetchAxes() {
  return apiGet<AxeOption[]>('/travaux/axes/')
}

export function createBac(payload: Record<string, unknown>, image?: File | null) {
  const cleaned = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== '' && value !== undefined && value !== null),
  )

  if (image) {
    const form = new FormData()
    for (const [key, value] of Object.entries(cleaned)) {
      form.append(key, String(value))
    }
    form.append('image', image)
    return apiPostForm<BacItem>('/travaux/bacs/', form)
  }

  return apiPost<BacItem>('/travaux/bacs/', cleaned)
}

export function updateBac(id: string | number, payload: Record<string, unknown>) {
  const cleaned = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== '' && value !== undefined && value !== null),
  )

  return apiPatch<BacItem>(`/travaux/bacs/${id}/`, cleaned)
}

export function deleteBac(id: string | number) {
  return apiDelete(`/travaux/bacs/${id}/`)
}

// ==========================================
// TABLEAU DE BORD DÉCISIONNEL (STATS)
// ==========================================
export function fetchDashboardStats() {
  return apiGet<DashboardStatsResponse>('/travaux/stats/dashboard/')
}

// ==========================================
// MARCHÉS (PPM / SUIVI DES TRAVAUX)
// ==========================================
export function fetchMarches(params?: { q?: string; axe?: string; status_scope?: string; financement?: string }) {
  const query = new URLSearchParams()
  if (params?.q) query.append('q', params.q)
  if (params?.axe) query.append('axe', params.axe)
  if (params?.status_scope) query.append('status_scope', params.status_scope)
  if (params?.financement) query.append('financement', params.financement)

  const queryString = query.toString() ? `?${query.toString()}` : ''
  return apiGet<MarcheItem[]>(`/travaux/marches/${queryString}`)
}

export function fetchMarche(id: string) {
  return apiGet<MarcheItem>(`/travaux/marches/${id}/`)
}

export function createMarche(payload: Partial<MarcheItem>) {
  return apiPost<MarcheItem>('/travaux/marches/', payload)
}

export function updateMarche(id: string, payload: Partial<MarcheItem>) {
  return apiPatch<MarcheItem>(`/travaux/marches/${id}/`, payload)
}

export function deleteMarche(id: string) {
  return apiDelete(`/travaux/marches/${id}/`)
}

// ==========================================
// AVANCEMENTS & ORDRES DE SERVICE (OS)
// ==========================================
export function createAvancement(payload: Partial<AvancementItem>, file?: File | null, legend?: string) {
  const cleaned = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== '' && value !== undefined && value !== null),
  )

  if (file) {
    const form = new FormData()
    for (const [key, value] of Object.entries(cleaned)) {
      form.append(key, String(value))
    }
    if (legend) form.append('legend', legend)
    form.append('file', file)
    return apiPostForm<AvancementItem>('/travaux/avancements/', form)
  }

  return apiPost<AvancementItem>('/travaux/avancements/', cleaned)
}

export function updateAvancement(id: string | number, payload: Partial<AvancementItem>) {
  const cleaned = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== '' && value !== undefined && value !== null),
  )

  return apiPatch<AvancementItem>(`/travaux/avancements/${id}/`, cleaned)
}

export function deleteAvancement(id: string | number) {
  return apiDelete(`/travaux/avancements/${id}/`)
}

export function createOS(payload: Partial<OSItem>) {
  return apiPost<OSItem>('/travaux/os/', payload)
}

// ==========================================
// DISCUSSION D'UN MARCHÉ
// ==========================================
/** Fil de discussion d'un marché, du plus ancien au plus récent. */
export function fetchMessages(marcheId: string) {
  return apiGet<MessageMarcheItem[]>(`/travaux/messages/?marche=${marcheId}`)
}

export function createMessage(payload: { marche: string; contenu?: string; fichier?: File | null }) {
  if (payload.fichier) {
    const formData = new FormData()
    formData.append('marche', payload.marche)
    if (payload.contenu) {
      formData.append('contenu', payload.contenu)
    }
    formData.append('fichier', payload.fichier)
    return apiPostForm<MessageMarcheItem>('/travaux/messages/', formData)
  }
  return apiPost<MessageMarcheItem>('/travaux/messages/', {
    marche: payload.marche,
    contenu: payload.contenu ?? '',
  })
}

export function deleteMessage(id: number | string) {
  return apiDelete(`/travaux/messages/${id}/`)
}

// ==========================================
// TRAVAUX GLISSÉS (REPORTS BUDGÉTAIRES)
// ==========================================
export function fetchGlissements(annee: number = 2026) {
  return apiGet<TravauxGlisseItem[]>(`/travaux/glissements/?annee=${annee}`)
}

// ==========================================
// CONVENTIONS PROGRAMMES (CP)
// ==========================================
export function fetchConventionProgramme(params?: { q?: string; region?: string; surface?: string; annee?: string | number }) {
  const query = new URLSearchParams()
  if (params?.q) query.append('q', params.q)
  if (params?.region) query.append('region', params.region)
  if (params?.surface) query.append('surface', params.surface)
  if (params?.annee) query.append('annee', String(params.annee))

  const queryString = query.toString() ? `?${query.toString()}` : ''
  return apiGet<ConventionProgrammeItem[]>(`/travaux/conventions/${queryString}`)
}

export function createConventionProgramme(payload: Partial<ConventionProgrammeItem>) {
  return apiPost<ConventionProgrammeItem>('/travaux/conventions/', payload)
}

export function updateConventionProgramme(id: string | number, payload: Partial<ConventionProgrammeItem>) {
  return apiPatch<ConventionProgrammeItem>(`/travaux/conventions/${id}/`, payload)
}

export function deleteConventionProgramme(id: string | number) {
  return apiDelete(`/travaux/conventions/${id}/`)
}

