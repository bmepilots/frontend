// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MailPage } from './MailPage'
import { api } from '../../shared/api/client'
let admin = false
vi.mock('../auth/auth-context', () => ({
  useAuth: () => ({ user: { role: admin ? 'ADMIN' : 'USER' } }),
}))

vi.mock('../../shared/api/client', () => ({
  api: vi.fn(),
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : 'Failed'),
}))
let message: {
  id: string
  subject: string
  senderAddress: string
  senderName: string
  receivedAt: string
  isRead: boolean
  isImportant: boolean
  importantForEveryone: boolean
  moderationVersion: number
  attachmentCount: number
}
let failDetail = false
let removed = false
let failModeration = false
beforeEach(() => {
  admin = false
  removed = false
  failModeration = false
  failDetail = false
  message = {
    id: 'mail-1',
    subject: 'Test briefing',
    senderAddress: 'crew@example.test',
    senderName: 'Crew',
    receivedAt: '2026-10-03T09:00:00',
    isRead: false,
    isImportant: true,
    importantForEveryone: false,
    moderationVersion: 0,
    attachmentCount: 0,
  }
  vi.mocked(api)
    .mockReset()
    .mockImplementation(async (path, options) => {
      if (path.startsWith('/admin/mail/messages/')) {
        if (failModeration) throw new Error('Shared change failed')
        if (options?.method === 'DELETE') removed = true
        else {
          message.importantForEveryone = (
            options?.body as { importantForEveryone: boolean }
          ).importantForEveryone
          message.moderationVersion++
        }
        return undefined
      }
      if (path.includes('/state')) {
        Object.assign(message, JSON.parse(JSON.stringify(options?.body)))
        return undefined
      }
      if (path.includes('/messages?')) return removed ? [] : [{ ...message }]
      if (failDetail) throw new Error('Message unavailable')
      return {
        message: { ...message, bodyText: 'Briefing content', bodyHtml: '' },
        addresses: [],
        attachments: [],
      }
    })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MailPage />
    </QueryClientProvider>,
  )
}
const stateCalls = () => vi.mocked(api).mock.calls.filter(([path]) => path.endsWith('/state'))
describe('Mail read state', () => {
  it('shows shared importance to members without exposing admin controls', async () => {
    message.importantForEveryone = true
    mount()
    await userEvent.click(await screen.findByRole('button', { name: /Test briefing/ }))
    await screen.findByText('Briefing content')
    expect(screen.getAllByText('Important for everyone')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Delete for everyone' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove importance for everyone' })).toBeNull()
  })
  it('lets admins toggle shared importance without changing personal stars', async () => {
    admin = true
    mount()
    await userEvent.click(await screen.findByRole('button', { name: /Test briefing/ }))
    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark important for everyone' }),
    )
    await screen.findByText('Message marked important for everyone.')
    await userEvent.click(
      await screen.findByRole('button', { name: 'Remove importance for everyone' }),
    )
    await screen.findByText('Shared important flag removed.')
    expect(message.isImportant).toBe(true)
    const calls = vi.mocked(api).mock.calls.filter(([path]) => path.endsWith('/importance'))
    expect(calls.map(([, options]) => options?.body)).toEqual([
      { importantForEveryone: true, version: 0 },
      { importantForEveryone: false, version: 1 },
    ])
  })
  it('requires confirmation for deletion and clears the selected message after success', async () => {
    admin = true
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    mount()
    await userEvent.click(await screen.findByRole('button', { name: /Test briefing/ }))
    await screen.findByRole('button', { name: 'Mark as unread' })
    await userEvent.click(screen.getByRole('button', { name: 'Delete for everyone' }))
    expect(
      vi.mocked(api).mock.calls.filter(([, options]) => options?.method === 'DELETE'),
    ).toHaveLength(0)
    confirm.mockReturnValue(true)
    await userEvent.click(screen.getByRole('button', { name: 'Delete for everyone' }))
    await screen.findByText('Message deleted from the shared inbox for everyone.')
    expect(screen.queryByText('Briefing content')).toBeNull()
    await screen.findByText('Your inbox is empty')
    expect(
      vi.mocked(api).mock.calls.find(([, options]) => options?.method === 'DELETE')?.[1]?.body,
    ).toEqual({ version: 0 })
  })
  it('locks failed shared changes until an explicit successful refresh', async () => {
    admin = true
    failModeration = true
    mount()
    await userEvent.click(await screen.findByRole('button', { name: /Test briefing/ }))
    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark important for everyone' }),
    )
    await screen.findByText('Shared change failed')
    expect(
      (screen.getByRole('button', { name: 'Mark important for everyone' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    failModeration = false
    await userEvent.click(screen.getByRole('button', { name: 'Refresh mail' }))
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Mark important for everyone' }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    )
  })
  it('marks a successfully opened message read without overwriting the important flag', async () => {
    mount()
    await userEvent.click(await screen.findByRole('button', { name: /Test briefing/ }))
    await screen.findByText('Briefing content')
    await waitFor(() => expect(stateCalls()).toHaveLength(1))
    expect(stateCalls()[0][1]).toEqual({
      method: 'PATCH',
      body: { isRead: true, isImportant: undefined },
    })
    expect(message.isRead).toBe(true)
    expect(message.isImportant).toBe(true)
    await screen.findByRole('button', { name: 'Mark as unread' })
  })
  it('keeps manual unread state until the message is reopened', async () => {
    mount()
    await userEvent.click(await screen.findByRole('button', { name: /Test briefing/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Mark as unread' }))
    await screen.findByRole('button', { name: 'Mark as read' })
    expect(message.isRead).toBe(false)
    expect(stateCalls()).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Close message' }))
    await userEvent.click(screen.getByRole('button', { name: /Test briefing/ }))
    await waitFor(() => expect(stateCalls()).toHaveLength(3))
    expect(message.isRead).toBe(true)
  })
  it('does not mark a message read when its body fails to load', async () => {
    failDetail = true
    mount()
    await userEvent.click(await screen.findByRole('button', { name: /Test briefing/ }))
    await screen.findByText('Message unavailable')
    expect(stateCalls()).toHaveLength(0)
  })
  it('changing the important flag does not overwrite read state', async () => {
    mount()
    await userEvent.click(await screen.findByRole('button', { name: 'Remove important flag' }))
    await waitFor(() => expect(stateCalls()).toHaveLength(1))
    expect(stateCalls()[0][1]).toEqual({
      method: 'PATCH',
      body: { isRead: undefined, isImportant: false },
    })
    expect(message.isRead).toBe(false)
  })
})
