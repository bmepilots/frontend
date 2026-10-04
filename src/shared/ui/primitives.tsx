import { ArrowLeft, ArrowRight, Inbox, LoaderCircle, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { errorMessage } from '../api/client'
export function Loading() {
  return (
    <div className="state">
      <LoaderCircle className="spin" size={24} />
      <span>Loading…</span>
    </div>
  )
}
export function ErrorBox({ error }: { error: unknown }) {
  return error ? (
    <div className="error" role="alert">
      {errorMessage(error)}
    </div>
  ) : null
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={26} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}
export function PageTitle({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  )
}
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: () => <span>[External image blocked]</span>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
export function Pager({
  page,
  setPage,
  hasNext,
}: {
  page: number
  setPage: (n: number) => void
  hasNext: boolean
}) {
  return (
    <div className="pager">
      <button className="button secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
        <ArrowLeft size={16} />
        Previous
      </button>
      <span>Page {page + 1}</span>
      <button className="button secondary" disabled={!hasNext} onClick={() => setPage(page + 1)}>
        Next
        <ArrowRight size={16} />
      </button>
    </div>
  )
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  )
}
