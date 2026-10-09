import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, resetCsrf } from '../../shared/api/client'
import type { User } from '../../shared/types/models'
import { AuthContext } from './auth-context'
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const [passwordReset, setPasswordReset] = useState(false)
  const query = useQuery({
    queryKey: ['session'],
    queryFn: async ({ signal }) => {
      try {
        return await api<User>('/users/me', { signal })
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    retry: false,
    staleTime: 60_000,
  })
  useEffect(() => {
    const clear = (event: Event) => {
      // Route guards can replace navigation state when the session becomes null.
      // Keep this non-secret notice in the provider until the next successful login.
      if (event instanceof CustomEvent && event.detail?.reason === 'password-reset')
        setPasswordReset(true)
      resetCsrf()
      void client.cancelQueries({ queryKey: ['session'] })
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' })
      client.setQueryData(['session'], null)
    }
    window.addEventListener('session-expired', clear)
    return () => window.removeEventListener('session-expired', clear)
  }, [client])
  async function login(email: string, password: string) {
    const user = await api<User>('/auth/login', { method: 'POST', body: { email, password } })
    resetCsrf()
    await client.cancelQueries({ queryKey: ['session'] })
    // Remove private page data while keeping the session query observed by this provider.
    // Clearing the whole cache also removes the observer's query and leaves the router
    // believing the user is still anonymous after a successful login.
    client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' })
    client.setQueryData(['session'], user)
    setPasswordReset(false)
  }
  async function logout() {
    await api('/auth/logout', { method: 'POST' })
    resetCsrf()
    await client.cancelQueries({ queryKey: ['session'] })
    client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' })
    client.setQueryData(['session'], null)
    setPasswordReset(false)
  }
  return (
    <AuthContext.Provider
      value={{
        user: query.data ?? null,
        loading: query.isPending,
        error: query.error,
        passwordReset,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
