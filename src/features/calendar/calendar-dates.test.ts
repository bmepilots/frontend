import { describe, expect, it } from 'vitest'
import {
  calendarDay,
  eventWhen,
  monthGrid,
  occursOnDay,
  shiftDay,
  shiftMonth,
} from './calendar-dates'

describe('Budapest calendar date rules', () => {
  it('starts month grids on Monday and includes every date of the month', () => {
    const days = monthGrid('2026-11-01')
    expect(days).toHaveLength(42)
    expect(days[0]).toBe('2026-10-26')
    expect(days).toContain('2026-11-30')
    expect(days[41]).toBe('2026-12-06')
  })
  it('keeps date arithmetic stable across the Budapest daylight saving change', () => {
    expect(shiftDay('2026-10-25', 1)).toBe('2026-10-26')
    expect(shiftDay('2026-03-29', 1)).toBe('2026-03-30')
    expect(calendarDay('2026-10-25')).toBe('25 Oct 2026')
  })
  it('changes months without skipping February and handles leap days', () => {
    expect(shiftMonth('2026-01-31', 1)).toBe('2026-02-01')
    expect(shiftDay('2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftMonth('2026-12-01', 1)).toBe('2027-01-01')
  })
  it('shows no-end all-day entries only on their starting date', () => {
    const event = { startsAt: '2026-10-03T00:00:00', endsAt: null, allDay: true }
    expect(occursOnDay(event, '2026-10-03')).toBe(true)
    expect(occursOnDay(event, '2026-10-04')).toBe(false)
  })
  it('treats the end of multiday entries as exclusive', () => {
    const event = { startsAt: '2026-10-03T00:00:00', endsAt: '2026-10-05T00:00:00', allDay: true }
    expect(occursOnDay(event, '2026-10-03')).toBe(true)
    expect(occursOnDay(event, '2026-10-04')).toBe(true)
    expect(occursOnDay(event, '2026-10-05')).toBe(false)
    expect(eventWhen(event)).toBe('3 Oct 2026 – 4 Oct 2026 · All day')
  })
  it('places a midnight deadline on the correct day', () => {
    const event = { startsAt: '2026-10-04T00:00:00', endsAt: null, allDay: false }
    expect(occursOnDay(event, '2026-10-03')).toBe(false)
    expect(occursOnDay(event, '2026-10-04')).toBe(true)
  })
  it('shows overnight timed entries on all overlapping dates', () => {
    const event = { startsAt: '2026-10-03T23:00:00', endsAt: '2026-10-04T01:00:00', allDay: false }
    expect(occursOnDay(event, '2026-10-03')).toBe(true)
    expect(occursOnDay(event, '2026-10-04')).toBe(true)
    expect(eventWhen(event)).toBe('3 Oct 2026, 23:00 – 4 Oct 2026, 01:00')
  })
})
