// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './AuthProvider'
import { App } from '../../app/App'
import { api, ApiError, refreshCsrf } from '../../shared/api/client'

vi.mock('../../shared/api/client', async (original) => ({
  ...(await original<typeof import('../../shared/api/client')>()),
  api: vi.fn(),
  refreshCsrf: vi.fn(),
  resetCsrf: vi.fn(),
}))
vi.mock('../dashboard/DashboardPage', () => ({ DashboardPage: () => <h1>Dashboard ready</h1> }))
const user = {
  id: 'member',
  email: 'pilot@example.test',
  displayName: 'Test Pilot',
  status: 'ACTIVE',
  role: 'USER',
  lastLoginAt: null,
  version: 0,
  createdAt: '2026-10-03T10:00:00',
}
let authenticated = false
beforeEach(() => {
  authenticated = false
  vi.mocked(refreshCsrf).mockReset().mockResolvedValue(undefined)
  vi.mocked(api)
    .mockReset()
    .mockImplementation(async (path) => {
      if (path === '/public/config')
        return { portalName: 'BME Pilots 2026', registrationEnabled: false }
      if (path === '/users/me') {
        if (authenticated) return user
        throw new ApiError(401, 'UNAUTHORIZED', 'Please sign in to continue.')
      }
      if (path === '/auth/login') {
        authenticated = true
        return user
      }
      if (path === '/auth/logout') {
        authenticated = false
        return undefined
      }
      throw new Error('Unexpected test request: ' + path)
    })
})
afterEach(cleanup)
function Location() {
  return <output aria-label="Current route">{useLocation().pathname}</output>
}
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <App />
            <Location />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  )
  return client
}
async function signIn() {
  await userEvent.type(await screen.findByLabelText('Email address'), user.email)
  await userEvent.type(screen.getByLabelText('Password'), 'test-only-password')
  await userEvent.click(screen.getByRole('button', { name: /^Sign in$/ }))
}
describe('Sign-in routing with the real app guards', () => {
  it('redirects to the dashboard immediately after successful sign-in', async () => {
    const client = mount()
    client.setQueryData(['mail', 'private'], ['previous session content'])
    await signIn()
    await screen.findByRole('heading', { name: 'Dashboard ready' })
    expect(screen.getByLabelText('Current route').textContent).toBe('/')
    expect(client.getQueryData(['session'])).toEqual(user)
    expect(client.getQueryData(['mail', 'private'])).toBeUndefined()
  })
  it('does not let a secondary CSRF refresh failure strand an authenticated user on login', async () => {
    vi.mocked(refreshCsrf).mockRejectedValue(new Error('Token endpoint temporarily unavailable'))
    mount()
    await signIn()
    await screen.findByRole('heading', { name: 'Dashboard ready' })
    expect(screen.getByLabelText('Current route').textContent).toBe('/')
  })
  it('redirects an existing authenticated session away from the login page', async () => {
    authenticated = true
    mount()
    await screen.findByRole('heading', { name: 'Dashboard ready' })
    expect(screen.getByLabelText('Current route').textContent).toBe('/')
  })
  it('cancels a stale session lookup so it cannot undo a later successful sign-in', async () => {
    const client = mount()
    await screen.findByLabelText('Email address')
    let finishLookup: ((value: unknown) => void) | undefined
    let lookupSignal: AbortSignal | undefined
    const delayed = new Promise((resolve) => {
      finishLookup = resolve
    })
    const original = vi.mocked(api).getMockImplementation()!
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === '/users/me') {
        lookupSignal = options?.signal
        return delayed
      }
      return original(path, options)
    })
    act(() => {
      void client.refetchQueries({ queryKey: ['session'] })
    })
    await signIn()
    await screen.findByRole('heading', { name: 'Dashboard ready' })
    expect(lookupSignal?.aborted).toBe(true)
    await act(async () => {
      finishLookup?.(null)
      await delayed
    })
    expect(screen.getByLabelText('Current route').textContent).toBe('/')
    expect(client.getQueryData(['session'])).toEqual(user)
  })
  it('shows a failed login and remains on the login route', async () => {
    const original = vi.mocked(api).getMockImplementation()!
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === '/auth/login')
        throw new ApiError(401, 'LOGIN_FAILED', 'Invalid credentials or inactive account.')
      return original(path, options)
    })
    mount()
    await signIn()
    await screen.findByText('Invalid credentials or inactive account.')
    expect(screen.getByLabelText('Current route').textContent).toBe('/login')
  })
  it('returns to login on session expiry and redirects correctly on the next sign-in', async () => {
    mount()
    await signIn()
    await screen.findByRole('heading', { name: 'Dashboard ready' })
    authenticated = false
    act(() => {
      window.dispatchEvent(new Event('session-expired'))
    })
    await screen.findByRole('button', { name: /^Sign in$/ })
    await signIn()
    await screen.findByRole('heading', { name: 'Dashboard ready' })
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(screen.getByLabelText('Current route').textContent).toBe('/login'))
  })
  it('retains the reset notice across late expiry events and clears it after signing in again', async () => {
    mount()
    await screen.findByRole('button', { name: /^Sign in$/ })
    act(() => {
      window.dispatchEvent(
        new CustomEvent('session-expired', { detail: { reason: 'password-reset' } }),
      )
      window.dispatchEvent(new Event('session-expired'))
    })
    expect(
      await screen.findByText('Your password was reset. Sign in again with your new password.'),
    ).toBeTruthy()
    await signIn()
    await screen.findByRole('heading', { name: 'Dashboard ready' })
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('button', { name: /^Sign in$/ })
    expect(
      screen.queryByText('Your password was reset. Sign in again with your new password.'),
    ).toBeNull()
  })
})
