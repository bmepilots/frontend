// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CalendarPage } from './CalendarPage'
import { AuthContext } from '../auth/auth-context'
import { api } from '../../shared/api/client'

vi.mock('../../shared/api/client', () => ({
  api: vi.fn(),
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : 'Failed'),
}))
vi.mock('./calendar-dates', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./calendar-dates')>()),
  budapestToday: () => '2026-10-03',
}))
beforeEach(() => {
  vi.mocked(api).mockReset().mockResolvedValue([])
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
  }
})
afterEach(cleanup)
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const member = {
    id: 'member',
    email: 'member@example.test',
    displayName: 'Crew member',
    role: 'USER' as const,
    status: 'ACTIVE',
    version: 0,
    createdAt: '2026-10-03T00:00:00',
  }
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider
        value={{ user: member, loading: false, error: null, login: vi.fn(), logout: vi.fn() }}
      >
        <CalendarPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}
describe('Community calendar interactions', () => {
  it('converts an inclusive last-day form to an exclusive Budapest date range', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: /^Add entry$/ }))
    await userEvent.type(screen.getByLabelText('Title'), 'Study weekend')
    await userEvent.click(screen.getByLabelText('All-day entry'))
    await userEvent.type(screen.getByLabelText('Last day (optional)'), '2026-10-04')
    const saveButtons = screen.getAllByRole('button', { name: /^Add entry$/ })
    await userEvent.click(saveButtons[saveButtons.length - 1])
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/calendar/events', {
        method: 'POST',
        body: {
          title: 'Study weekend',
          description: '',
          location: '',
          type: 'EVENT',
          startsAt: '2026-10-03T00:00:00',
          endsAt: '2026-10-05T00:00:00',
          allDay: true,
          version: 0,
        },
      }),
    )
  })
  it('lets members inspect another author’s entry without edit or delete controls', async () => {
    vi.mocked(api).mockResolvedValue([
      {
        id: 'event-1',
        title: 'Meteorology exam',
        description: 'Bring your calculator',
        type: 'EXAM',
        startsAt: '2026-10-03T09:00:00',
        endsAt: null,
        allDay: false,
        location: 'Room 2',
        authorId: 'other-member',
        authorName: 'Another pilot',
        createdAt: '2026-10-03T08:00:00',
        updatedAt: '2026-10-03T08:00:00',
        version: 0,
      },
    ])
    mount()
    await userEvent.click(await screen.findByRole('button', { name: /^Open Meteorology exam,/ }))
    await screen.findByText('Bring your calculator')
    expect(screen.queryByRole('button', { name: 'Edit entry' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Delete$/ })).toBeNull()
  })
})
