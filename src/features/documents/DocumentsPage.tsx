import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  FileText,
  Files,
  MessageSquare,
  Pencil,
  Search,
  Send,
  Trash2,
  Upload,
} from 'lucide-react'
import { api } from '../../shared/api/client'
import { date } from '../../shared/types/models'
import type { DocumentComment, DocumentDetail, DocumentPost } from '../../shared/types/models'
import { Empty, ErrorBox, Loading, Modal, PageTitle, Pager } from '../../shared/ui/primitives'
import { useAuth } from '../auth/auth-context'
import { fileSize } from './document-files'
import { PostEditor } from './PostEditor'

export function DocumentsPage() {
  const client = useQueryClient()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const query = useQuery({
    queryKey: ['documents', 'list', search, page],
    queryFn: () => api<DocumentPost[]>(`/documents?q=${encodeURIComponent(search)}&page=${page}`),
  })
  return (
    <>
      <PageTitle
        eyebrow="SHARED BY THE CREW"
        title="Shared documents"
        text="Course notes, helpful files and conversations that move us forward."
        action={
          <button className="button" onClick={() => setUploading(true)}>
            <Upload size={17} />
            Share documents
          </button>
        }
      />
      <div className="community-intro">
        <span className="resource-icon">
          <Files size={23} />
        </span>
        <div>
          <strong>Something useful? Pass it on.</strong>
          <p>Everyone can share documents, ask questions and add to the conversation.</p>
        </div>
        <span className="tag">5 files per post · 50 MB each</span>
      </div>
      <div className="toolbar">
        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault()
            setSearch(String(new FormData(event.currentTarget).get('search') ?? '').trim())
            setPage(0)
          }}
        >
          <Search size={18} />
          <input
            name="search"
            aria-label="Search shared documents"
            placeholder="Search titles and descriptions…"
            maxLength={200}
          />
          <button className="button" type="submit">
            Search
          </button>
        </form>
      </div>
      <ErrorBox error={query.error} />
      {query.isPending ? (
        <Loading />
      ) : query.data?.length ? (
        <div className="document-grid">
          {query.data.map((post) => (
            <article className="panel document-card" key={post.id}>
              <div className="document-card-top">
                <span className="resource-icon">
                  <Files size={24} />
                </span>
                <time dateTime={post.createdAt}>{date(post.createdAt)}</time>
              </div>
              <Link to={`/documents/${post.id}`} className="document-title">
                <h2>{post.title}</h2>
                <ArrowUpRight size={18} />
              </Link>
              <p className="document-excerpt">
                {post.description ||
                  'Open this post to view the shared files and join the conversation.'}
              </p>
              <div className="document-card-meta">
                <span>
                  <FileText size={14} />
                  {post.fileCount} {post.fileCount === 1 ? 'file' : 'files'}
                </span>
                <span>
                  <MessageSquare size={14} />
                  {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
                </span>
              </div>
              <div className="document-author">
                <span className="avatar">{post.authorName.slice(0, 1).toUpperCase()}</span>
                <span>
                  Shared by <strong>{post.authorName}</strong>
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        !query.isError && (
          <div className="panel">
            <Empty
              title={search ? 'No matching documents' : 'Start the shared library'}
              text={
                search
                  ? 'Try a different search or browse all documents.'
                  : 'Share your first notes, a useful reference or course material with the crew.'
              }
              action={
                <button className="text-link" onClick={() => setUploading(true)}>
                  <Upload size={16} />
                  Share documents
                </button>
              }
            />
          </div>
        )
      )}
      <Pager page={page} setPage={setPage} hasNext={query.data?.length === 20} />
      {uploading && (
        <PostEditor
          onClose={() => {
            setUploading(false)
            // A lost publication response may still have created the post.
            client.invalidateQueries({ queryKey: ['documents'] })
            client.invalidateQueries({ queryKey: ['dashboard'] })
          }}
          onSaved={() => {
            setUploading(false)
            setPage(0)
            client.invalidateQueries({ queryKey: ['documents'] })
            client.invalidateQueries({ queryKey: ['dashboard'] })
          }}
        />
      )}
    </>
  )
}

export function DocumentPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const client = useQueryClient()
  const navigate = useNavigate()
  const [editingPost, setEditingPost] = useState(false)
  const [editingComment, setEditingComment] = useState<DocumentComment | null>(null)
  const [commentBody, setCommentBody] = useState('')
  const query = useQuery({
    queryKey: ['documents', 'detail', id],
    queryFn: () => api<DocumentDetail>(`/documents/${id}`),
  })
  const changed = () => {
    client.invalidateQueries({ queryKey: ['documents'] })
    client.invalidateQueries({ queryKey: ['dashboard'] })
  }
  const removePost = useMutation({
    mutationFn: (post: DocumentPost) =>
      api(`/documents/${post.id}?version=${post.version}`, { method: 'DELETE' }),
    onSuccess: () => {
      changed()
      navigate('/documents')
    },
  })
  const comment = useMutation({
    mutationFn: (body: string) =>
      api(`/documents/${id}/comments`, { method: 'POST', body: { body } }),
    onSuccess: () => {
      setCommentBody('')
      changed()
    },
  })
  const updateComment = useMutation({
    mutationFn: ({ item, body }: { item: DocumentComment; body: string }) =>
      api(`/documents/${id}/comments/${item.id}`, {
        method: 'PATCH',
        body: { body, version: item.version },
      }),
    onSuccess: () => {
      setEditingComment(null)
      changed()
    },
  })
  const removeComment = useMutation({
    mutationFn: (item: DocumentComment) =>
      api(`/documents/${id}/comments/${item.id}?version=${item.version}`, { method: 'DELETE' }),
    onSuccess: changed,
  })
  if (query.isPending) return <Loading />
  if (query.isError) return <ErrorBox error={query.error} />
  const { post, files, comments } = query.data
  const canManage = (authorId: string) => user?.id === authorId || user?.role === 'ADMIN'
  return (
    <>
      <Link to="/documents" className="text-link back-link">
        <ArrowLeft size={16} />
        Back to shared documents
      </Link>
      <PageTitle
        eyebrow="SHARED DOCUMENTS"
        title={post.title}
        text={`Shared by ${post.authorName} · ${date(post.createdAt)}`}
        action={
          canManage(post.authorId) && (
            <div className="inline-actions">
              <button className="button secondary" onClick={() => setEditingPost(true)}>
                <Pencil size={16} />
                Edit post
              </button>
              <button
                className="icon-button danger"
                disabled={removePost.isPending}
                aria-label="Delete document post"
                onClick={() => {
                  if (confirm('Delete this post, its files and all comments?'))
                    removePost.mutate(post)
                }}
              >
                <Trash2 size={19} />
              </button>
            </div>
          )
        }
      />
      <ErrorBox error={removePost.error ?? removeComment.error} />
      <div className="document-detail-layout">
        <article className="panel document-content">
          <h2>About these documents</h2>
          <p className="preserve-text">{post.description || 'No description was added.'}</p>
          {post.updatedAt !== post.createdAt && (
            <small className="muted">Updated {date(post.updatedAt)}</small>
          )}
          <section className="document-downloads">
            <h3>
              {files.length} {files.length === 1 ? 'file' : 'files'} to download
            </h3>
            {files.map((file) => (
              <a
                className="attachment"
                key={file.id}
                href={`/api/v1/documents/${post.id}/files/${file.id}/download`}
                download={file.filename}
              >
                <FileText size={21} />
                <span>
                  {file.filename}
                  <small>{fileSize(file.sizeBytes)}</small>
                </span>
                <Download size={18} />
              </a>
            ))}
          </section>
        </article>
        <aside className="panel document-context">
          <span className="eyebrow">CREW CONTRIBUTION</span>
          <div className="document-author">
            <span className="avatar">{post.authorName.slice(0, 1).toUpperCase()}</span>
            <strong>{post.authorName}</strong>
          </div>
          <p>
            Have a question or something to add? Leave a comment below and keep the knowledge
            growing.
          </p>
          <a className="text-link" href="#discussion">
            <MessageSquare size={16} />
            Join the discussion
          </a>
        </aside>
      </div>
      <section className="panel discussion" id="discussion">
        <div className="discussion-heading">
          <div>
            <span className="eyebrow">LEARN TOGETHER</span>
            <h2>
              Discussion <span className="tag">{comments.length}</span>
            </h2>
          </div>
          <MessageSquare size={24} />
        </div>
        <form
          className="comment-composer"
          onSubmit={(event) => {
            event.preventDefault()
            if (commentBody.trim()) comment.mutate(commentBody.trim())
          }}
        >
          <ErrorBox error={comment.error} />
          <label>
            Add a comment
            <textarea
              rows={3}
              required
              maxLength={5000}
              value={commentBody}
              disabled={comment.isPending}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder="Ask a question, share a tip or add useful context…"
            />
          </label>
          <button className="button" disabled={comment.isPending || !commentBody.trim()}>
            <Send size={16} />
            {comment.isPending ? 'Posting…' : 'Post comment'}
          </button>
        </form>
        {comments.length ? (
          <div className="comment-list">
            {comments.map((item) => (
              <article className="comment" key={item.id}>
                <div className="comment-top">
                  <span className="avatar">{item.authorName.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{item.authorName}</strong>
                    <small>
                      {date(item.createdAt)}
                      {item.createdAt !== item.updatedAt ? ' · Edited' : ''}
                    </small>
                  </div>
                  {canManage(item.authorId) && (
                    <div className="inline-actions">
                      <button
                        className="icon-button"
                        aria-label={`Edit comment by ${item.authorName}`}
                        onClick={() => {
                          updateComment.reset()
                          setEditingComment(item)
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button danger"
                        aria-label={`Delete comment by ${item.authorName}`}
                        disabled={removeComment.isPending}
                        onClick={() => {
                          if (confirm('Delete this comment?')) removeComment.mutate(item)
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
                <p className="preserve-text">{item.body}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="small-empty">No comments yet. Start the conversation.</div>
        )}
      </section>
      {editingPost && (
        <PostEditor
          post={post}
          onClose={() => setEditingPost(false)}
          onSaved={() => {
            setEditingPost(false)
            changed()
          }}
        />
      )}
      {editingComment && (
        <Modal
          title="Edit comment"
          onClose={() => {
            if (!updateComment.isPending) setEditingComment(null)
          }}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const body = String(new FormData(event.currentTarget).get('body') ?? '').trim()
              if (body) updateComment.mutate({ item: editingComment, body })
            }}
          >
            <ErrorBox error={updateComment.error} />
            <label>
              Comment
              <textarea
                name="body"
                rows={5}
                required
                maxLength={5000}
                defaultValue={editingComment.body}
              />
            </label>
            <button className="button" disabled={updateComment.isPending}>
              {updateComment.isPending ? 'Saving…' : 'Save comment'}
            </button>
          </form>
        </Modal>
      )}
    </>
  )
}
