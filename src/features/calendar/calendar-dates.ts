import type { CalendarEvent } from '../../shared/types/models'

// Calendar fields are Budapest wall times. UTC here is a stable date arithmetic
// container only: never convert these strings through the browser's local zone.
export function dateKey(value: Date) {
  return value.toISOString().slice(0, 10)
}
export function shiftDay(day: string, amount: number) {
  const value = new Date(day + 'T12:00:00Z')
  value.setUTCDate(value.getUTCDate() + amount)
  return dateKey(value)
}
export function budapestToday() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = (type: string) => parts.find((part) => part.type === type)?.value
  return `${value('year')}-${value('month')}-${value('day')}`
}
export function monthGrid(month: string) {
  const first = `${month.slice(0, 7)}-01`
  const weekday = new Date(first + 'T12:00:00Z').getUTCDay()
  const start = shiftDay(first, -((weekday + 6) % 7))
  return Array.from({ length: 42 }, (_, index) => shiftDay(start, index))
}
export function shiftMonth(month: string, amount: number) {
  const value = new Date(month.slice(0, 7) + '-01T12:00:00Z')
  value.setUTCMonth(value.getUTCMonth() + amount)
  return dateKey(value)
}
export function occursOnDay(
  event: Pick<CalendarEvent, 'startsAt' | 'endsAt' | 'allDay'>,
  day: string,
) {
  const start = event.startsAt.slice(0, 16)
  const end =
    event.endsAt?.slice(0, 16) ??
    (event.allDay ? shiftDay(start.slice(0, 10), 1) + 'T00:00' : start)
  return (
    start < shiftDay(day, 1) + 'T00:00' &&
    (end === start ? start >= day + 'T00:00' : end > day + 'T00:00')
  )
}
export function calendarDay(
  day: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
) {
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(
    new Date(day.slice(0, 10) + 'T12:00:00Z'),
  )
}
export function eventWhen(event: Pick<CalendarEvent, 'startsAt' | 'endsAt' | 'allDay'>) {
  const start = calendarDay(event.startsAt)
  if (event.allDay) {
    const lastDay = event.endsAt
      ? shiftDay(event.endsAt.slice(0, 10), -1)
      : event.startsAt.slice(0, 10)
    return lastDay === event.startsAt.slice(0, 10)
      ? `${start} · All day`
      : `${start} – ${calendarDay(lastDay)} · All day`
  }
  const end = event.endsAt
    ? ` – ${event.endsAt.slice(0, 10) === event.startsAt.slice(0, 10) ? '' : calendarDay(event.endsAt) + ', '}${event.endsAt.slice(11, 16)}`
    : ''
  return `${start}, ${event.startsAt.slice(11, 16)}${end}`
}
export const eventTypeLabels = {
  EXAM: 'Exam / test',
  EVENT: 'Event',
  DEADLINE: 'Homework / deadline',
}
