import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Link2, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../../shared/api/client'
import type { Category, UsefulLink } from '../../shared/types/models'
import { Empty, ErrorBox, Loading, Modal, PageTitle } from '../../shared/ui/primitives'
import { CategoryManager } from '../admin/CategoryManager'
import { useAuth } from '../auth/auth-context'
export function LinksPage({ admin = false }: { admin?: boolean }) {
  const { user } = useAuth()
  const client = useQueryClient()
  const [edit, setEdit] = useState<UsefulLink | 'new' | null>(null)
  const links = useQuery({
    queryKey: ['links', 'list'],
    queryFn: () => api<UsefulLink[]>('/links'),
  })
  const categories = useQuery({
    queryKey: ['links', 'categories'],
    queryFn: () => api<Category[]>('/links/categories'),
  })
  const changed = () => {
    client.invalidateQueries({ queryKey: ['links'] })
    client.invalidateQueries({ queryKey: ['dashboard'] })
  }
  const save = useMutation({
    mutationFn: (body: unknown) =>
      api(edit === 'new' ? '/links' : `/links/${(edit as UsefulLink).id}`, {
        method: edit === 'new' ? 'POST' : 'PATCH',
        body,
      }),
    onSuccess: () => {
      setEdit(null)
      changed()
    },
  })
  const remove = useMutation({
    mutationFn: (l: UsefulLink) => api(`/links/${l.id}?version=${l.version}`, { method: 'DELETE' }),
    onSuccess: changed,
  })
  return (
    <>
      <PageTitle
        eyebrow="QUICK ACCESS"
        title="Useful links"
        text="A shared collection of useful resources. Everyone can add a link."
        action={
          <button
            className="button"
            disabled={!categories.data?.length}
            onClick={() => {
              save.reset()
              setEdit('new')
            }}
          >
            <Plus size={18} />
            Add a link
          </button>
        }
      />
      {admin && (
        <div className="toolbar">
          <CategoryManager kind="links" categories={categories.data ?? []} />
        </div>
      )}
      <ErrorBox error={links.error ?? categories.error ?? remove.error} />
      {links.isPending || categories.isPending ? (
        <Loading />
      ) : links.data?.length ? (
        categories.data?.map((c) => {
          const items = links.data.filter((l) => l.categoryId === c.id)
          return items.length ? (
            <section key={c.id} className="link-section">
              <h2>{c.name}</h2>
              <div className="link-grid">
                {items.map((l) => (
                  <article className="panel link-card" key={l.id}>
                    <span className="resource-icon">
                      <Link2 size={22} />
                    </span>
                    <div className="link-card-body">
                      <a href={l.url} target="_blank" rel="noopener noreferrer">
                        <h3>
                          {l.name}
                          <ArrowUpRight size={18} />
                        </h3>
                      </a>
                      <p>{l.description}</p>
                      <small>{new URL(l.url).hostname}</small>
                      <p className="link-author">Added by {l.authorName}</p>
                      {(user?.role === 'ADMIN' || user?.id === l.authorId) && (
                        <div className="item-actions">
                          <button
                            className="button secondary"
                            onClick={() => {
                              save.reset()
                              setEdit(l)
                            }}
                          >
                            <Pencil size={16} />
                            Edit
                          </button>
                          <button
                            className="icon-button danger"
                            disabled={remove.isPending}
                            aria-label={`${l.name} — delete`}
                            onClick={() => {
                              if (confirm('Delete this link?')) remove.mutate(l)
                            }}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null
        })
      ) : (
        !links.isError &&
        !categories.isError && (
          <div className="panel">
            <Empty
              title="No links yet"
              text={
                categories.data?.length
                  ? 'Share a useful resource with the crew using Add a link.'
                  : 'An administrator needs to add a category before the crew can share links.'
              }
            />
          </div>
        )
      )}
      {edit && (
        <Modal
          title={edit === 'new' ? 'New useful link' : 'Edit link'}
          onClose={() => {
            if (!save.isPending) setEdit(null)
          }}
        >
          <form
            key={edit === 'new' ? 'new' : edit.id}
            onSubmit={(e) => {
              e.preventDefault()
              const f = new FormData(e.currentTarget)
              save.mutate({
                name: f.get('name'),
                url: f.get('url'),
                description: f.get('description'),
                categoryId: f.get('category'),
                sortOrder: Number(f.get('sort')),
                version: edit === 'new' ? 0 : edit.version,
              })
            }}
          >
            <ErrorBox error={save.error} />
            <fieldset className="form-fields" disabled={save.isPending}>
              <label>
                Name
                <input
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={edit === 'new' ? '' : edit.name}
                />
              </label>
              <label>
                URL
                <input
                  name="url"
                  type="url"
                  required
                  maxLength={2048}
                  placeholder="https://"
                  defaultValue={edit === 'new' ? '' : edit.url}
                />
              </label>
              <label>
                Description
                <textarea
                  name="description"
                  rows={3}
                  maxLength={500}
                  defaultValue={edit === 'new' ? '' : edit.description}
                />
              </label>
              <label>
                Category
                <select
                  name="category"
                  required
                  defaultValue={
                    edit === 'new'
                      ? (categories.data?.find((category) => category.name === 'General')?.id ??
                        categories.data?.[0]?.id ??
                        '')
                      : edit.categoryId
                  }
                >
                  <option value="" disabled>
                    Choose a category
                  </option>
                  {categories.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sort order
                <input
                  type="number"
                  name="sort"
                  min={0}
                  required
                  defaultValue={edit === 'new' ? 0 : edit.sortOrder}
                />
              </label>
              <button className="button" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save link'}
              </button>
            </fieldset>
          </form>
        </Modal>
      )}
    </>
  )
}
