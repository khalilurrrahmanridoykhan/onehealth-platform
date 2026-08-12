import { DEFAULT_DETECT_OPTIONS, detectAlert, detectAll } from './algorithm'
import type { WeeklyCount } from './types'

function flatSeries(count: number, weeks: number): WeeklyCount[] {
  return Array.from({ length: weeks }, (_, i) => ({ weekStart: `week-${i}`, count }))
}

describe('detectAlert', () => {
  test('returns null when there is not enough baseline history yet', () => {
    const series = flatSeries(100, 5) // only 5 weeks, default minBaselineWeeks is 8
    expect(detectAlert(series, 4)).toBeNull()
  })

  test('a flat baseline with an obvious spike alarms, with exactly computable expected/upperBound (zero baseline variance)', () => {
    const series = [...flatSeries(100, 20), { weekStart: 'spike-week', count: 500 }]
    const alert = detectAlert(series, 20)
    expect(alert).not.toBeNull()
    // Baseline is perfectly flat, so the regression's weighted variance is
    // exactly 0 -- expected and upperBound both collapse to exactly 100.
    expect(alert!.expected).toBeCloseTo(100, 6)
    expect(alert!.upperBound).toBeCloseTo(100, 6)
    expect(alert!.observed).toBe(500)
    expect(alert!.isAlarm).toBe(true)
    expect(alert!.guardBlocked).toBe(false)
    expect(alert!.ratio).toBeCloseTo(5, 6)
    expect(alert!.excessAbsolute).toBeCloseTo(400, 6)
  })

  test('a value within the noisy baseline\'s own observed range does not alarm', () => {
    const noisyBaseline: WeeklyCount[] = [98, 102, 99, 101, 100, 97, 103, 100, 99, 101, 98, 102, 100, 99, 101, 100, 98, 102, 99, 101].map(
      (count, i) => ({ weekStart: `week-${i}`, count }),
    )
    // 100 sits squarely inside the baseline's own 97-103 range -- unlike
    // 104, which would be a new high given how tightly this baseline
    // fluctuates (confirmed live: a first version of this test used 104
    // and the algorithm correctly flagged it, since it really was outside
    // everything the baseline had ever shown).
    const series = [...noisyBaseline, { weekStart: 'target-week', count: 100 }]
    const alert = detectAlert(series, 20)
    expect(alert).not.toBeNull()
    expect(alert!.isAlarm).toBe(false)
    expect(alert!.expected).toBeCloseTo(100, 0)
  })

  test('the low-count guard blocks an alarm on a near-zero baseline even when the relative jump looks extreme -- the actual point of the limit54-style guard', () => {
    const series = [...flatSeries(0, 20), { weekStart: 'small-uptick', count: 3 }]
    const alert = detectAlert(series, 20)
    expect(alert).not.toBeNull()
    // Zero-variance zero baseline -> expected and upperBound both exactly 0,
    // so observed=3 statistically "exceeds" the interval...
    expect(alert!.expected).toBeCloseTo(0, 6)
    expect(alert!.upperBound).toBeCloseTo(0, 6)
    // ...but the guard blocks it because the past 4 weeks summed to 0 cases.
    expect(alert!.recentFourWeekTotal).toBe(0)
    expect(alert!.guardBlocked).toBe(true)
    expect(alert!.isAlarm).toBe(false)
  })

  test('a genuine spike with real recent volume is NOT guard-blocked', () => {
    const series = [...flatSeries(20, 20), { weekStart: 'spike-week', count: 200 }]
    const alert = detectAlert(series, 20)
    expect(alert!.recentFourWeekTotal).toBe(80) // 4 weeks of 20 each
    expect(alert!.guardBlocked).toBe(false)
    expect(alert!.isAlarm).toBe(true)
  })
})

describe('detectAll', () => {
  test('skips the warm-up period and only returns weeks with enough baseline history', () => {
    const series = flatSeries(100, 15)
    const alerts = detectAll(series, { ...DEFAULT_DETECT_OPTIONS, minBaselineWeeks: 8 })
    // Weeks 0-7 have fewer than 8 prior weeks of baseline; weeks 8-14 (7 weeks) qualify.
    expect(alerts).toHaveLength(7)
  })

  test('none of a perfectly flat series alarms', () => {
    const series = flatSeries(50, 30)
    const alerts = detectAll(series)
    expect(alerts.every((a) => !a.isAlarm)).toBe(true)
  })
})
