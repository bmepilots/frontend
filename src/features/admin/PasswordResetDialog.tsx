import { useRef, useState } from 'react'
import { api, ApiError } from '../../shared/api/client'
import type { User } from '../../shared/types/models'
import { ErrorBox, Modal } from '../../shared/ui/primitives'

export function PasswordResetDialog({
  user,
  self,
  onClose,
  onSuccess,
  onConflict,
}: {
  user: User
  self: boolean
  onClose: () => void
  onSuccess: (user: User) => void
  onConflict: () => void
}) {
  const submitting = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [conflict, setConflict] = useState(false)
  return (
    <Modal title="Reset password" onClose={onClose} closeDisabled={pending}>
      <p>
        Set a new password for <strong>{user.displayName}</strong> ({user.email}).
      </p>
      <p className="muted">
        {self
          ? 'This is your account. You will be signed out and must sign in with the new password.'
          : 'All of this member’s current sessions will be signed out. Share the new password with them privately; no email is sent.'}{' '}
        {self ? 'Your' : 'Their'} membership status and role will stay the same.
      </p>
      <form
        noValidate
        aria-busy={pending}
        onSubmit={async (event) => {
          event.preventDefault()
          if (submitting.current || conflict) return
          const form = event.currentTarget
          const data = new FormData(form)
          const newPassword = String(data.get('newPassword') ?? '')
          const confirmation = String(data.get('confirmation') ?? '')
          if (!newPassword.trim() || newPassword.length < 12 || newPassword.length > 128) {
            setError(new Error('Use a password with 12–128 characters that is not only spaces.'))
            return
          }
          if (newPassword !== confirmation) {
            setError(new Error('The passwords do not match.'))
            return
          }
          submitting.current = true
          setPending(true)
          setError(null)
          // Keep credentials out of React state and query/mutation caches. Clear the fields
          // immediately; a failed attempt requires entering the password again.
          form.reset()
          try {
            const updated = await api<User>(`/admin/users/${user.id}/password`, {
              method: 'PUT',
              body: { newPassword, version: user.version },
            })
            onSuccess(updated)
          } catch (cause) {
            if (cause instanceof ApiError && cause.status === 409) {
              setConflict(true)
              onConflict()
              setError(
                new Error(
                  'This member changed since you opened the form. Close it and choose Reset password again to use the latest details.',
                ),
              )
            } else {
              setError(cause)
            }
          } finally {
            submitting.current = false
            setPending(false)
          }
        }}
      >
        <ErrorBox error={error} />
        <label>
          New password
          <input
            type="password"
            name="newPassword"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            aria-describedby="reset-password-help"
            required
            disabled={pending || conflict}
          />
        </label>
        <p id="reset-password-help" className="muted">
          Use 12–128 characters. Spaces are allowed, but the password cannot contain only spaces.
        </p>
        <label>
          Confirm new password
          <input
            type="password"
            name="confirmation"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            disabled={pending || conflict}
          />
        </label>
        <div className="item-actions">
          <button className="button" disabled={pending || conflict}>
            {pending ? 'Resetting password…' : 'Save new password'}
          </button>
          <button className="button secondary" type="button" onClick={onClose} disabled={pending}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
