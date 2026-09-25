import { apiPost } from './client'

export type LoginPayload = {
  username: string
  password: string
}

export type LoginResponse = {
  token: string
  user: {
    id: number
    username: string
    email?: string
  }
}

export function login(payload: LoginPayload) {
  return apiPost<LoginResponse>('/auth/login/', payload)
}

export function logout() {
  return apiPost<{ message: string }>('/auth/logout/', {})
}
