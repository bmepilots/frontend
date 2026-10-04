import { describe, expect, it } from 'vitest'
import { MAX_DOCUMENT_BYTES, validateDocumentFiles } from './document-files'

describe('Document upload limits', () => {
  it('allows five files at the exact 50 MiB boundary', () => {
    expect(
      validateDocumentFiles(
        Array.from({ length: 5 }, (_, index) => ({
          name: `notes-${index}.pdf`,
          size: MAX_DOCUMENT_BYTES,
        })),
      ),
    ).toBeNull()
  })
  it('rejects files one byte beyond the boundary', () => {
    expect(validateDocumentFiles([{ name: 'large.pdf', size: MAX_DOCUMENT_BYTES + 1 }])).toContain(
      '50 MB',
    )
  })
  it('rejects a sixth file even when the files are small', () => {
    expect(
      validateDocumentFiles(Array.from({ length: 6 }, () => ({ name: 'notes.txt', size: 10 }))),
    ).toContain('5 files')
  })
  it('rejects empty selections and empty file contents', () => {
    expect(validateDocumentFiles([])).toContain('at least one')
    expect(validateDocumentFiles([{ name: 'empty.txt', size: 0 }])).toContain('empty')
  })
})
