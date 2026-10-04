import { createContext, useContext } from 'react'
import type { User } from '../../shared/types/models'
export const AuthContext = createContext<{
  user: User | null
  loading: boolean
  error: unknown
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
} | null>(null)
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('Missing AuthProvider')
  return value
}
