// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DocumentsPage, DocumentPage } from './DocumentsPage'
import { AuthContext } from '../auth/auth-context'
import { api } from '../../shared/api/client'

vi.mock('../../shared/api/client', () => ({
  api: vi.fn(),
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : 'Failed'),
}))
const member = {
  id: 'member',
  email: 'member@example.test',
  displayName: 'Crew member',
  role: 'USER' as const,
  status: 'ACTIVE',
  version: 0,
  createdAt: '2026-10-03T00:00:00',
}
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
function mount(detail = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider
        value={{ user: member, loading: false, error: null, login: vi.fn(), logout: vi.fn() }}
      >
        <MemoryRouter initialEntries={[detail ? '/documents/post-1' : '/documents']}>
          <Routes>
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/documents/:id" element={<DocumentPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}
describe('Community documents', () => {
  it('keeps an in-flight upload visible when Escape or close is requested', async () => {
    vi.mocked(api).mockImplementation(async (_path, options) =>
      options?.method === 'POST' ? new Promise(() => {}) : [],
    )
    mount()
    await userEvent.click(screen.getByRole('button', { name: /^Share documents$/ }))
    await userEvent.type(screen.getByLabelText('Title'), 'Course material')
    await userEvent.upload(
      screen.getByLabelText('Choose document files'),
      new File(['notes'], 'notes.txt'),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Publish documents' }))
    await screen.findByRole('button', { name: 'Uploading… Please keep this window open' })
    const dialog = screen.getByRole('dialog') as HTMLDialogElement
    const cancel = new Event('cancel', { cancelable: true })
    fireEvent(dialog, cancel)
    expect(cancel.defaultPrevented).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: /^Close$/ }))
    expect(dialog.open).toBe(true)
    expect(screen.getByRole('dialog')).toBe(dialog)
  })
  it('lets a member publish multiple files with a title and description', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: /^Share documents$/ }))
    await userEvent.type(screen.getByLabelText('Title'), 'Navigation notes')
    await userEvent.type(screen.getByLabelText('Description'), 'For the next lesson')
    const files = [new File(['one'], 'notes.txt'), new File(['two'], 'exercises.txt')]
    await userEvent.upload(screen.getByLabelText('Choose document files'), files)
    await userEvent.click(screen.getByRole('button', { name: 'Publish documents' }))
    await waitFor(() =>
      expect(vi.mocked(api).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(
        true,
      ),
    )
    const [path, options] = vi
      .mocked(api)
      .mock.calls.find(([, options]) => options?.method === 'POST')!
    expect(path).toBe('/documents')
    const body = options?.body as FormData
    expect(body.get('title')).toBe('Navigation notes')
    expect(body.get('description')).toBe('For the next lesson')
    expect(body.getAll('files')).toHaveLength(2)
  })
  it('offers discussion to members without showing another author’s management controls', async () => {
    vi.mocked(api).mockImplementation(async (_path, options) => {
      if (options?.method === 'POST') return {}
      return {
        post: {
          id: 'post-1',
          title: 'Shared notes',
          description: 'Lesson material',
          authorId: 'other-member',
          authorName: 'Another pilot',
          createdAt: '2026-10-03T10:00:00',
          updatedAt: '2026-10-03T10:00:00',
          version: 0,
          fileCount: 1,
          commentCount: 0,
        },
        files: [{ id: 'file-1', filename: 'notes.txt', sizeBytes: 12, contentType: 'text/plain' }],
        comments: [],
      }
    })
    mount(true)
    await screen.findByRole('heading', { name: 'Shared notes' })
    expect(screen.queryByRole('button', { name: 'Edit post' })).toBeNull()
    expect(screen.getByRole('link', { name: /notes.txt/ }).getAttribute('href')).toBe(
      '/api/v1/documents/post-1/files/file-1/download',
    )
    await userEvent.type(screen.getByLabelText('Add a comment'), 'Which chapter should we review?')
    await userEvent.click(screen.getByRole('button', { name: 'Post comment' }))
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/documents/post-1/comments', {
        method: 'POST',
        body: { body: 'Which chapter should we review?' },
      }),
    )
  })
})
