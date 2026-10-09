// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DocumentsPage, DocumentPage } from './DocumentsPage'
import { AuthContext } from '../auth/auth-context'
import { api, ApiError } from '../../shared/api/client'

vi.mock('../../shared/api/client', async (original) => ({
  ...(await original<typeof import('../../shared/api/client')>()),
  api: vi.fn(),
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : 'Failed'),
}))
const member = {
  id: 'member',
  email: 'member@example.test',
  displayName: 'Crew member',
  role: 'USER' as const,
  lastLoginAt: null,
  status: 'ACTIVE',
  version: 0,
  createdAt: '2026-10-03T00:00:00',
}
beforeEach(() => {
  let nextUpload = 0
  vi.mocked(api)
    .mockReset()
    .mockImplementation(async (path, options) =>
      path === '/documents/uploads' && options?.method === 'POST'
        ? {
            id: `upload-${++nextUpload}`,
            filename: 'notes.txt',
            sizeBytes: 3,
            contentType: 'text/plain',
            expiresAt: '2099-01-01T00:00:00Z',
          }
        : [],
    )
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
        value={{
          user: member,
          loading: false,
          error: null,
          passwordReset: false,
          login: vi.fn(),
          logout: vi.fn(),
        }}
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
  it('uploads each file separately before publishing a member post', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: /^Share documents$/ }))
    await userEvent.type(screen.getByLabelText('Title'), 'Navigation notes')
    await userEvent.type(screen.getByLabelText('Description'), 'For the next lesson')
    const files = [new File(['one'], 'notes.txt'), new File(['two'], 'exercises.txt')]
    await userEvent.upload(screen.getByLabelText('Choose document files'), files)
    await userEvent.click(screen.getByRole('button', { name: 'Publish documents' }))
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/documents', {
        method: 'POST',
        body: {
          title: 'Navigation notes',
          description: 'For the next lesson',
          uploadIds: ['upload-1', 'upload-2'],
        },
      }),
    )
    const writes = vi.mocked(api).mock.calls.filter(([, options]) => options?.method === 'POST')
    expect(writes.map(([path]) => path)).toEqual([
      '/documents/uploads',
      '/documents/uploads',
      '/documents',
    ])
    expect((writes[0][1]?.body as FormData).getAll('file')).toEqual([files[0]])
    expect((writes[1][1]?.body as FormData).getAll('file')).toEqual([files[1]])
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(vi.mocked(api).mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(
      false,
    )
  })
  it('reuses uploaded files when a later file fails and publishing is retried', async () => {
    let secondAttempts = 0
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === '/documents/uploads') {
        const file = (options?.body as FormData).get('file') as File
        if (file.name === 'two.txt' && ++secondAttempts === 1) throw new Error('Connection lost')
        return { id: file.name, expiresAt: '2099-01-01T00:00:00Z' }
      }
      return []
    })
    mount()
    await userEvent.click(screen.getByRole('button', { name: /^Share documents$/ }))
    await userEvent.type(screen.getByLabelText('Title'), 'Retry material')
    await userEvent.upload(screen.getByLabelText('Choose document files'), [
      new File(['one'], 'one.txt'),
      new File(['two'], 'two.txt'),
    ])
    await userEvent.click(screen.getByRole('button', { name: 'Publish documents' }))
    await screen.findByText('Could not upload two.txt. Connection lost')
    expect(screen.getByText(/Ready to publish/)).toBeTruthy()
    expect(vi.mocked(api).mock.calls.some(([path]) => path === '/documents')).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Retry publishing' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const stages = vi.mocked(api).mock.calls.filter(([path]) => path === '/documents/uploads')
    expect(
      stages.map(([, options]) => ((options?.body as FormData).get('file') as File).name),
    ).toEqual(['one.txt', 'two.txt', 'two.txt'])
    expect(api).toHaveBeenCalledWith('/documents', {
      method: 'POST',
      body: { title: 'Retry material', description: '', uploadIds: ['one.txt', 'two.txt'] },
    })
  })
  it('cleans up completed uploads when a failed upload is cancelled', async () => {
    let attempts = 0
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === '/documents/uploads' && options?.method === 'POST') {
        if (++attempts === 2) throw new Error('Connection lost')
        return { id: 'staged-one', expiresAt: '2099-01-01T00:00:00Z' }
      }
      return []
    })
    mount()
    await userEvent.click(screen.getByRole('button', { name: /^Share documents$/ }))
    await userEvent.type(screen.getByLabelText('Title'), 'Cancelled material')
    await userEvent.upload(screen.getByLabelText('Choose document files'), [
      new File(['one'], 'one.txt'),
      new File(['two'], 'two.txt'),
    ])
    await userEvent.click(screen.getByRole('button', { name: 'Publish documents' }))
    await screen.findByText('Could not upload two.txt. Connection lost')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(api).toHaveBeenCalledWith('/documents/uploads/staged-one', { method: 'DELETE' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('keeps consumed IDs after an ambiguous publication and avoids a duplicate post', async () => {
    let publishAttempts = 0
    vi.mocked(api).mockImplementation(async (path, options) => {
      if (path === '/documents/uploads')
        return { id: 'stage-one', expiresAt: '2099-01-01T00:00:00Z' }
      if (path === '/documents' && options?.method === 'POST') {
        if (++publishAttempts === 1) throw new ApiError(0, 'CONNECTION', 'Connection lost')
        throw new ApiError(404, 'NOT_FOUND', 'Upload unavailable')
      }
      return []
    })
    mount()
    await userEvent.click(screen.getByRole('button', { name: /^Share documents$/ }))
    await userEvent.type(screen.getByLabelText('Title'), 'Uncertain material')
    await userEvent.upload(
      screen.getByLabelText('Choose document files'),
      new File(['one'], 'one.txt'),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Publish documents' }))
    await screen.findByText('Connection lost')
    expect((screen.getByLabelText('Choose document files') as HTMLInputElement).disabled).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Retry publishing' }))
    await screen.findByText(/These uploads are no longer available/)
    expect(
      (screen.getByRole('button', { name: 'Publish documents' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      vi.mocked(api).mock.calls.filter(([path]) => path === '/documents/uploads'),
    ).toHaveLength(1)
    expect(vi.mocked(api).mock.calls.filter(([path]) => path === '/documents')).toHaveLength(2)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() =>
      expect(
        vi.mocked(api).mock.calls.filter(([path]) => path.startsWith('/documents?q=')),
      ).toHaveLength(2),
    )
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
