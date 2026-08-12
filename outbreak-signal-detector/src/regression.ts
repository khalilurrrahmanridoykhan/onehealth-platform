// Weighted ordinary least squares for a simple linear model y = a + b*x --
// closed-form (normal equations), no external stats library. This is the
// regression step of the algorithm, run on power-transformed counts against
// a week index, both in the initial fit and in the reweighted refit (see
// algorithm.ts). Documented simplification: the original Farrington method
// fits this via iteratively reweighted least squares on a quasi-Poisson GLM
// (log link); weighted OLS on the power-transformed response is a
// standard, much simpler approximation to the same variance-stabilizing
// goal -- see README for the full reasoning.

export interface RegressionFit {
  intercept: number
  slope: number
  predict: (x: number) => number
  residuals: number[]
  // Weighted residual variance, with a degrees-of-freedom correction (n-2)
  // -- feeds the overdispersion-scaled prediction interval in algorithm.ts.
  weightedVariance: number
}

export function fitWeightedLinearRegression(xs: number[], ys: number[], weights: number[]): RegressionFit {
  if (xs.length !== ys.length || xs.length !== weights.length) {
    throw new Error('xs, ys, and weights must all be the same length')
  }
  if (xs.length < 2) {
    throw new Error('fitWeightedLinearRegression needs at least 2 points')
  }

  let sumW = 0
  let sumWx = 0
  let sumWy = 0
  let sumWxx = 0
  let sumWxy = 0
  for (let i = 0; i < xs.length; i++) {
    const w = weights[i]
    sumW += w
    sumWx += w * xs[i]
    sumWy += w * ys[i]
    sumWxx += w * xs[i] * xs[i]
    sumWxy += w * xs[i] * ys[i]
  }

  const denominator = sumW * sumWxx - sumWx * sumWx
  // A near-zero denominator means every x is effectively identical (no
  // variation in the baseline's week index, e.g. a single-point baseline)
  // -- fall back to a flat (slope 0) fit through the weighted mean rather
  // than dividing by ~zero.
  const slope = Math.abs(denominator) < 1e-9 ? 0 : (sumW * sumWxy - sumWx * sumWy) / denominator
  const intercept = (sumWy - slope * sumWx) / sumW

  const predict = (x: number) => intercept + slope * x
  const residuals = xs.map((x, i) => ys[i] - predict(x))

  const weightedSumSquares = residuals.reduce((sum, e, i) => sum + weights[i] * e * e, 0)
  const degreesOfFreedom = Math.max(xs.length - 2, 1)
  const weightedVariance = weightedSumSquares / degreesOfFreedom

  return { intercept, slope, predict, residuals, weightedVariance }
}
