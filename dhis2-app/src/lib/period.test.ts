import { isoDate, parsePeriod } from './period'

describe('parsePeriod: Weekly', () => {
  // Reference values independently computed with Python's
  // datetime.date.fromisocalendar (a well-established ISO 8601 implementation).
  test.each([
    ['2021W01', '2021-01-04'],
    ['2024W01', '2024-01-01'],
    ['2026W22', '2026-05-25'],
    ['2026W01', '2025-12-29'],
    ['2020W53', '2020-12-28'],
  ])('%s starts on %s', (id, expectedStart) => {
    const { start } = parsePeriod('Weekly', id)
    expect(isoDate(start)).toBe(expectedStart)
  })

  test('week spans exactly 7 days, Monday through Sunday', () => {
    const { start, end } = parsePeriod('Weekly', '2026W22')
    expect(isoDate(start)).toBe('2026-05-25')
    expect(isoDate(end)).toBe('2026-05-31')
    expect(start.getUTCDay()).toBe(1) // Monday
    expect(end.getUTCDay()).toBe(0) // Sunday
  })

  test('rejects a malformed weekly period', () => {
    expect(() => parsePeriod('Weekly', '2026-22')).toThrow()
  })
})

describe('parsePeriod: SixMonthly', () => {
  test('first half of the year', () => {
    const { start, end } = parsePeriod('SixMonthly', '2025S1')
    expect(isoDate(start)).toBe('2025-01-01')
    expect(isoDate(end)).toBe('2025-06-30')
  })

  test('second half of the year', () => {
    const { start, end } = parsePeriod('SixMonthly', '2025S2')
    expect(isoDate(start)).toBe('2025-07-01')
    expect(isoDate(end)).toBe('2025-12-31')
  })
})

describe('parsePeriod: Yearly', () => {
  test('a full calendar year', () => {
    const { start, end } = parsePeriod('Yearly', '2024')
    expect(isoDate(start)).toBe('2024-01-01')
    expect(isoDate(end)).toBe('2024-12-31')
  })

  test('rejects a malformed yearly period', () => {
    expect(() => parsePeriod('Yearly', '24')).toThrow()
  })
})
