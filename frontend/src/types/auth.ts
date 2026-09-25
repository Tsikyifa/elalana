export type User = {
  id: number
  username: string
  email?: string
}

export type AuthState = {
  token: string | null
  user: User | null
}
