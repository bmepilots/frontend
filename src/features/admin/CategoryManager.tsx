import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { api } from '../../shared/api/client'
import type { Category } from '../../shared/types/models'
import { ErrorBox, Modal } from '../../shared/ui/primitives'
export function CategoryManager({
  kind,
  categories,
}: {
  kind: 'knowledge' | 'links'
  categories: Category[]
}) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Category | null>(null)
  const mutation = useMutation({
    mutationFn: ({ id, body, remove }: { id?: string; body?: unknown; remove?: boolean }) =>
      api(`/admin/${kind}/categories${id ? '/' + id : ''}`, {
        method: remove ? 'DELETE' : id ? 'PATCH' : 'POST',
        body,
      }),
    onSuccess: () => {
      setEdit(null)
      client.invalidateQueries({ queryKey: [kind] })
      client.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  return (
    <>
      <button className="button secondary" onClick={() => setOpen(true)}>
        Manage categories
      </button>
      {open && (
        <Modal title="Categories" onClose={() => setOpen(false)}>
          <ErrorBox error={mutation.error} />
          <p className="muted">
            Lower sort numbers appear first. Categories in use cannot be deleted.
          </p>
          <div className="category-list">
            {categories.map((c) => (
              <div className="category-row" key={c.id}>
                <span>
                  {c.sortOrder} · {c.name}
                </span>
                <button
                  className="icon-button"
                  aria-label={`${c.name} — edit`}
                  onClick={() => setEdit(c)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-button danger"
                  disabled={mutation.isPending}
                  aria-label={`${c.name} — delete`}
                  onClick={() => {
                    if (confirm('Delete this category?'))
                      mutation.mutate({ id: c.id, remove: true })
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <form
            key={edit?.id ?? 'new'}
            onSubmit={(e) => {
              e.preventDefault()
              const form = e.currentTarget
              const f = new FormData(form)
              mutation.mutate(
                {
                  id: edit?.id,
                  body: { name: f.get('name'), sortOrder: Number(f.get('sortOrder')) },
                },
                { onSuccess: () => form.reset() },
              )
            }}
          >
            <h3>{edit ? 'Edit category' : 'New category'}</h3>
            <label>
              Name
              <input name="name" required maxLength={100} defaultValue={edit?.name} />
            </label>
            <label>
              Sort order
              <input
                name="sortOrder"
                type="number"
                required
                min={0}
                defaultValue={edit?.sortOrder ?? 0}
              />
            </label>
            <div className="item-actions">
              <button className="button" disabled={mutation.isPending}>
                Save
              </button>
              {edit && (
                <button type="button" className="button secondary" onClick={() => setEdit(null)}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
