export type User = {
  id: string
  email: string
  displayName: string
  status: string
  role: 'USER' | 'ADMIN'
  version: number
  createdAt: string
}
export type Category = { id: string; name: string; sortOrder: number }
export type Announcement = {
  id: string
  title: string
  bodyMarkdown: string
  important: boolean
  authorName: string
  createdAt: string
  updatedAt: string
  version: number
}
export type Article = {
  id: string
  categoryId: string
  categoryName: string
  title: string
  bodyMarkdown: string
  authorName: string
  createdAt: string
  updatedAt: string
  version: number
}
export type UsefulLink = {
  id: string
  categoryId: string
  categoryName: string
  name: string
  url: string
  description: string
  sortOrder: number
  version: number
  authorId: string | null
  authorName: string
  createdAt: string
}
export type DocumentPost = {
  id: string
  title: string
  description: string
  authorId: string
  authorName: string
  createdAt: string
  updatedAt: string
  version: number
  fileCount: number
  commentCount: number
}
export type DocumentUpload = {
  id: string
  filename: string
  sizeBytes: number
  contentType: string
  expiresAt: string
}
export type DocumentComment = {
  id: string
  body: string
  authorId: string
  authorName: string
  createdAt: string
  updatedAt: string
  version: number
}
export type DocumentDetail = {
  post: DocumentPost
  files: { id: string; filename: string; sizeBytes: number; contentType: string }[]
  comments: DocumentComment[]
}
export type CalendarEvent = {
  id: string
  title: string
  description: string
  type: 'EXAM' | 'EVENT' | 'DEADLINE'
  startsAt: string
  endsAt: string | null
  allDay: boolean
  location: string
  authorId: string
  authorName: string
  createdAt: string
  updatedAt: string
  version: number
}
export type MailSummary = {
  id: string
  subject: string
  senderAddress: string
  senderName: string
  receivedAt: string
  isRead: boolean
  isImportant: boolean
  attachmentCount: number
}
export type MailDetail = {
  message: {
    id: string
    subject: string
    senderAddress: string
    senderName: string
    receivedAt: string
    bodyText: string
    bodyHtml: string
  }
  addresses: { addressType: string; address: string; displayName: string }[]
  attachments: { id: string; filename: string; contentType: string; sizeBytes: number }[]
}
export function date(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value.endsWith('Z') ? value : value + 'Z'))
}
export const statusLabels: Record<string, string> = {
  ACTIVE: 'Active',
  PENDING_APPROVAL: 'Pending approval',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
  DISABLED: 'Disabled',
}
