import { inverseNormalCdf, twoSidedCriticalZ } from './stats'

describe('inverseNormalCdf', () => {
  test('is 0 at p=0.5 (the median of a standard normal)', () => {
    expect(inverseNormalCdf(0.5)).toBeCloseTo(0, 6)
  })

  test('matches the well-known 1.959964 at p=0.975 (the standard two-sided 95% z-value)', () => {
    expect(inverseNormalCdf(0.975)).toBeCloseTo(1.959964, 5)
  })

  test('matches the well-known 2.575829 at p=0.995 (the standard two-sided 99% z-value)', () => {
    expect(inverseNormalCdf(0.995)).toBeCloseTo(2.575829, 5)
  })

  test('is antisymmetric around 0.5', () => {
    expect(inverseNormalCdf(0.1)).toBeCloseTo(-inverseNormalCdf(0.9), 5)
  })
})

describe('twoSidedCriticalZ', () => {
  test('alpha=0.05 gives the standard ~1.96', () => {
    expect(twoSidedCriticalZ(0.05)).toBeCloseTo(1.96, 2)
  })

  test('a smaller alpha (more conservative) gives a larger z', () => {
    expect(twoSidedCriticalZ(0.01)).toBeGreaterThan(twoSidedCriticalZ(0.05))
  })
})
