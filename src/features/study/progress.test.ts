import { expect, it } from 'vitest'
import { attemptDate } from './progress'

it('formats UTC, explicit offsets, legacy SQL times and epoch milliseconds consistently', () => {
  const expected = '27/10/2026, 11:30:00 (Budapest)'
  for (const value of [
    '2026-10-27T10:30:00Z',
    '2026-10-27T12:30:00+02:00',
    '2026-10-27 10:30:00',
    Date.parse('2026-10-27T10:30:00Z'),
  ]) {
    expect(attemptDate(value)).toBe(expected)
  }
  expect(attemptDate('2026-07-27T10:30:00Z')).toBe('27/07/2026, 12:30:00 (Budapest)')
})

it.each([undefined, null, '', 'invalid'])(
  'handles missing or invalid history timestamps: %s',
  (value) => {
    expect(attemptDate(value)).toBe('Date unavailable')
  },
)
