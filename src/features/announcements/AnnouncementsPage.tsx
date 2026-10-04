import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, Pin } from 'lucide-react'
import { api } from '../../shared/api/client'
import type { Announcement } from '../../shared/types/models'
import { date } from '../../shared/types/models'
import {
  Empty,
  ErrorBox,
  Loading,
  Markdown,
  Modal,
  PageTitle,
  Pager,
} from '../../shared/ui/primitives'
export function AnnouncementsPage({ admin = false }: { admin?: boolean }) {
  const client = useQueryClient()
  const [page, setPage] = useState(0)
  const [edit, setEdit] = useState<Announcement | 'new' | null>(null)
  const query = useQuery({
    queryKey: ['announcements', page],
    queryFn: () => api<Announcement[]>(`/announcements?page=${page}`),
  })
  const save = useMutation({
    mutationFn: (body: unknown) =>
      api(
        edit === 'new'
          ? '/admin/announcements'
          : `/admin/announcements/${(edit as Announcement).id}`,
        { method: edit === 'new' ? 'POST' : 'PATCH', body },
      ),
    onSuccess: () => {
      setEdit(null)
      client.invalidateQueries({ queryKey: ['announcements'] })
      client.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const remove = useMutation({
    mutationFn: (a: Announcement) =>
      api(`/admin/announcements/${a.id}?version=${a.version}`, { method: 'DELETE' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['announcements'] })
      client.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  return (
    <>
      <PageTitle
        eyebrow="BRIEFING"
        title="Announcements"
        text="The latest news and important updates for your class."
        action={
          admin && (
            <button
              className="button"
              onClick={() => {
                save.reset()
                setEdit('new')
              }}
            >
              <Plus size={18} />
              New announcement
            </button>
          )
        }
      />
      <ErrorBox error={query.error ?? remove.error} />
      {query.isPending ? (
        <Loading />
      ) : query.data?.length ? (
        <div className="announcement-list">
          {query.data.map((a) => (
            <article id={a.id} className="panel article-card" key={a.id}>
              <div className="briefing-meta">
                <span className={'tag ' + (a.important ? 'orange' : '')}>
                  {a.important ? (
                    <>
                      <Pin size={12} />
                      Important
                    </>
                  ) : (
                    'Class update'
                  )}
                </span>
                <span>
                  {date(a.createdAt)} · {a.authorName}
                </span>
              </div>
              <h2>{a.title}</h2>
              <Markdown>{a.bodyMarkdown}</Markdown>
              {admin && (
                <div className="item-actions">
                  <button
                    className="button secondary"
                    onClick={() => {
                      save.reset()
                      setEdit(a)
                    }}
                  >
                    <Pencil size={16} />
                    Edit
                  </button>
                  <button
                    className="icon-button danger"
                    disabled={remove.isPending}
                    aria-label={`${a.title} — delete`}
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this announcement?'))
                        remove.mutate(a)
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        !query.isError && (
          <div className="panel">
            <Empty
              title="No announcements yet"
              text="New announcements appear here and on the dashboard."
            />
          </div>
        )
      )}
      <Pager page={page} setPage={setPage} hasNext={query.data?.length === 20} />
      {edit && (
        <Modal
          title={edit === 'new' ? 'New announcement' : 'Edit announcement'}
          onClose={() => setEdit(null)}
        >
          <form
            key={edit === 'new' ? 'new' : edit.id}
            onSubmit={(e) => {
              e.preventDefault()
              const f = new FormData(e.currentTarget)
              save.mutate({
                title: f.get('title'),
                bodyMarkdown: f.get('body'),
                important: f.get('important') === 'on',
                version: edit === 'new' ? 0 : edit.version,
              })
            }}
          >
            <ErrorBox error={save.error} />
            <label>
              Title
              <input
                name="title"
                maxLength={180}
                required
                defaultValue={edit === 'new' ? '' : edit.title}
              />
            </label>
            <label>
              Content · Markdown
              <textarea
                name="body"
                rows={10}
                maxLength={30000}
                required
                defaultValue={edit === 'new' ? '' : edit.bodyMarkdown}
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                name="important"
                defaultChecked={edit !== 'new' && edit.important}
              />
              Pin as an important announcement
            </label>
            <button className="button" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save announcement'}
            </button>
          </form>
        </Modal>
      )}
    </>
  )
}
