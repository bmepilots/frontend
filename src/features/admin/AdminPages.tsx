import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Check, RefreshCw, ShieldCheck, Users, X } from 'lucide-react'
import { api } from '../../shared/api/client'
import type { User } from '../../shared/types/models'
import { date, statusLabels } from '../../shared/types/models'
import { Empty, ErrorBox, Loading, PageTitle, Pager } from '../../shared/ui/primitives'
import { useAuth } from '../auth/auth-context'
import { PasswordResetDialog } from './PasswordResetDialog'
export function AdminDashboard() {
  const q = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => api<{ pendingRegistrations: number }>('/admin/dashboard'),
  })
  return (
    <>
      <PageTitle
        eyebrow="OPERATIONS"
        title="Admin overview"
        text="Membership, content and the status of your shared system."
      />
      <ErrorBox error={q.error} />
      <div className="stat-grid">
        <Link className="stat" to="/admin/registrations">
          <span className="stat-icon amber">
            <Users />
          </span>
          <div>
            <span>Pending applications</span>
            <strong>{q.isPending ? '…' : (q.data?.pendingRegistrations ?? '–')}</strong>
          </div>
          <ArrowUpRight size={18} />
        </Link>
        <Link className="stat" to="/admin/mail">
          <span className="stat-icon blue">
            <RefreshCw />
          </span>
          <div>
            <span>Shared inbox</span>
            <strong>Connection & sync</strong>
          </div>
        </Link>
        <Link className="stat" to="/admin/audit-log">
          <span className="stat-icon green">
            <ShieldCheck />
          </span>
          <div>
            <span>Activity history</span>
            <strong>Audit log</strong>
          </div>
        </Link>
      </div>
      <section className="panel article-card">
        <h2>Getting started</h2>
        <p>
          Open registration in Settings, then approve applications from your classmates. Create link
          categories and publish your first announcement. Members can contribute documents,
          comments, calendar events and useful links.
        </p>
        <p className="muted">
          Gmail secrets are configured on the server. This interface never stores or displays mail
          passwords.
        </p>
      </section>
    </>
  )
}
export function UsersPage({ pending = false }: { pending?: boolean }) {
  const client = useQueryClient()
  const { user: me } = useAuth()
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [passwordNotice, setPasswordNotice] = useState('')
  const q = useQuery({
    queryKey: ['admin', 'users', pending, page],
    queryFn: () =>
      api<User[]>(pending ? `/admin/registrations?page=${page}` : `/admin/users?page=${page}`),
  })
  const m = useMutation({
    mutationFn: ({ user, action, role }: { user: User; action: string; role?: string }) =>
      api(
        role
          ? `/admin/users/${user.id}/roles`
          : `/admin/${pending ? 'registrations' : 'users'}/${user.id}/${action}`,
        {
          method: role ? 'PUT' : 'POST',
          body: { version: user.version, ...(role ? { role } : {}) },
        },
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin'] }),
  })
  return (
    <>
      <PageTitle
        eyebrow="CREW MANAGEMENT"
        title={pending ? 'Applications' : 'Members'}
        text={
          pending
            ? 'Only approved members can access this community.'
            : 'Manage membership and roles. All changes are recorded in the audit log.'
        }
      />
      <ErrorBox error={q.error ?? m.error} />
      {passwordNotice && (
        <div className="success compact" role="status">
          {passwordNotice}
        </div>
      )}
      {q.isPending ? (
        <Loading />
      ) : q.data?.length ? (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name / email</th>
                <th>Status</th>
                <th>Role</th>
                <th>Last sign-in (Europe/Budapest)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.displayName}</strong>
                    <small>{u.email}</small>
                  </td>
                  <td>
                    <span className={'tag ' + (u.status === 'ACTIVE' ? 'green' : 'orange')}>
                      {statusLabels[u.status]}
                    </span>
                  </td>
                  <td>{u.role === 'ADMIN' ? 'Admin' : 'Member'}</td>
                  <td>
                    {u.lastLoginAt ? (
                      <time
                        dateTime={u.lastLoginAt.endsWith('Z') ? u.lastLoginAt : u.lastLoginAt + 'Z'}
                      >
                        {new Intl.DateTimeFormat('en-GB', {
                          dateStyle: 'medium',
                          timeStyle: 'medium',
                          timeZone: 'Europe/Budapest',
                        }).format(
                          new Date(
                            u.lastLoginAt.endsWith('Z') ? u.lastLoginAt : u.lastLoginAt + 'Z',
                          ),
                        )}
                      </time>
                    ) : (
                      'No sign-in recorded'
                    )}
                  </td>
                  <td>
                    <div className="table-actions">
                      {pending ? (
                        <>
                          <button
                            className="button small"
                            disabled={m.isPending}
                            onClick={() => m.mutate({ user: u, action: 'approve' })}
                          >
                            <Check size={15} />
                            Approve
                          </button>
                          <button
                            className="button small secondary"
                            disabled={m.isPending}
                            onClick={() => {
                              if (confirm('Reject this application?'))
                                m.mutate({ user: u, action: 'reject' })
                            }}
                          >
                            <X size={15} />
                            Reject
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="button small secondary"
                            disabled={m.isPending}
                            aria-label={`Reset password for ${u.email}`}
                            onClick={() => {
                              setPasswordNotice('')
                              setResetTarget(u)
                            }}
                          >
                            Reset password
                          </button>
                          {u.status === 'ACTIVE' && (
                            <button
                              className="button small secondary"
                              disabled={m.isPending || u.id === me?.id}
                              onClick={() => {
                                if (confirm('Suspend this member’s access?'))
                                  m.mutate({ user: u, action: 'suspend' })
                              }}
                            >
                              Suspend
                            </button>
                          )}
                          {['SUSPENDED', 'DISABLED'].includes(u.status) && (
                            <button
                              className="button small secondary"
                              disabled={m.isPending}
                              onClick={() => m.mutate({ user: u, action: 'activate' })}
                            >
                              Activate
                            </button>
                          )}
                          {['ACTIVE', 'SUSPENDED'].includes(u.status) && (
                            <button
                              className="button small secondary danger"
                              disabled={m.isPending || u.id === me?.id}
                              onClick={() => {
                                if (confirm('Disable this member?'))
                                  m.mutate({ user: u, action: 'disable' })
                              }}
                            >
                              Disable
                            </button>
                          )}
                          <button
                            className="button small secondary"
                            disabled={m.isPending || u.id === me?.id}
                            onClick={() => {
                              const role = u.role === 'ADMIN' ? 'USER' : 'ADMIN'
                              if (confirm(`Change role to ${role}?`))
                                m.mutate({ user: u, action: '', role })
                            }}
                          >
                            {u.role === 'ADMIN' ? 'Make member' : 'Make admin'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !q.isError && (
          <div className="panel">
            <Empty
              title={pending ? 'No pending applications' : 'No results'}
              text="Registered members of your class appear here."
            />
          </div>
        )
      )}
      <Pager page={page} setPage={setPage} hasNext={q.data?.length === 50} />
      {resetTarget && (
        <PasswordResetDialog
          key={resetTarget.id}
          user={resetTarget}
          self={resetTarget.id === me?.id}
          onClose={() => setResetTarget(null)}
          onConflict={() => void client.invalidateQueries({ queryKey: ['admin', 'users'] })}
          onSuccess={(updated) => {
            setResetTarget(null)
            if (updated.id === me?.id) {
              window.dispatchEvent(
                new CustomEvent('session-expired', { detail: { reason: 'password-reset' } }),
              )
              navigate('/login', { replace: true })
            } else {
              setPasswordNotice(
                `Password reset for ${updated.displayName} (${updated.email}). Their current sessions have been signed out.`,
              )
              void client.invalidateQueries({ queryKey: ['admin'] })
            }
          }}
        />
      )}
    </>
  )
}
type Settings = { registrationEnabled: boolean; portalName: string; version: number }
export function SettingsPage() {
  const client = useQueryClient()
  const q = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api<Settings>('/admin/settings'),
  })
  const m = useMutation({
    mutationFn: (body: unknown) => api('/admin/settings', { method: 'PATCH', body }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['admin', 'settings'] })
      client.invalidateQueries({ queryKey: ['public-config'] })
    },
  })
  return (
    <>
      <PageTitle
        eyebrow="CONFIGURATION"
        title="Settings"
        text="Settings for your community portal."
      />
      <ErrorBox error={q.error} />
      {q.isPending ? (
        <Loading />
      ) : (
        q.data && (
          <section className="panel settings-panel">
            <form
              key={q.data.version}
              onSubmit={(e) => {
                e.preventDefault()
                const f = new FormData(e.currentTarget)
                m.mutate({
                  portalName: f.get('portalName'),
                  registrationEnabled: f.get('registrationEnabled') === 'on',
                  version: q.data.version,
                })
              }}
            >
              <ErrorBox error={m.error} />
              {m.isSuccess && (
                <div className="success compact" role="status">
                  Settings saved.
                </div>
              )}
              <label>
                Portal name
                <input
                  name="portalName"
                  required
                  maxLength={100}
                  defaultValue={q.data.portalName}
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  name="registrationEnabled"
                  defaultChecked={q.data.registrationEnabled}
                />
                Allow new registrations
              </label>
              <p className="muted">
                Every new member still requires administrator approval when registration is open.
              </p>
              <button className="button" disabled={m.isPending}>
                Save settings
              </button>
            </form>
          </section>
        )
      )}
    </>
  )
}
type MailStatus = {
  enabled: boolean
  running: boolean
  accounts: {
    id: string
    emailAddress: string
    lastAttemptAt: string | null
    lastSuccessAt: string | null
    lastError: string | null
  }[]
  failedMessages: number
}
export function MailAdminPage() {
  const client = useQueryClient()
  const q = useQuery({
    queryKey: ['admin', 'mail'],
    queryFn: () => api<MailStatus>('/admin/mail/status'),
    refetchInterval: 15000,
  })
  const m = useMutation({
    mutationFn: (action: string) => api('/admin/mail/' + action, { method: 'POST' }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'mail'] }),
  })
  return (
    <>
      <PageTitle
        eyebrow="MAIL OPERATIONS"
        title="Email connection"
        text="Synchronize Gmail messages into your own database."
      />
      <ErrorBox error={q.error ?? m.error} />
      {q.isPending ? (
        <Loading />
      ) : (
        q.data && (
          <section className="panel article-card">
            <span className={'tag ' + (q.data.enabled ? 'green' : 'orange')}>
              {q.data.enabled
                ? q.data.running
                  ? 'Sync in progress'
                  : 'Connection enabled'
                : 'Not configured yet'}
            </span>
            <h2>Gmail · IMAP</h2>
            <p>
              The backend manages this connection. Your browser never receives Gmail credentials or
              connects directly to the mailbox.
            </p>
            {!q.data.enabled && (
              <div className="notice">
                To enable mail, ask the server operator to configure the Gmail address and App
                Password secret file as described in the backend documentation.
              </div>
            )}
            {q.data.accounts.map((a) => (
              <dl className="detail-list" key={a.id}>
                <dt>Mailbox</dt>
                <dd>{a.emailAddress}</dd>
                <dt>Last successful sync</dt>
                <dd>{a.lastSuccessAt ? date(a.lastSuccessAt) : 'Not yet completed'}</dd>
                <dt>Error status</dt>
                <dd>
                  {a.lastError
                    ? 'Connection or processing error. Check the server configuration.'
                    : 'No reported error'}
                </dd>
              </dl>
            ))}
            <p className="muted">Processing failures: {q.data.failedMessages}</p>
            <div className="item-actions">
              <button
                className="button"
                disabled={!q.data.enabled || q.data.running || m.isPending}
                onClick={() => m.mutate('sync')}
              >
                <RefreshCw size={16} />
                Synchronize
              </button>
              <button
                className="button secondary"
                disabled={!q.data.enabled || m.isPending}
                onClick={() => m.mutate('test-connection')}
              >
                Test connection
              </button>
              {q.data.failedMessages > 0 && (
                <button
                  className="button secondary"
                  disabled={m.isPending}
                  onClick={() => m.mutate('retry')}
                >
                  Retry failed messages
                </button>
              )}
            </div>
            {m.isSuccess && (
              <p className="success compact" role="status">
                The request completed or was accepted for processing.
              </p>
            )}
          </section>
        )
      )}
    </>
  )
}
export function AuditPage() {
  const [page, setPage] = useState(0)
  const [requests, setRequests] = useState(false)
  const q = useQuery({
    queryKey: ['admin', 'audit', page, requests],
    queryFn: () =>
      api<
        {
          id: number
          actorName: string
          action: string
          entityType: string
          entityId: string
          createdAt: string
          requestMethod: string | null
          requestPath: string | null
          responseStatus: number | null
          durationMs: number | null
        }[]
      >(`/admin/audit-log?page=${page}&requests=${requests}`),
    refetchInterval: 30000,
  })
  return (
    <>
      <PageTitle
        eyebrow="AUDIT TRAIL"
        title="Audit log"
        text="Sign-ins, community contributions, administration and API activity."
      />
      <div className="toolbar">
        <label className="check-label">
          <input
            type="checkbox"
            checked={requests}
            onChange={(e) => {
              setRequests(e.target.checked)
              setPage(0)
            }}
          />
          Show API requests instead of activity
        </label>
        <span className="muted">
          Times shown in Europe/Budapest. Request bodies and credentials are never logged.
        </span>
      </div>
      <ErrorBox error={q.error} />
      {q.isPending ? (
        <Loading />
      ) : q.data?.length ? (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Member</th>
                <th>Action</th>
                <th>Affected item</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((e) => (
                <tr key={e.id}>
                  <td>
                    {new Intl.DateTimeFormat('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'medium',
                      timeZone: 'Europe/Budapest',
                    }).format(
                      new Date(e.createdAt.endsWith('Z') ? e.createdAt : e.createdAt + 'Z'),
                    )}
                  </td>
                  <td>{e.actorName}</td>
                  <td>
                    <code>{e.action}</code>
                  </td>
                  <td>
                    {e.requestPath ? (
                      <>
                        <code>
                          {e.requestMethod} {e.requestPath}
                        </code>
                        <small>
                          Status {e.responseStatus} · {e.durationMs} ms
                        </small>
                      </>
                    ) : (
                      <>
                        {e.entityType}
                        <small className="mono">{e.entityId}</small>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !q.isError && <Empty title="No activity yet" text="Community activity will appear here." />
      )}
      <Pager page={page} setPage={setPage} hasNext={q.data?.length === 50} />
    </>
  )
}
