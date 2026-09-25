export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

/**
 * Erreur API porteuse du statut et, le cas échéant, des erreurs par champ
 * renvoyées par DRF (`{"region": ["Ce champ est obligatoire."]}`).
 */
export class ApiError extends Error {
  status: number
  fields: Record<string, string[]>

  constructor(status: number, message: string, fields: Record<string, string[]> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
  }
}

/**
 * Transforme un corps d'erreur DRF en message lisible.
 * DRF peut renvoyer une liste, un objet champ -> erreurs, ou `detail`.
 */
function readErrorMessage(body: unknown, status: number): { message: string; fields: Record<string, string[]> } {
  if (typeof body === 'string' && body.trim()) {
    return { message: body, fields: {} }
  }

  if (!body || typeof body !== 'object') {
    return { message: `Requête refusée (${status})`, fields: {} }
  }

  const fields: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (key === 'detail') continue
    // Si DRF renvoie une structure imbriquée (p.ex. erreurs par index pour une liste),
    // on la sérialise proprement pour pouvoir l'afficher côté client.
    if (value && typeof value === 'object') {
      try {
        fields[key] = [JSON.stringify(value)]
      } catch {
        fields[key] = [String(value)]
      }
    } else {
      fields[key] = Array.isArray(value) ? value.map(String) : [String(value)]
    }
  }

  const detail = (body as Record<string, unknown>).detail
  if (typeof detail === 'string') {
    return { message: detail, fields }
  }

  const [firstField] = Object.keys(fields)
  if (firstField) {
    return { message: `${firstField} : ${fields[firstField][0]}`, fields }
  }

  return { message: `Requête refusée (${status})`, fields }
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // Corps non JSON (page d'erreur HTML) : on garde le statut seul.
  }

  const { message, fields } = readErrorMessage(body, response.status)

  if (response.status === 401 || response.status === 403) {
    return new ApiError(response.status, 'Session expirée ou accès refusé. Reconnectez-vous.', fields)
  }

  return new ApiError(response.status, message, fields)
}

/** `credentials: 'include'` est indispensable : l'auth repose sur le cookie `access`. */
const JSON_HEADERS = { 'Content-Type': 'application/json' }

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: JSON_HEADERS,
  })

  if (!response.ok) {
    throw await toApiError(response)
  }

  return response.json() as Promise<T>
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw await toApiError(response)
  }

  return response.json() as Promise<T>
}

/**
 * POST multipart, nécessaire dès qu'un fichier (image du bac) accompagne le formulaire.
 * On ne fixe pas `Content-Type` : le navigateur ajoute lui-même la boundary.
 */
export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })

  if (!response.ok) {
    throw await toApiError(response)
  }

  return response.json() as Promise<T>
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw await toApiError(response)
  }

  return response.json() as Promise<T>
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw await toApiError(response)
  }

  return response.json() as Promise<T>
}

export async function apiDelete<T = void>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_HEADERS,
  })

  if (!response.ok) {
    throw await toApiError(response)
  }

  if (response.status === 204) {
    return undefined as unknown as T
  }

  return response.json() as Promise<T>
}

