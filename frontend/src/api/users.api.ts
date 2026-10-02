import { apiDelete, apiGet, apiPost } from './client'

export type UserRoleOption = {
  id: number
  name: string
}

export type UserAccount = {
  id: number
  username: string
  email?: string
  first_name?: string
  last_name?: string
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  roles: string[]
}

export type UserManagementResponse = {
  users: UserAccount[]
  roles: UserRoleOption[]
}

export type CurrentUserResponse = {
  user: {
    id: number
    username: string
    email?: string
    first_name?: string
    last_name: string
    is_staff: boolean
    is_superuser: boolean
    is_project_manager?: boolean
    is_active: boolean
    roles: string[]
  }
  can_manage_users: boolean
}

export function fetchCurrentUser() {
  return apiGet<CurrentUserResponse>('/auth/me/')
}

export function fetchUserManagement() {
  return apiGet<UserManagementResponse>('/users/')
}

export function createUserManagement(payload: {
  username: string
  email?: string
  password: string
  first_name?: string
  last_name?: string
  roles?: string[]
}) {
  return apiPost<UserAccount>('/users/', payload)
}

export function deleteUserManagement(userId: number) {
  return apiDelete<{ detail: string }>(`/users/${userId}/`)
}
