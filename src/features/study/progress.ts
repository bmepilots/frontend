// Current responses use ISO UTC createdAt. Legacy JDBC values may be epoch
// milliseconds or a timezone-less SQL timestamp; never append Z to an offset.
export function attemptDate(value: string | number | null | undefined) {
  if (value == null || value === '') return 'Date unavailable'
  let normalized: string | number = value
  if (typeof value === 'string') {
    normalized = value.trim().replace(' ', 'T')
    if (
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized) &&
      !/(Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
    )
      normalized += 'Z'
  }
  const parsed = new Date(normalized)
  if (!Number.isFinite(parsed.getTime())) return 'Date unavailable'
  return parsed.toLocaleString('en-GB', { timeZone: 'Europe/Budapest' }) + ' (Budapest)'
}
