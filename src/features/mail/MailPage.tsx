import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Mail, Paperclip, Search, Star, Trash2, X } from 'lucide-react'
import { useAuth } from '../auth/auth-context'
import { api } from '../../shared/api/client'
import type { MailSummary, MailDetail } from '../../shared/types/models'
import { date } from '../../shared/types/models'
import { Empty, ErrorBox, Loading, PageTitle, Pager } from '../../shared/ui/primitives'
export function MailPage() {
  const client = useQueryClient()
  const { user } = useAuth()
  const admin = user?.role === 'ADMIN'
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [unread, setUnread] = useState(false)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<MailSummary | null>(null)
  const opened = useRef<string | null>(null)
  const list = useQuery({
    queryKey: ['mail', 'list', search, unread, page],
    refetchInterval: 30_000,
    queryFn: () =>
      api<MailSummary[]>(
        `/mail/messages?q=${encodeURIComponent(search)}&unread=${unread}&page=${page}`,
      ),
  })
  const detail = useQuery({
    queryKey: ['mail', 'detail', selected?.id],
    queryFn: () => api<MailDetail>(`/mail/messages/${selected?.id}`),
    enabled: !!selected,
    refetchInterval: 30_000,
  })
  const moderation = useMutation({
    mutationFn: ({
      id,
      version,
      important,
    }: {
      id: string
      version: number
      important?: boolean
    }) =>
      api(`/admin/mail/messages/${id}${important === undefined ? '' : '/importance'}`, {
        method: important === undefined ? 'DELETE' : 'PATCH',
        body: important === undefined ? { version } : { version, importantForEveryone: important },
      }),
    retry: false,
    onSuccess: async (_, change) => {
      await client.cancelQueries({ queryKey: ['mail'] })
      if (change.important === undefined) {
        setSelected((current) => (current?.id === change.id ? null : current))
        client.removeQueries({ queryKey: ['mail', 'detail', change.id] })
        setNotice('Message deleted from the shared inbox for everyone.')
      } else {
        setNotice(
          change.important
            ? 'Message marked important for everyone.'
            : 'Shared important flag removed.',
        )
      }
      await Promise.all([
        client.invalidateQueries({ queryKey: ['mail'] }),
        client.invalidateQueries({ queryKey: ['dashboard'] }),
        client.invalidateQueries({ queryKey: ['admin', 'mail'] }),
      ])
    },
  })
  const state = useMutation({
    mutationFn: ({
      id,
      isRead,
      isImportant,
    }: {
      id: string
      isRead?: boolean
      isImportant?: boolean
    }) => api(`/mail/messages/${id}/state`, { method: 'PATCH', body: { isRead, isImportant } }),
    onSuccess: (_, saved) => {
      const { id, ...changes } = saved
      setSelected((current) => (current?.id === id ? { ...current, ...changes } : current))
      client.invalidateQueries({ queryKey: ['mail', 'list'] })
      client.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const changeState = state.mutate
  useEffect(() => {
    // Mark only a successfully loaded message, once per opening. A manual unread
    // action must remain unread until the user opens the message again.
    if (!selected || detail.data?.message.id !== selected.id || opened.current === selected.id)
      return
    opened.current = selected.id
    if (!selected.isRead) changeState({ id: selected.id, isRead: true })
  }, [selected, detail.data, changeState])
  return (
    <>
      <PageTitle
        eyebrow="SHARED INBOX"
        title="Shared inbox"
        text="Your community inbox, with personal stars and messages marked important for everyone by admins."
      />
      <div className="toolbar">
        <form
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault()
            setSearch(draft)
            setPage(0)
          }}
        >
          <Search size={18} />
          <input
            aria-label="Search messages"
            maxLength={100}
            placeholder="Search by subject, sender or content…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="button secondary">Search</button>
        </form>
        <label className="check-label">
          <input
            type="checkbox"
            checked={unread}
            onChange={(e) => {
              setUnread(e.target.checked)
              setPage(0)
            }}
          />
          Unread only
        </label>
      </div>
      <ErrorBox error={list.error ?? state.error} />
      <ErrorBox error={moderation.error} />
      {notice && <p role="status">{notice}</p>}
      {moderation.isError && (
        <p>
          Refresh the message before making another shared change; the previous request may have
          completed.{' '}
          <button
            className="button secondary"
            disabled={detail.isFetching || list.isFetching}
            onClick={async () => {
              const results = await Promise.all([
                list.refetch(),
                ...(selected ? [detail.refetch()] : []),
              ])
              if (results.every((result) => !result.isError)) moderation.reset()
            }}
          >
            Refresh mail
          </button>
        </p>
      )}
      <div className={'mail-layout ' + (selected ? 'has-selection' : '')}>
        <section className="panel inbox-panel">
          {list.isPending ? (
            <Loading />
          ) : list.data?.length ? (
            list.data.map((m) => (
              <div
                key={m.id}
                className={
                  'mail-row ' +
                  (!m.isRead ? 'unread ' : '') +
                  (selected?.id === m.id ? 'selected' : '')
                }
              >
                <button
                  className="icon-button star-button"
                  aria-label={m.isImportant ? 'Remove important flag' : 'Mark as important'}
                  disabled={state.isPending}
                  onClick={() => state.mutate({ id: m.id, isImportant: !m.isImportant })}
                >
                  <Star size={17} fill={m.isImportant ? 'currentColor' : 'none'} />
                </button>
                <button
                  className="mail-select"
                  onClick={() => {
                    opened.current = null
                    setSelected(m)
                  }}
                >
                  <div>
                    <strong>{m.senderName || m.senderAddress || 'Unknown sender'}</strong>
                    <time>{date(m.receivedAt)}</time>
                  </div>
                  <p>{m.subject || '(No subject)'}</p>
                  {m.importantForEveryone && (
                    <small>
                      <Star size={12} fill="currentColor" /> Important for everyone
                    </small>
                  )}
                  {m.attachmentCount > 0 && (
                    <small>
                      <Paperclip size={12} />
                      {m.attachmentCount} attachments
                    </small>
                  )}
                </button>
              </div>
            ))
          ) : (
            !list.isError && (
              <Empty
                title={search || unread ? 'No results' : 'Your inbox is empty'}
                text={
                  search || unread
                    ? 'Try a different search or turn off the filter.'
                    : 'Messages appear here after Gmail is configured and the first sync completes.'
                }
              />
            )
          )}
          <Pager page={page} setPage={setPage} hasNext={list.data?.length === 30} />
        </section>
        {selected ? (
          <section className="panel message-panel">
            <div className="message-toolbar">
              <span>MESSAGE</span>
              <button
                className="icon-button"
                aria-label="Close message"
                onClick={() => setSelected(null)}
              >
                <X size={18} />
              </button>
            </div>
            {detail.isPending ? (
              <Loading />
            ) : detail.isError ? (
              <ErrorBox error={detail.error} />
            ) : (
              detail.data && (
                <>
                  <h2>{detail.data.message.subject || '(No subject)'}</h2>
                  {detail.data.message.importantForEveryone && (
                    <p className="security-note">
                      <Star size={16} fill="currentColor" /> Important for everyone
                    </p>
                  )}
                  <p className="message-meta">
                    <strong>{detail.data.message.senderName}</strong> &lt;
                    {detail.data.message.senderAddress}&gt;
                    <br />
                    {date(detail.data.message.receivedAt)}
                    <br />
                    To:{' '}
                    {detail.data.addresses
                      .filter((a) => a.addressType === 'TO')
                      .map((a) => a.address)
                      .join(', ') || 'No information'}
                  </p>
                  <div className="message-actions">
                    <button
                      className="button secondary"
                      disabled={state.isPending}
                      onClick={() => {
                        state.mutate({
                          id: selected.id,
                          isRead: !selected.isRead,
                        })
                      }}
                    >
                      {selected.isRead ? 'Mark as unread' : 'Mark as read'}
                    </button>
                    {admin && (
                      <>
                        <button
                          className="button secondary"
                          disabled={moderation.isPending || moderation.isError || detail.isFetching}
                          onClick={() => {
                            setNotice('')
                            moderation.mutate({
                              id: selected.id,
                              version: detail.data.message.moderationVersion,
                              important: !detail.data.message.importantForEveryone,
                            })
                          }}
                        >
                          <Star size={16} />{' '}
                          {detail.data.message.importantForEveryone
                            ? 'Remove importance for everyone'
                            : 'Mark important for everyone'}
                        </button>
                        <button
                          className="button danger"
                          disabled={
                            moderation.isPending ||
                            moderation.isError ||
                            state.isPending ||
                            detail.isFetching
                          }
                          onClick={() => {
                            if (
                              confirm(
                                'Delete this message from the shared inbox for everyone? Gmail is unchanged. Queued forwarding is cancelled; copies already sent or being sent cannot be recalled.',
                              )
                            ) {
                              setNotice('')
                              moderation.mutate({
                                id: selected.id,
                                version: detail.data.message.moderationVersion,
                              })
                            }
                          }}
                        >
                          <Trash2 size={16} /> Delete for everyone
                        </button>
                      </>
                    )}
                  </div>
                  {detail.data.message.bodyHtml ? (
                    <iframe
                      title="Sanitized HTML message"
                      className="email-frame"
                      sandbox="allow-popups allow-popups-to-escape-sandbox"
                      referrerPolicy="no-referrer"
                      srcDoc={`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; form-action 'none'; base-uri 'none'"><style>body{font:15px/1.7 system-ui;color:#25334a;overflow-wrap:anywhere}table{max-width:100%}a{color:#275d86}</style></head><body>${detail.data.message.bodyHtml}</body></html>`}
                    />
                  ) : (
                    <pre className="text-email">
                      {detail.data.message.bodyText || 'This message has no displayable text.'}
                    </pre>
                  )}
                  {detail.data.attachments.length > 0 && (
                    <div className="attachments">
                      <h3>Attachments</h3>
                      {detail.data.attachments.map((a) => (
                        <a
                          className="attachment"
                          key={a.id}
                          href={`/api/v1/mail/messages/${selected.id}/attachments/${a.id}/download`}
                        >
                          <Paperclip size={18} />
                          <span>
                            {a.filename}
                            <small>{Math.ceil(a.sizeBytes / 1024)} KB</small>
                          </span>
                          <Download size={18} />
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="security-note">Remote images and active content are blocked.</p>
                </>
              )
            )}
          </section>
        ) : (
          <section className="panel message-placeholder">
            <Mail size={35} strokeWidth={1} />
            <h3>Select a message</h3>
            <p>Its content will appear here.</p>
          </section>
        )}
      </div>
    </>
  )
}
