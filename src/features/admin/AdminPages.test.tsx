// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { UsersPage } from './AdminPages'
import { AuthProvider } from '../auth/AuthProvider'
import { AuthPage } from '../auth/AuthPage'
import { App } from '../../app/App'
import { api, ApiError, resetCsrf } from '../../shared/api/client'
import type { User } from '../../shared/types/models'

vi.mock('../../shared/api/client', async (original) => ({
  ...(await original<typeof import('../../shared/api/client')>()),
  api: vi.fn(),
  resetCsrf: vi.fn(),
}))
const admin: User = {
  id: 'admin-1',
  email: 'admin@example.test',
  displayName: 'Class admin',
  role: 'ADMIN',
  status: 'ACTIVE',
  version: 2,
  createdAt: '2026-10-03T00:00:00',
  lastLoginAt: '2026-10-08T21:45:12',
}
const member: User = {
  ...admin,
  id: 'member-1',
  email: 'member@example.test',
  displayName: 'Crew member',
  role: 'USER',
  status: 'SUSPENDED',
  version: 7,
  lastLoginAt: null,
}
const password = 'Test-only-new-password'
let users: User[]
beforeEach(() => {
  users = [admin, member]
  vi.mocked(resetCsrf).mockReset()
  vi.mocked(api)
    .mockReset()
    .mockImplementation(async (path, options) => {
      if (path === '/users/me') return admin
      if (path === '/public/config') return { registrationEnabled: false, portalName: 'BME Pilots' }
      if (path.startsWith('/admin/users?')) return users
      if (path.startsWith('/admin/registrations?'))
        return [{ ...member, status: 'PENDING_APPROVAL' }]
      if (path.endsWith('/password') && options?.method === 'PUT') {
        const target = users.find((user) => path === `/admin/users/${user.id}/password`)!
        const updated = { ...target, version: target.version + 1 }
        users = users.map((user) => (user.id === updated.id ? updated : user))
        return updated
      }
      throw new Error('Unexpected test request: ' + path)
    })
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
})
afterEach(cleanup)
function Location() {
  return <span aria-label="Current route">{useLocation().pathname}</span>
}
function mount(pending = false, realApp = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/users']}>
        <AuthProvider>
          {realApp ? (
            <App />
          ) : (
            <Routes>
              <Route path="/admin/users" element={<UsersPage pending={pending} />} />
              <Route path="/login" element={<AuthPage />} />
              <Route path="/" element={<h1>Dashboard</h1>} />
            </Routes>
          )}
          <Location />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}
async function openReset(user = member) {
  await userEvent.click(
    await screen.findByRole('button', { name: `Reset password for ${user.email}` }),
  )
  return screen.getByRole('dialog', { name: 'Reset password' })
}
async function enterPassword(next = password, confirmation = next) {
  await userEvent.type(screen.getByLabelText('New password'), next)
  await userEvent.type(screen.getByLabelText('Confirm new password'), confirmation)
}
function passwordCalls() {
  return vi.mocked(api).mock.calls.filter(([path]) => path.endsWith('/password'))
}

describe('Admin member credentials and sign-in history', () => {
  it('shows UTC sign-ins in Budapest time and does not invent an earlier sign-in', async () => {
    mount()
    expect(
      await screen.findByRole('columnheader', { name: 'Last sign-in (Europe/Budapest)' }),
    ).toBeTruthy()
    const timestamp = await screen.findByText('8 Oct 2026, 23:45:12')
    expect(timestamp.getAttribute('datetime')).toBe('2026-10-08T21:45:12Z')
    expect(screen.getByText('No sign-in recorded')).toBeTruthy()
  })
  it('handles winter UTC timestamps independently of the workstation timezone', async () => {
    users = [{ ...admin, lastLoginAt: '2026-12-08T23:45:12Z' }]
    mount()
    expect(await screen.findByText('9 Dec 2026, 00:45:12')).toBeTruthy()
  })
  it('shows clearly who is targeted, clears canceled fields, and does not send a request', async () => {
    mount()
    const dialog = await openReset()
    expect(within(dialog).getByText('Crew member')).toBeTruthy()
    expect(dialog.textContent).toContain(member.email)
    expect(dialog.textContent).toContain('no email is sent')
    const input = screen.getByLabelText('New password') as HTMLInputElement
    expect(input.type).toBe('password')
    expect(input.autocomplete).toBe('new-password')
    expect(input.value).toBe('')
    await enterPassword()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await openReset()
    expect((screen.getByLabelText('New password') as HTMLInputElement).value).toBe('')
    expect(passwordCalls()).toHaveLength(0)
  })
  it.each([
    ['too-short', 'too-short', 'Use a password with 12–128 characters that is not only spaces.'],
    [
      '            ',
      '            ',
      'Use a password with 12–128 characters that is not only spaces.',
    ],
    [password, 'Different-test-password', 'The passwords do not match.'],
  ])('does not submit invalid passwords (%s)', async (next, confirmation, message) => {
    mount()
    await openReset()
    await enterPassword(next, confirmation)
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }))
    expect(screen.getByRole('alert').textContent).toBe(message)
    expect(passwordCalls()).toHaveLength(0)
  })
  it('uses the selected ID/version, blocks duplicates and dismissals while pending, and retains no password in caches', async () => {
    let finish: (value: User) => void = () => {}
    const response = new Promise<User>((resolve) => {
      finish = resolve
    })
    const original = vi.mocked(api).getMockImplementation()!
    vi.mocked(api).mockImplementation((path, options) =>
      path.endsWith('/password') ? response : original(path, options),
    )
    const client = mount()
    const dialog = await openReset()
    await enterPassword()
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }))
    expect(passwordCalls()).toEqual([
      [
        '/admin/users/member-1/password',
        { method: 'PUT', body: { newPassword: password, version: 7 } },
      ],
    ])
    expect(
      (screen.getByRole('button', { name: 'Resetting password…' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect((screen.getByRole('button', { name: 'Close' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('New password') as HTMLInputElement).value).toBe('')
    fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }))
    fireEvent.submit(dialog.querySelector('form')!)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(passwordCalls()).toHaveLength(1)
    await act(async () => {
      finish({ ...member, version: 8 })
      await response
    })
    expect(await screen.findByRole('status')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('Password reset for Crew member')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(client.getQueryData(['session'])).toEqual(admin)
    expect(screen.getByLabelText('Current route').textContent).toBe('/admin/users')
    expect(
      JSON.stringify(
        client
          .getMutationCache()
          .getAll()
          .map((mutation) => mutation.state),
      ),
    ).not.toContain(password)
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((query) => query.state),
      ),
    ).not.toContain(password)
    expect(await screen.findByText('Suspended')).toBeTruthy()
  })
  it('shows API failure, clears credentials, and allows a deliberate new attempt', async () => {
    const original = vi.mocked(api).getMockImplementation()!
    vi.mocked(api).mockImplementation((path, options) =>
      path.endsWith('/password')
        ? Promise.reject(
            new ApiError(503, 'UNAVAILABLE', 'The service is temporarily unavailable.'),
          )
        : original(path, options),
    )
    mount()
    await openReset()
    await enterPassword()
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'The service is temporarily unavailable.',
    )
    expect((screen.getByLabelText('New password') as HTMLInputElement).value).toBe('')
    expect(
      (screen.getByRole('button', { name: 'Save new password' }) as HTMLButtonElement).disabled,
    ).toBe(false)
    expect(screen.queryByRole('status')).toBeNull()
  })
  it('requires reopening after a stale version and uses freshly loaded details for the next attempt', async () => {
    const original = vi.mocked(api).getMockImplementation()!
    let attempts = 0
    vi.mocked(api).mockImplementation((path, options) => {
      if (path.endsWith('/password') && attempts++ === 0) {
        users = [admin, { ...member, version: 9 }]
        return Promise.reject(new ApiError(409, 'CONFLICT', 'Version conflict.'))
      }
      return original(path, options)
    })
    mount()
    const dialog = await openReset()
    await enterPassword()
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }))
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Close it and choose Reset password again',
    )
    expect(
      (screen.getByRole('button', { name: 'Save new password' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    fireEvent.submit(dialog.querySelector('form')!)
    expect(passwordCalls()).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await openReset()
    await enterPassword()
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }))
    await screen.findByRole('status')
    expect(passwordCalls()[1][1]?.body).toEqual({ newPassword: password, version: 9 })
  })
  it('keeps the self-reset notice through the real App guards while clearing the session and private cache', async () => {
    const client = mount(false, true)
    client.setQueryData(['mail', 'private'], ['private fixture'])
    await openReset(admin)
    expect(screen.getByText(/This is your account/)).toBeTruthy()
    await enterPassword()
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }))
    await screen.findByRole('button', { name: /^Sign in$/ })
    expect(screen.getByLabelText('Current route').textContent).toBe('/login')
    expect(screen.getByRole('status').textContent).toBe(
      'Your password was reset. Sign in again with your new password.',
    )
    expect(client.getQueryData(['session'])).toBeNull()
    expect(client.getQueryData(['mail', 'private'])).toBeUndefined()
    expect(resetCsrf).toHaveBeenCalled()
  })
  it('keeps registration approval separate from password resets', async () => {
    mount(true)
    await screen.findByRole('button', { name: 'Approve' })
    expect(screen.queryByRole('button', { name: /Reset password for/ })).toBeNull()
  })
})
