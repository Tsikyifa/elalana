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

/**
 * Lit le token CSRF depuis le cookie `csrftoken`.
 * Django le pose automatiquement sur les réponses contenant `get_token()`.
 * Nécessaire pour les requêtes POST/PUT/PATCH/DELETE authentifiées par session.
 */
function getCsrfToken(): string | null {
  const match = document.cookie.match(/(^|;\s*)csrftoken=([^;]+)/)
  if (!match) return null
  try {
    return decodeURIComponent(match[2])
  } catch {
    return match[2]
  }
}

/**
 * Construit les headers JSON + CSRF pour les requêtes qui modifient des données.
 * `credentials: 'include'` est indispensable : l'auth repose sur les cookies.
 */
function buildHeaders(includeCsrf: boolean): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (includeCsrf) {
    const csrf = getCsrfToken()
    if (csrf) {
      headers['X-CSRFToken'] = csrf
    }
  }
  return headers
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      ...buildHeaders(false),
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
    ...init,
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
    headers: buildHeaders(true),
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw await toApiError(response)
  }

  return response.json() as Promise<T>
}

/**
 * POST multipart, nécessaire dès qu'un fichier (image du bac) accompagne le formulaire.
 * On ne fixe pas `Content-Type` : le navigateur ajoute lui-même la boundary.
 * On envoie tout de même `X-CSRFToken`.
 */
export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = {}
  const csrf = getCsrfToken()
  if (csrf) {
    headers['X-CSRFToken'] = csrf
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: form,
    cache: 'no-store',
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
    headers: buildHeaders(true),
    body: JSON.stringify(body),
    cache: 'no-store',
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
    headers: buildHeaders(true),
    body: JSON.stringify(body),
    cache: 'no-store',
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
    headers: buildHeaders(true),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw await toApiError(response)
  }

  if (response.status === 204) {
    return undefined as unknown as T
  }

  return response.json() as Promise<T>
}