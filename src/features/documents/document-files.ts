export const MAX_DOCUMENT_FILES = 5
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024

export function validateDocumentFiles(files: Pick<File, 'name' | 'size'>[]): string | null {
  if (!files.length) return 'Choose at least one file to share.'
  if (files.length > MAX_DOCUMENT_FILES) return 'You can add up to 5 files to one post.'
  const empty = files.find((file) => file.size === 0)
  if (empty) return `“${empty.name}” is empty. Choose a file with content.`
  const oversized = files.find((file) => file.size > MAX_DOCUMENT_BYTES)
  return oversized ? `“${oversized.name}” exceeds the 50 MB limit per file.` : null
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
