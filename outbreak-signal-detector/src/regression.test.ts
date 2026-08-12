import { fitWeightedLinearRegression } from './regression'

describe('fitWeightedLinearRegression', () => {
  test('recovers an exact line with unit weights', () => {
    // y = 1 + 2x exactly
    const fit = fitWeightedLinearRegression([0, 1, 2, 3, 4], [1, 3, 5, 7, 9], [1, 1, 1, 1, 1])
    expect(fit.intercept).toBeCloseTo(1, 6)
    expect(fit.slope).toBeCloseTo(2, 6)
    expect(fit.residuals.every((r) => Math.abs(r) < 1e-9)).toBe(true)
    expect(fit.weightedVariance).toBeCloseTo(0, 6)
  })

  test('predict() matches intercept + slope * x', () => {
    const fit = fitWeightedLinearRegression([0, 1, 2, 3, 4], [1, 3, 5, 7, 9], [1, 1, 1, 1, 1])
    expect(fit.predict(10)).toBeCloseTo(1 + 2 * 10, 6)
  })

  test('a zero-weighted outlier is excluded from the fit and from the variance entirely -- the mechanism the algorithm relies on to downweight past outbreak weeks', () => {
    // Points 0 and 1 define y = 2x exactly; point 2 is a wild outlier with zero weight.
    const fit = fitWeightedLinearRegression([0, 1, 2], [0, 2, 100], [1, 1, 0])
    expect(fit.intercept).toBeCloseTo(0, 6)
    expect(fit.slope).toBeCloseTo(2, 6)
    expect(fit.weightedVariance).toBeCloseTo(0, 6)
  })

  test('falls back to a flat fit through the weighted mean when x has no variation, rather than dividing by ~zero', () => {
    const fit = fitWeightedLinearRegression([5, 5, 5], [10, 20, 30], [1, 1, 1])
    expect(fit.slope).toBe(0)
    expect(fit.intercept).toBeCloseTo(20, 6)
  })

  test('throws on mismatched array lengths', () => {
    expect(() => fitWeightedLinearRegression([1, 2], [1], [1, 1])).toThrow()
  })

  test('throws with fewer than 2 points', () => {
    expect(() => fitWeightedLinearRegression([1], [1], [1])).toThrow()
  })
})
