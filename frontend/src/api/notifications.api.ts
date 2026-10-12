import { apiGet, apiPost } from './client'

export type NotificationItem = {
  id: number
  type: string
  title: string
  message: string
  related_model?: string | null
  related_id?: string | null
  is_read: boolean
  created_at: string
  read_at?: string | null
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  return apiGet<NotificationItem[]>('/notifications/')
}

export async function fetchUnreadNotificationsCount(): Promise<number> {
  const response = await apiGet<{ count: number }>('/notifications/unread-count/')
  return response.count
}

export async function markNotificationsRead(): Promise<{ success: boolean; count: number }> {
  return apiPost<{ success: boolean; count: number }>('/notifications/mark-read/', {})
}
