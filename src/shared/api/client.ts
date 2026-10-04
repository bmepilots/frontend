export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}
let csrf: { token: string; headerName: string } | null = null
let csrfRequest: Promise<void> | null = null
let csrfGeneration = 0
export function resetCsrf() {
  csrfGeneration++
  csrf = null
  csrfRequest = null
}
export async function refreshCsrf() {
  const generation = csrfGeneration
  csrf = null
  let response: Response
  try {
    response = await fetch('/api/v1/auth/csrf', {
      credentials: 'same-origin',
      cache: 'no-store',
    })
  } catch {
    throw new ApiError(
      0,
      'CONNECTION',
      'Could not connect. Please check that the backend is running.',
    )
  }
  if (!response.ok) throw new ApiError(response.status, 'CONNECTION', 'The server is unavailable.')
  const token = await response.json()
  if (generation === csrfGeneration) csrf = token
}
async function ensureCsrf() {
  if (csrf) return
  const pending = csrfRequest ?? refreshCsrf()
  csrfRequest = pending
  try {
    await pending
  } finally {
    if (csrfRequest === pending) csrfRequest = null
  }
  // An old in-flight token response must not restore the token of a prior session.
  if (!csrf) await ensureCsrf()
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = { Accept: 'application/json' }
  const multipart = options.body instanceof FormData
  if (options.body !== undefined && !multipart) headers['Content-Type'] = 'application/json'
  if (!['GET', 'HEAD'].includes(method)) {
    await ensureCsrf()
    if (csrf) headers[csrf.headerName] = csrf.token
  }
  let response: Response
  try {
    response = await fetch('/api/v1' + path, {
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: options.signal,
      body: multipart
        ? (options.body as FormData)
        : options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(
      0,
      'CONNECTION',
      'Could not connect. Please check that the backend is running.',
    )
  }
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}))
    // A revoked/expired session also invalidates its CSRF token.
    if (response.status === 401 || response.status === 403) resetCsrf()
    if (response.status === 401 && !path.startsWith('/auth/') && path !== '/users/me')
      window.dispatchEvent(new Event('session-expired'))
    throw new ApiError(
      response.status,
      problem.code ?? 'ERROR',
      problem.detail ?? 'The operation failed.',
    )
  }
  if (response.status === 204 || response.headers.get('content-length') === '0')
    return undefined as T
  const text = await response.text()
  return text ? (JSON.parse(text) as T) : (undefined as T)
}
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'An unexpected error occurred.'
