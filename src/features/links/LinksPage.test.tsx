// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LinksPage } from './LinksPage'
import { AuthContext } from '../auth/auth-context'
import { api } from '../../shared/api/client'
import type { UsefulLink, User } from '../../shared/types/models'

vi.mock('../../shared/api/client', () => ({
  api: vi.fn(),
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : 'Failed'),
}))
const member: User = {
  id: 'member',
  email: 'member@example.test',
  displayName: 'Crew member',
  role: 'USER',
  lastLoginAt: null,
  status: 'ACTIVE',
  version: 0,
  createdAt: '2026-10-03T00:00:00',
}
const resource: UsefulLink = {
  id: 'link-1',
  categoryId: 'general',
  categoryName: 'General',
  name: 'Class resource',
  url: 'https://example.test/resource',
  description: 'A useful resource',
  sortOrder: 0,
  version: 4,
  authorId: 'other-member',
  authorName: 'Another pilot',
  createdAt: '2026-10-03T00:00:00',
}
beforeEach(() => {
  vi.mocked(api)
    .mockReset()
    .mockImplementation(async (path) =>
      path === '/links/categories'
        ? [{ id: 'general', name: 'General', sortOrder: 0 }]
        : [resource],
    )
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
})
afterEach(cleanup)
function mount(user = member) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider
        value={{
          user,
          loading: false,
          error: null,
          passwordReset: false,
          login: vi.fn(),
          logout: vi.fn(),
        }}
      >
        <LinksPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}
describe('Community link contributions', () => {
  it('lets an ordinary member create a link in the default category', async () => {
    mount()
    await screen.findByRole('link', { name: 'Class resource' })
    await userEvent.click(screen.getByRole('button', { name: 'Add a link' }))
    await userEvent.type(screen.getByLabelText('Name'), 'Study group')
    await userEvent.type(screen.getByLabelText('URL'), 'https://example.test/study')
    await userEvent.type(screen.getByLabelText('Description'), 'Shared preparation notes')
    await userEvent.click(screen.getByRole('button', { name: 'Save link' }))
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/links', {
        method: 'POST',
        body: {
          name: 'Study group',
          url: 'https://example.test/study',
          description: 'Shared preparation notes',
          categoryId: 'general',
          sortOrder: 0,
          version: 0,
        },
      }),
    )
  })
  it('shows authorship but hides management controls for another member’s entry', async () => {
    mount()
    const card = (await screen.findByRole('link', { name: 'Class resource' })).closest('article')!
    expect(within(card).getByText('Added by Another pilot')).toBeTruthy()
    expect(within(card).queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(within(card).queryByRole('button', { name: /delete/ })).toBeNull()
  })
  it.each(['owner', 'admin'] as const)(
    'lets an %s edit with the current version and preserve authorship',
    async (actor) => {
      mount(actor === 'owner' ? { ...member, id: 'other-member' } : { ...member, role: 'ADMIN' })
      await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
      await userEvent.clear(screen.getByLabelText('Name'))
      await userEvent.type(screen.getByLabelText('Name'), 'Updated resource')
      await userEvent.click(screen.getByRole('button', { name: 'Save link' }))
      await waitFor(() =>
        expect(api).toHaveBeenCalledWith('/links/link-1', {
          method: 'PATCH',
          body: {
            name: 'Updated resource',
            url: resource.url,
            description: resource.description,
            categoryId: 'general',
            sortOrder: 0,
            version: 4,
          },
        }),
      )
    },
  )
})
