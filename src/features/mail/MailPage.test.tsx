// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MailPage } from './MailPage'
import { api } from '../../shared/api/client'

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
  attachmentCount: number
}
let failDetail = false
beforeEach(() => {
  failDetail = false
  message = {
    id: 'mail-1',
    subject: 'Test briefing',
    senderAddress: 'crew@example.test',
    senderName: 'Crew',
    receivedAt: '2026-10-03T09:00:00',
    isRead: false,
    isImportant: true,
    attachmentCount: 0,
  }
  vi.mocked(api)
    .mockReset()
    .mockImplementation(async (path, options) => {
      if (path.includes('/state')) {
        Object.assign(message, JSON.parse(JSON.stringify(options?.body)))
        return undefined
      }
      if (path.includes('/messages?')) return [{ ...message }]
      if (failDetail) throw new Error('Message unavailable')
      return {
        message: { ...message, bodyText: 'Briefing content', bodyHtml: '' },
        addresses: [],
        attachments: [],
      }
    })
})
afterEach(cleanup)
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
