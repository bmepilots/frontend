// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { api, ApiError } from '../../shared/api/client'
import { MailAdminPage } from './AdminPages'
import { MailForwardingPanel, type MailForwardingStatus } from './MailForwardingPanel'

vi.mock('../../shared/api/client', async (original) => ({
  ...(await original<typeof import('../../shared/api/client')>()),
  api: vi.fn(),
}))

let status: MailForwardingStatus
let loadFailure: Error | null
let saveFailure: Error | null
beforeEach(() => {
  status = {
    enabled: false,
    available: true,
    enabledAt: null,
    version: 6,
    counts: { pending: 0, sending: 0, sent: 0, failed: 0, uncertain: 0, cancelled: 0 },
    lastError: null,
  }
  loadFailure = null
  saveFailure = null
  vi.mocked(api)
    .mockReset()
    .mockImplementation(async (path, options) => {
      if (path === '/admin/mail/status')
        return { enabled: true, running: false, accounts: [], failedMessages: 0 }
      if (path !== '/admin/mail/forwarding') throw new Error('Unexpected request: ' + path)
      if (options?.method === 'PATCH') {
        if (saveFailure) throw saveFailure
        const body = options.body as { enabled: boolean; version: number }
        status = {
          ...status,
          enabled: body.enabled,
          version: body.version + 1,
          enabledAt: body.enabled ? '2026-10-09T10:15:00' : null,
          counts: {
            ...status.counts,
            pending: body.enabled ? status.counts.pending : 0,
            cancelled: body.enabled
              ? status.counts.cancelled
              : status.counts.cancelled + status.counts.pending,
          },
        }
      } else if (loadFailure) throw loadFailure
      return status
    })
})
afterEach(cleanup)

function mount(wholePage = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      {wholePage ? <MailAdminPage /> : <MailForwardingPanel />}
    </QueryClientProvider>,
  )
  return client
}
function saveCalls() {
  return vi.mocked(api).mock.calls.filter(([, options]) => options?.method === 'PATCH')
}
function count(label: string) {
  return within(screen.getByLabelText('Forwarding delivery counts')).getByText(label)
    .nextElementSibling?.textContent
}
async function expectEnabledButton(name: string) {
  await waitFor(() => {
    expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(false)
  })
  return screen.getByRole('button', { name })
}

describe('Admin mail forwarding', () => {
  it('loads independently in Email connection and explains future mail and automatic new-member inclusion', async () => {
    mount(true)
    expect(screen.getAllByText('Loading…').length).toBeGreaterThan(0)
    const section = await screen.findByRole('region', { name: 'Automatic email forwarding' })
    expect(await within(section).findByText('Forwarding disabled')).toBeTruthy()
    expect(within(section).getByText(/Newly approved or reactivated members/)).toBeTruthy()
    expect(within(section).getByText(/earlier messages are not sent/)).toBeTruthy()
    expect(within(section).getByText(/the member recipient list is not shared/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Gmail · IMAP' })).toBeTruthy()
    expect(saveCalls()).toHaveLength(0)
  })

  it('enables with the current version and reports saved settings without claiming inbox delivery', async () => {
    const client = mount()
    await screen.findByText('Forwarding disabled')
    await userEvent.click(await expectEnabledButton('Enable forwarding'))
    expect(await screen.findByText('Forwarding enabled')).toBeTruthy()
    expect(saveCalls()).toEqual([
      ['/admin/mail/forwarding', { method: 'PATCH', body: { enabled: true, version: 6 } }],
    ])
    expect(await screen.findByText(/Future incoming messages will be forwarded/)).toBeTruthy()
    expect(screen.getByText('9 Oct 2026, 12:15:00')).toBeTruthy()
    expect(count('Accepted by Gmail')).toBe('0')
    expect(screen.getByText(/Gmail acceptance does not confirm inbox delivery/)).toBeTruthy()
    expect(
      client.getQueryData<MailForwardingStatus>(['admin', 'mail', 'forwarding'])?.version,
    ).toBe(7)
  })

  it('allows disabling even when mail is unavailable and explains queued versus in-flight copies', async () => {
    status = { ...status, enabled: true, available: false }
    status.counts.pending = 2
    status.counts.sending = 1
    mount()
    await screen.findByText('Forwarding enabled')
    expect(screen.getByText(/Forwarding is paused/)).toBeTruthy()
    expect(screen.getByText(/already being sent cannot be recalled/)).toBeTruthy()
    await userEvent.click(await expectEnabledButton('Disable forwarding'))
    expect(await screen.findByText('Forwarding disabled')).toBeTruthy()
    expect(saveCalls()[0]?.[1]?.body).toEqual({ enabled: false, version: 6 })
    expect(count('Queued')).toBe('0')
    expect(count('Sending')).toBe('1')
    expect(count('Cancelled')).toBe('2')
    expect(screen.getByText('Forwarding disabled. Queued copies have been cancelled.')).toBeTruthy()
  })

  it('prevents enabling unavailable mail while retaining a working status refresh', async () => {
    status.available = false
    mount()
    await screen.findByText('Forwarding disabled')
    const enable = screen.getByRole('button', { name: 'Enable forwarding' }) as HTMLButtonElement
    expect(enable.disabled).toBe(true)
    expect(screen.getByText(/Gmail must be enabled/)).toBeTruthy()
    status = { ...status, available: true }
    await userEvent.click(await expectEnabledButton('Refresh forwarding status'))
    await expectEnabledButton('Enable forwarding')
    expect(saveCalls()).toHaveLength(0)
  })

  it('blocks duplicate submissions and refresh while a change is pending', async () => {
    const normalApi = vi.mocked(api).getMockImplementation()!
    let finish: (value: MailForwardingStatus) => void = () => {}
    const pending = new Promise<MailForwardingStatus>((resolve) => {
      finish = resolve
    })
    vi.mocked(api).mockImplementation((path, options) =>
      options?.method === 'PATCH' ? pending : normalApi(path, options),
    )
    mount()
    await screen.findByText('Forwarding disabled')
    await userEvent.dblClick(await expectEnabledButton('Enable forwarding'))
    expect(saveCalls()).toHaveLength(1)
    expect(
      (screen.getByRole('button', { name: 'Saving forwarding…' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Refresh forwarding status' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    await act(async () => {
      status = { ...status, enabled: true, version: 7 }
      finish(status)
    })
    await expectEnabledButton('Disable forwarding')
  })

  it('requires an explicit refresh after a stale version and never silently retries the change', async () => {
    saveFailure = new ApiError(409, 'CONFLICT', 'This item was changed. Reload and try again.')
    mount()
    await screen.findByText('Forwarding disabled')
    await userEvent.click(await expectEnabledButton('Enable forwarding'))
    expect(await screen.findByText(/The forwarding settings changed/)).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Enable forwarding' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    status = { ...status, enabled: true, version: 9 }
    saveFailure = null
    await userEvent.click(await expectEnabledButton('Refresh forwarding status'))
    await expectEnabledButton('Disable forwarding')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(saveCalls()).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Disable forwarding' }))
    await screen.findByText('Forwarding disabled')
    expect(saveCalls()[1]?.[1]?.body).toEqual({ enabled: false, version: 9 })
  })

  it('does not retry an ambiguous network save and keeps the lock if refreshing also fails', async () => {
    saveFailure = new ApiError(0, 'CONNECTION', 'Could not connect.')
    mount()
    await screen.findByText('Forwarding disabled')
    await userEvent.click(await expectEnabledButton('Enable forwarding'))
    expect(await screen.findByText(/request may have reached the server/)).toBeTruthy()
    loadFailure = new Error('Forwarding status unavailable.')
    await userEvent.click(await expectEnabledButton('Refresh forwarding status'))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Forwarding status unavailable.',
    )
    expect(
      (screen.getByRole('button', { name: 'Enable forwarding' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    loadFailure = null
    status = { ...status, enabled: true, version: 7 }
    await userEvent.click(await expectEnabledButton('Refresh forwarding status'))
    await expectEnabledButton('Disable forwarding')
    expect(saveCalls()).toHaveLength(1)
  })

  it('shows and recovers an initial status failure without inventing a forwarding state', async () => {
    loadFailure = new Error('Forwarding status unavailable.')
    mount()
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Forwarding status unavailable.',
    )
    expect(screen.queryByText('Forwarding disabled')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Enable forwarding' })).toBeNull()
    loadFailure = null
    await userEvent.click(await expectEnabledButton('Retry forwarding status'))
    await screen.findByText('Forwarding disabled')
    expect(saveCalls()).toHaveLength(0)
  })

  it('uses actual delivery counts, keeps uncertain attempts distinct and does not reveal raw mail errors', async () => {
    status.counts = { pending: 6, sending: 1, sent: 12, failed: 2, uncertain: 3, cancelled: 4 }
    status.lastError = 'SMTP_TEST_ERROR_DETAILS'
    mount()
    await screen.findByText('Forwarding disabled')
    expect(count('Queued')).toBe('6')
    expect(count('Sending')).toBe('1')
    expect(count('Accepted by Gmail')).toBe('12')
    expect(count('Failed')).toBe('2')
    expect(count('Delivery uncertain')).toBe('3')
    expect(count('Cancelled')).toBe('4')
    expect(screen.getByText(/will not be retried automatically/)).toBeTruthy()
    expect(screen.getByText(/server operator to review/)).toBeTruthy()
    expect(screen.queryByText(/SMTP_TEST_ERROR_DETAILS/)).toBeNull()
  })

  it('shows a recognized safe error code with actionable meaning for operator review', async () => {
    status.lastError = 'SMTP_AUTHENTICATION_FAILED'
    mount()
    await screen.findByText('Forwarding disabled')
    expect(screen.getByText('SMTP_AUTHENTICATION_FAILED')).toBeTruthy()
    expect(screen.getByText(/Gmail rejected the mailbox credentials/)).toBeTruthy()
  })
})
