// The core detector -- a simplified reimplementation of the Farrington
// algorithm's mechanics (Farrington et al. 1996; mechanics confirmed live
// against the R `surveillance` package's own documentation for
// `algo.farrington`). See README for the full citation and the honest
// "recent rolling baseline instead of multi-year same-calendar-week
// baseline" adaptation this makes for a dataset (COVID-19) with no
// pre-pandemic history.

import { fitWeightedLinearRegression } from './regression'
import { twoSidedCriticalZ } from './stats'
import { inversePowerTransform, powerTransform } from './transform'
import { DEFAULT_OPTIONS, type Alert, type AlgorithmOptions, type WeeklyCount } from './types'

// Points whose residual (on the transformed scale) exceeds this many
// standard deviations above the initial fit are downweighted in the
// refit -- the "don't let a past outbreak inflate this year's threshold"
// mechanic, simplified from the original's Anscombe-residual-based
// procedure to one explicit, deterministic reweighting pass.
const REWEIGHT_THRESHOLD_SD = 2.58 // ~99th percentile of a normal distribution

export interface DetectOptions extends AlgorithmOptions {
  minBaselineWeeks: number // fewest baseline points needed to attempt a fit at all, default 8
}

export const DEFAULT_DETECT_OPTIONS: DetectOptions = { ...DEFAULT_OPTIONS, minBaselineWeeks: 8 }

// Evaluates a single week (series[targetIndex]) against the N most recent
// complete weeks before it. Returns null if there isn't enough baseline
// history yet to fit a meaningful regression -- explicit, not a silently
// wrong answer.
export function detectAlert(series: WeeklyCount[], targetIndex: number, options: DetectOptions = DEFAULT_DETECT_OPTIONS): Alert | null {
  const target = series[targetIndex]
  const baselineStart = Math.max(0, targetIndex - options.baselineWeeks)
  const baseline = series.slice(baselineStart, targetIndex)

  if (baseline.length < options.minBaselineWeeks) return null

  const xs = baseline.map((_, i) => i)
  const ysTransformed = baseline.map((w) => powerTransform(w.count, options.powerTransformExponent))

  const initialWeights = xs.map(() => 1)
  const initialFit = fitWeightedLinearRegression(xs, ysTransformed, initialWeights)

  const sd = Math.sqrt(initialFit.residuals.reduce((sum, r) => sum + r * r, 0) / initialFit.residuals.length)
  const reweightThreshold = REWEIGHT_THRESHOLD_SD * sd
  const weights = initialFit.residuals.map((r) => {
    if (sd === 0 || r <= reweightThreshold) return 1
    // Shrinks weight proportionally to how far the point sits beyond the
    // threshold -- a point twice as far beyond it gets a quarter the weight.
    return Math.pow(reweightThreshold / r, 2)
  })

  const refit = fitWeightedLinearRegression(xs, ysTransformed, weights)

  const targetX = baseline.length
  const predictedTransformed = refit.predict(targetX)
  const z = twoSidedCriticalZ(options.alpha)
  const residualSd = Math.sqrt(refit.weightedVariance)
  const upperTransformed = predictedTransformed + z * residualSd

  const expected = inversePowerTransform(predictedTransformed, options.powerTransformExponent)
  const upperBound = inversePowerTransform(upperTransformed, options.powerTransformExponent)
  const observed = target.count

  const recentWindowStart = Math.max(0, targetIndex - 4)
  const recentFourWeekTotal = series.slice(recentWindowStart, targetIndex).reduce((sum, w) => sum + w.count, 0)

  // A relative tolerance, not a bare `>`: the power-transform round trip
  // (x^(2/3) then ^(3/2)) doesn't always return bit-exact values even when
  // the math says observed and upperBound are mathematically equal --
  // confirmed live, this produced real false alarms (excess ~7e-15) on a
  // perfectly flat series before this tolerance was added.
  const EPSILON = 1e-9
  const exceedsThreshold = observed > upperBound + Math.max(Math.abs(upperBound) * EPSILON, EPSILON)
  const guardBlocked = exceedsThreshold && recentFourWeekTotal < options.minRecentFourWeekTotal
  const isAlarm = exceedsThreshold && !guardBlocked

  return {
    weekStart: target.weekStart,
    observed,
    expected,
    upperBound,
    isAlarm,
    ratio: expected > 0 ? observed / expected : observed > 0 ? Infinity : 1,
    excessAbsolute: observed - upperBound,
    recentFourWeekTotal,
    guardBlocked,
  }
}

// Runs detectAlert() across every week that has enough baseline history,
// returning only the weeks that were actually evaluated (skips the initial
// warm-up period where there isn't enough history yet).
export function detectAll(series: WeeklyCount[], options: DetectOptions = DEFAULT_DETECT_OPTIONS): Alert[] {
  const alerts: Alert[] = []
  for (let i = 0; i < series.length; i++) {
    const alert = detectAlert(series, i, options)
    if (alert) alerts.push(alert)
  }
  return alerts
}
