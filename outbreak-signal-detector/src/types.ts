export interface WeeklyCount {
  weekStart: string // ISO date, the sampled day representing that week
  count: number
}

// Every field needed to explain an alert, not just a boolean -- the actual
// point of this project. See algorithm.ts.
export interface Alert {
  weekStart: string
  observed: number
  expected: number
  upperBound: number
  isAlarm: boolean
  ratio: number // observed / expected, NaN-safe (0 when expected is 0)
  excessAbsolute: number // observed - upperBound
  recentFourWeekTotal: number
  guardBlocked: boolean // true if the count exceeded the threshold but the low-count guard suppressed the alarm
}

export interface AlgorithmOptions {
  baselineWeeks: number // N most recent complete weeks used as baseline, default 52
  alpha: number // significance level for the prediction interval, default 0.05
  powerTransformExponent: number // default 2/3, matching the original
  minRecentFourWeekTotal: number // the "limit54"-style guard, default 5
}

export const DEFAULT_OPTIONS: AlgorithmOptions = {
  baselineWeeks: 52,
  alpha: 0.05,
  powerTransformExponent: 2 / 3,
  minRecentFourWeekTotal: 5,
}
