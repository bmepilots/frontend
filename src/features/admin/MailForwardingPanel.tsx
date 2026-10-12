import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from '../../shared/api/client'
import { ErrorBox, Loading } from '../../shared/ui/primitives'

export type MailForwardingStatus = {
  enabled: boolean
  available: boolean
  enabledAt: string | null
  version: number
  counts: {
    pending: number
    sending: number
    sent: number
    failed: number
    uncertain: number
    cancelled: number
  }
  lastError: string | null
}

const queryKey = ['admin', 'mail', 'forwarding']
const forwardingErrors: Record<string, string> = {
  SMTP_NOT_CONFIGURED: 'Outgoing mail is not configured.',
  DELIVERY_PREPARATION_FAILED: 'A message or attachment could not be prepared for sending.',
  SMTP_AUTHENTICATION_FAILED: 'Gmail rejected the mailbox credentials.',
  SMTP_CONNECTION_FAILED: 'The server could not connect to Gmail for sending.',
  SMTP_REJECTED: 'Gmail rejected a sending attempt.',
  SMTP_RECIPIENT_REJECTED: 'Gmail rejected a recipient address.',
  SMTP_OUTCOME_UNKNOWN: 'Gmail acceptance could not be confirmed.',
  DELIVERY_OUTCOME_UNKNOWN: 'A sending attempt ended without a confirmed result.',
  DELIVERY_INTERRUPTED: 'The server restarted during a sending attempt.',
}

export function MailForwardingPanel() {
  const client = useQueryClient()
  const [requiresRefresh, setRequiresRefresh] = useState(false)
  const q = useQuery({
    queryKey,
    queryFn: ({ signal }) => api<MailForwardingStatus>('/admin/mail/forwarding', { signal }),
    refetchInterval: 15000,
  })
  const m = useMutation({
    mutationFn: (body: { enabled: boolean; version: number }) =>
      api<MailForwardingStatus>('/admin/mail/forwarding', { method: 'PATCH', body }),
    onMutate: () => client.cancelQueries({ queryKey, exact: true }),
    onSuccess: (status) => {
      client.setQueryData(queryKey, status)
      void client.invalidateQueries({ queryKey, exact: true })
    },
    onError: () => setRequiresRefresh(true),
    retry: false,
  })
  const conflict = m.error instanceof ApiError && m.error.status === 409
  const lastErrorCode =
    q.data?.lastError && Object.hasOwn(forwardingErrors, q.data.lastError) ? q.data.lastError : null
  const refresh = async () => {
    const result = await q.refetch()
    if (!result.isError) {
      setRequiresRefresh(false)
      m.reset()
    }
  }

  return (
    <section className="panel article-card" aria-labelledby="mail-forwarding-title">
      <h2 id="mail-forwarding-title">Automatic email forwarding</h2>
      <p>
        Forward new incoming messages and their imported attachments to every Active member’s email
        address. Newly approved or reactivated members automatically receive future messages.
      </p>
      <p className="muted">
        Forwarding starts off. Enabling it covers messages received after it is enabled; earlier
        messages are not sent. Each member receives a separate copy; the member recipient list is
        not shared.
      </p>
      <ErrorBox error={q.error ?? m.error} />
      {requiresRefresh && (
        <p className="notice" role="status">
          {conflict
            ? 'The forwarding settings changed. Refresh the status and review the current setting before trying again.'
            : 'The change could not be confirmed. Refresh the status before trying again; the request may have reached the server.'}
        </p>
      )}
      {q.isPending ? (
        <Loading />
      ) : (
        q.data && (
          <>
            <span className={'tag ' + (q.data.enabled ? 'green' : 'orange')}>
              {q.data.enabled ? 'Forwarding enabled' : 'Forwarding disabled'}
            </span>
            {!q.data.available && (
              <p className="notice">
                {q.data.enabled ? 'Forwarding is paused. ' : ''}
                Gmail must be enabled and its App Password configured on the server before messages
                can be forwarded. Credentials never enter your browser.
              </p>
            )}
            {q.data.enabledAt && q.data.enabled && (
              <p className="muted">
                Enabled from{' '}
                <time
                  dateTime={
                    q.data.enabledAt.endsWith('Z') ? q.data.enabledAt : q.data.enabledAt + 'Z'
                  }
                >
                  {new Intl.DateTimeFormat('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'medium',
                    timeZone: 'Europe/Budapest',
                  }).format(
                    new Date(
                      q.data.enabledAt.endsWith('Z') ? q.data.enabledAt : q.data.enabledAt + 'Z',
                    ),
                  )}
                </time>{' '}
                (Europe/Budapest).
              </p>
            )}
            <dl className="detail-list" aria-label="Forwarding delivery counts">
              <dt>Queued</dt>
              <dd>{q.data.counts.pending}</dd>
              <dt>Sending</dt>
              <dd>{q.data.counts.sending}</dd>
              <dt>Accepted by Gmail</dt>
              <dd>{q.data.counts.sent}</dd>
              <dt>Failed</dt>
              <dd>{q.data.counts.failed}</dd>
              <dt>Delivery uncertain</dt>
              <dd>{q.data.counts.uncertain}</dd>
              <dt>Cancelled</dt>
              <dd>{q.data.counts.cancelled}</dd>
            </dl>
            <p className="muted">
              Counts are per recipient. Gmail acceptance does not confirm inbox delivery.
            </p>
            {(q.data.counts.failed > 0 || q.data.lastError) && (
              <p className="notice">
                {lastErrorCode ? (
                  <>
                    Last reported issue: {forwardingErrors[lastErrorCode]}{' '}
                    <code>{lastErrorCode}</code>.{' '}
                  </>
                ) : (
                  'A forwarding error was reported. '
                )}
                Ask the server operator to review the mail configuration and forwarding logs.
              </p>
            )}
            {q.data.counts.uncertain > 0 && (
              <p className="notice">
                Some attempts may already have been accepted by Gmail. They will not be retried
                automatically to avoid duplicate copies.
              </p>
            )}
            <p className="muted">
              Disabling forwarding cancels queued copies. A copy already being sent cannot be
              recalled. Members who are no longer Active are excluded before sending.
            </p>
            <div className="item-actions">
              <button
                className={'button' + (q.data.enabled ? ' secondary' : '')}
                disabled={
                  m.isPending ||
                  q.isFetching ||
                  q.isError ||
                  requiresRefresh ||
                  (!q.data.enabled && !q.data.available)
                }
                onClick={() => {
                  if (q.data) m.mutate({ enabled: !q.data.enabled, version: q.data.version })
                }}
              >
                {m.isPending
                  ? 'Saving forwarding…'
                  : q.data.enabled
                    ? 'Disable forwarding'
                    : 'Enable forwarding'}
              </button>
              <button
                className="button secondary"
                disabled={q.isFetching || m.isPending}
                onClick={() => void refresh()}
              >
                Refresh forwarding status
              </button>
            </div>
            {m.isSuccess && m.data.version === q.data.version && (
              <p className="success compact" role="status">
                {m.data.enabled
                  ? 'Forwarding enabled. Future incoming messages will be forwarded to Active members.'
                  : 'Forwarding disabled. Queued copies have been cancelled.'}
              </p>
            )}
          </>
        )
      )}
      {!q.data && q.isError && (
        <button className="button secondary" disabled={q.isFetching} onClick={() => void refresh()}>
          Retry forwarding status
        </button>
      )}
    </section>
  )
}
