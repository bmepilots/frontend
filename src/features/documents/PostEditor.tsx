import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { FileText, Upload, X } from 'lucide-react'
import { api, ApiError, errorMessage } from '../../shared/api/client'
import type { DocumentPost, DocumentUpload } from '../../shared/types/models'
import { ErrorBox, Modal } from '../../shared/ui/primitives'
import { fileSize, validateDocumentFiles } from './document-files'

const discard = (upload: DocumentUpload) =>
  api(`/documents/uploads/${upload.id}`, { method: 'DELETE' }).catch(() => {
    // Expiry also removes abandoned uploads when cleanup cannot reach the server.
  })

export function PostEditor({
  post,
  onClose,
  onSaved,
}: {
  post?: DocumentPost
  onClose: () => void
  onSaved: () => void
}) {
  const [files, setFiles] = useState<File[]>([])
  const [validation, setValidation] = useState<Error | null>(null)
  const [progress, setProgress] = useState('')
  const [readyFiles, setReadyFiles] = useState<File[]>([])
  const [publicationStarted, setPublicationStarted] = useState(false)
  const [uploadsUnavailable, setUploadsUnavailable] = useState(false)
  const uploads = useRef(new Map<File, DocumentUpload>())
  const mounted = useRef(true)

  useEffect(() => {
    const staged = uploads.current
    mounted.current = true
    return () => {
      mounted.current = false
      for (const upload of staged.values()) void discard(upload)
      staged.clear()
    }
  }, [])

  const save = useMutation({
    mutationFn: async ({ title, description }: { title: string; description: string }) => {
      if (post)
        return api(`/documents/${post.id}`, {
          method: 'PATCH',
          body: { title, description, version: post.version },
        })

      for (const [index, file] of files.entries()) {
        const staged = uploads.current.get(file)
        // Never replace IDs after publication was attempted: a lost response may
        // mean the post already exists, and retrying those IDs cannot duplicate it.
        const expiry = staged
          ? Date.parse(staged.expiresAt.endsWith('Z') ? staged.expiresAt : staged.expiresAt + 'Z')
          : 0
        if (staged && (publicationStarted || expiry > Date.now())) continue
        uploads.current.delete(file)
        setReadyFiles([...uploads.current.keys()])
        setProgress(`Uploading file ${index + 1} of ${files.length}: ${file.name}`)
        const body = new FormData()
        body.append('file', file)
        let uploaded: DocumentUpload
        try {
          uploaded = await api<DocumentUpload>('/documents/uploads', { method: 'POST', body })
        } catch (error) {
          throw new Error(`Could not upload ${file.name}. ${errorMessage(error)}`)
        }
        if (!mounted.current) {
          await discard(uploaded)
          return
        }
        uploads.current.set(file, uploaded)
        setReadyFiles([...uploads.current.keys()])
      }

      if (!mounted.current) return
      setProgress('Publishing your documents…')
      setPublicationStarted(true)
      try {
        await api('/documents', {
          method: 'POST',
          body: {
            title,
            description,
            uploadIds: files.map((file) => uploads.current.get(file)!.id),
          },
        })
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          setUploadsUnavailable(true)
          throw new Error(
            'These uploads are no longer available. Close this window and check Shared documents before starting a new post.',
          )
        }
        throw error
      }
      // Consumed uploads belong to the published post and must not be discarded.
      uploads.current.clear()
    },
    onSuccess: () => {
      if (mounted.current) onSaved()
    },
    onSettled: () => {
      if (mounted.current) setProgress('')
    },
  })

  const close = () => {
    if (!save.isPending) onClose()
  }

  return (
    <Modal title={post ? 'Edit document post' : 'Share documents'} onClose={close}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setValidation(null)
          const fields = new FormData(event.currentTarget)
          if (!post) {
            const error = validateDocumentFiles(files)
            if (error) {
              setValidation(new Error(error))
              return
            }
          }
          save.mutate({
            title: String(fields.get('title') ?? '').trim(),
            description: String(fields.get('description') ?? '').trim(),
          })
        }}
      >
        <ErrorBox error={validation ?? save.error} />
        <fieldset disabled={save.isPending || uploadsUnavailable} className="form-fields">
          <label>
            Title
            <input
              name="title"
              required
              maxLength={180}
              defaultValue={post?.title ?? ''}
              placeholder="Give these documents a useful title"
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              rows={5}
              maxLength={100000}
              defaultValue={post?.description ?? ''}
              placeholder="What are you sharing? Add context, instructions or a question for the crew."
            />
          </label>
          {!post && (
            <>
              <label className="upload-picker">
                <Upload size={25} />
                <strong>Choose files to share</strong>
                <span>Up to 5 files · 50 MB per file</span>
                <input
                  type="file"
                  multiple
                  disabled={publicationStarted}
                  aria-label="Choose document files"
                  onChange={(event) => {
                    const next = [...files, ...Array.from(event.target.files ?? [])]
                    const error = validateDocumentFiles(next)
                    if (error) setValidation(new Error(error))
                    else {
                      setFiles(next)
                      setValidation(null)
                    }
                    event.target.value = ''
                  }}
                />
              </label>
              <div className="selected-files" aria-live="polite">
                {files.map((file, index) => (
                  <div className="selected-file" key={`${file.name}-${index}`}>
                    <FileText size={18} />
                    <span>
                      {file.name}
                      <small>
                        {fileSize(file.size)}
                        {readyFiles.includes(file) ? ' · Ready to publish' : ''}
                      </small>
                    </span>
                    <button
                      type="button"
                      className="icon-button"
                      disabled={publicationStarted}
                      aria-label={`Remove ${file.name}`}
                      onClick={() => {
                        const uploaded = uploads.current.get(file)
                        if (uploaded) void discard(uploaded)
                        uploads.current.delete(file)
                        setReadyFiles([...uploads.current.keys()])
                        setFiles(files.filter((_, i) => i !== index))
                        setValidation(null)
                      }}
                    >
                      <X size={17} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {post && (
            <p className="form-hint">
              This updates the title and description. To share a different set of files, create a
              new post.
            </p>
          )}
        </fieldset>
        {progress && (
          <p className="form-hint" role="status">
            {progress} Please keep this window open.
          </p>
        )}
        {!post && save.isError && !uploadsUnavailable && (
          <p className="form-hint">
            {publicationStarted
              ? 'Retry publishing with these files, or close this window and check Shared documents.'
              : 'Files already uploaded will be reused when you retry. You can also remove a file or cancel.'}
          </p>
        )}
        <div className="form-actions">
          <button className="button" disabled={save.isPending || uploadsUnavailable}>
            <Upload size={16} />
            {save.isPending
              ? post
                ? 'Saving…'
                : 'Uploading… Please keep this window open'
              : post
                ? 'Save changes'
                : save.isError && !uploadsUnavailable
                  ? 'Retry publishing'
                  : 'Publish documents'}
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={save.isPending}
            onClick={close}
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
