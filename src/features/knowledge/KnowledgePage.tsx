import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, BookOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../../shared/api/client'
import type { Article, Category } from '../../shared/types/models'
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
import { CategoryManager } from '../admin/CategoryManager'
export function KnowledgePage({ admin = false }: { admin?: boolean }) {
  const client = useQueryClient()
  const [page, setPage] = useState(0)
  const [category, setCategory] = useState('')
  const [edit, setEdit] = useState<Article | 'new' | null>(null)
  const categories = useQuery({
    queryKey: ['knowledge', 'categories'],
    queryFn: () => api<Category[]>('/knowledge/categories'),
  })
  const articles = useQuery({
    queryKey: ['knowledge', 'articles', category, page],
    queryFn: () =>
      api<Article[]>(`/knowledge/articles?page=${page}${category ? '&category=' + category : ''}`),
  })
  const changed = () => {
    client.invalidateQueries({ queryKey: ['knowledge'] })
    client.invalidateQueries({ queryKey: ['dashboard'] })
  }
  const save = useMutation({
    mutationFn: (body: unknown) =>
      api(
        edit === 'new'
          ? '/admin/knowledge/articles'
          : `/admin/knowledge/articles/${(edit as Article).id}`,
        { method: edit === 'new' ? 'POST' : 'PATCH', body },
      ),
    onSuccess: () => {
      setEdit(null)
      changed()
    },
  })
  const remove = useMutation({
    mutationFn: (a: Article) =>
      api(`/admin/knowledge/articles/${a.id}?version=${a.version}`, { method: 'DELETE' }),
    onSuccess: changed,
  })
  return (
    <>
      <PageTitle
        eyebrow="KNOWLEDGE BASE"
        title="Knowledge base"
        text="What we learn becomes something we share."
        action={
          admin && (
            <button
              className="button"
              disabled={!categories.data?.length}
              onClick={() => {
                save.reset()
                setEdit('new')
              }}
            >
              <Plus size={18} />
              New article
            </button>
          )
        }
      />
      <div className="toolbar">
        <label className="inline-label">
          Category
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              setPage(0)
            }}
          >
            <option value="">All categories</option>
            {categories.data?.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {admin && <CategoryManager kind="knowledge" categories={categories.data ?? []} />}
      </div>
      <ErrorBox error={articles.error ?? categories.error ?? remove.error} />
      {articles.isPending ? (
        <Loading />
      ) : articles.data?.length ? (
        <div className="knowledge-grid">
          {articles.data.map((a) => (
            <article key={a.id} className="panel knowledge-card">
              <div className="knowledge-card-top">
                <span className="resource-icon">
                  <BookOpen size={23} />
                </span>
                <span className="tag">{a.categoryName}</span>
              </div>
              <Link to={`/knowledge/${a.id}`}>
                <h2>{a.title}</h2>
              </Link>
              <p>
                {a.bodyMarkdown.slice(0, 150)}
                {a.bodyMarkdown.length > 150 ? '…' : ''}
              </p>
              <div className="byline">
                <span>
                  {date(a.updatedAt)} · {a.authorName}
                </span>
                <Link aria-label={`${a.title} — open`} to={`/knowledge/${a.id}`}>
                  <ArrowUpRight size={19} />
                </Link>
              </div>
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
                      if (confirm('Are you sure you want to delete this article?')) remove.mutate(a)
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
        !articles.isError && (
          <div className="panel">
            <Empty
              title="The knowledge base is empty"
              text={
                admin
                  ? 'Create a category, then write your first article.'
                  : 'Articles from the community knowledge base will appear here.'
              }
            />
          </div>
        )
      )}
      <Pager page={page} setPage={setPage} hasNext={articles.data?.length === 20} />
      {edit && (
        <Modal
          title={edit === 'new' ? 'New knowledge article' : 'Edit article'}
          onClose={() => setEdit(null)}
        >
          <form
            key={edit === 'new' ? 'new' : edit.id}
            onSubmit={(e) => {
              e.preventDefault()
              const f = new FormData(e.currentTarget)
              save.mutate({
                title: f.get('title'),
                categoryId: f.get('category'),
                bodyMarkdown: f.get('body'),
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
              Category
              <select name="category" required defaultValue={edit === 'new' ? '' : edit.categoryId}>
                <option value="" disabled>
                  Choose a category
                </option>
                {categories.data?.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Content · Markdown
              <textarea
                name="body"
                rows={14}
                maxLength={100000}
                required
                defaultValue={edit === 'new' ? '' : edit.bodyMarkdown}
              />
            </label>
            <button className="button" disabled={save.isPending}>
              Save article
            </button>
          </form>
        </Modal>
      )}
    </>
  )
}
export function ArticlePage() {
  const { id } = useParams()
  const query = useQuery({
    queryKey: ['knowledge', 'article', id],
    queryFn: () => api<Article>(`/knowledge/articles/${id}`),
  })
  if (query.isPending) return <Loading />
  if (query.isError) return <ErrorBox error={query.error} />
  const a = query.data
  return (
    <>
      <Link to="/knowledge" className="text-link back-link">
        <ArrowLeft size={17} />
        Back to knowledge base
      </Link>
      <PageTitle
        eyebrow={a.categoryName}
        title={a.title}
        text={`${a.authorName} · Updated: ${date(a.updatedAt)}`}
      />
      <article className="panel article-card">
        <Markdown>{a.bodyMarkdown}</Markdown>
      </article>
    </>
  )
}
