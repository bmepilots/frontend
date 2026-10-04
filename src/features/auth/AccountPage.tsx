import { useMutation } from '@tanstack/react-query'
import { api } from '../../shared/api/client'
import { ErrorBox, PageTitle } from '../../shared/ui/primitives'
import { useAuth } from './auth-context'
export function AccountPage() {
  const { logout } = useAuth()
  const mutation = useMutation({
    mutationFn: async (body: unknown) => {
      await api('/users/me/password', { method: 'PUT', body })
      await logout().catch(() => window.dispatchEvent(new Event('session-expired')))
    },
  })
  return (
    <>
      <PageTitle
        eyebrow="MY ACCOUNT"
        title="Change password"
        text="After a successful change, sign in again with your new password."
      />
      <section className="panel settings-panel">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            mutation.mutate({ currentPassword: f.get('current'), newPassword: f.get('next') })
          }}
        >
          <ErrorBox error={mutation.error} />
          <label>
            Current password
            <input
              type="password"
              name="current"
              autoComplete="current-password"
              maxLength={128}
              required
            />
          </label>
          <label>
            New password
            <input
              type="password"
              name="next"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          <button className="button" disabled={mutation.isPending}>
            Change password
          </button>
        </form>
      </section>
    </>
  )
}
