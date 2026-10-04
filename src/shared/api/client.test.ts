import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, refreshCsrf, resetCsrf } from './client'
afterEach(() => vi.unstubAllGlobals())
describe('API transport', () => {
  it('discards a token response from a previous session and fetches a fresh token for the next write', async () => {
    let completeOld: ((response: Response) => void) | undefined
    const oldResponse = new Promise<Response>((resolve) => {
      completeOld = resolve
    })
    const fetcher = vi
      .fn()
      .mockReturnValueOnce(oldResponse)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'new-session', headerName: 'X-CSRF-TOKEN' })),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetcher)
    const oldRefresh = refreshCsrf()
    resetCsrf()
    completeOld?.(
      new Response(JSON.stringify({ token: 'old-session', headerName: 'X-CSRF-TOKEN' })),
    )
    await oldRefresh
    await api('/links/example', { method: 'DELETE' })
    expect(fetcher.mock.calls[2][1].headers['X-CSRF-TOKEN']).toBe('new-session')
  })
  it('reports CSRF connection failures using the same English connection feedback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network failed')))
    await expect(refreshCsrf()).rejects.toMatchObject({
      code: 'CONNECTION',
      message: 'Could not connect. Please check that the backend is running.',
    })
  })
  it('sends multipart uploads with CSRF and lets the browser supply the boundary', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'upload-token', headerName: 'X-CSRF-TOKEN' })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'post' })))
    vi.stubGlobal('fetch', fetcher)
    await refreshCsrf()
    const body = new FormData()
    body.append('title', 'Flight notes')
    body.append('files', new Blob(['Notes']), 'notes.txt')
    await api('/documents', { method: 'POST', body })
    expect(fetcher.mock.calls[1][1].body).toBe(body)
    expect(fetcher.mock.calls[1][1].headers['Content-Type']).toBeUndefined()
    expect(fetcher.mock.calls[1][1].headers['X-CSRF-TOKEN']).toBe('upload-token')
  })
  it('renews the CSRF token after a session expires', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'old-token', headerName: 'X-CSRF-TOKEN' })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 'SESSION_EXPIRED', detail: 'Sign in again' }), {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'fresh-token', headerName: 'X-CSRF-TOKEN' })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'member' })))
    vi.stubGlobal('fetch', fetcher)
    await refreshCsrf()
    await expect(api('/users/me')).rejects.toMatchObject({ status: 401 })
    await api('/auth/login', {
      method: 'POST',
      body: { email: 'test@example.com', password: 'test' },
    })
    expect(fetcher.mock.calls[3][1].headers['X-CSRF-TOKEN']).toBe('fresh-token')
  })
  it('obtains a session-bound CSRF token and sends it on mutations', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'csrf-test', headerName: 'X-CSRF-TOKEN' })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'created' })))
    vi.stubGlobal('fetch', fetcher)
    await refreshCsrf()
    await api('/admin/announcements', { method: 'POST', body: { title: 'Briefing' } })
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'X-CSRF-TOKEN': 'csrf-test', 'Content-Type': 'application/json' },
    })
  })
  it('preserves structured errors rather than showing success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'CONFLICT', detail: 'Changed elsewhere' }), {
          status: 409,
        }),
      ),
    )
    await expect(api('/links')).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'Changed elsewhere',
    })
  })
  it('handles an empty successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    await expect(api('/links')).resolves.toBeUndefined()
  })
  it('turns connection errors into an actionable API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network failed')))
    await expect(api('/dashboard')).rejects.toBeInstanceOf(ApiError)
  })
})
