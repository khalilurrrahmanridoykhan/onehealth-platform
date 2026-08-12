import { inversePowerTransform, powerTransform } from './transform'

describe('powerTransform / inversePowerTransform', () => {
  test('2/3 power of 8 is 4 (8^(2/3) = (8^(1/3))^2 = 2^2 = 4)', () => {
    expect(powerTransform(8, 2 / 3)).toBeCloseTo(4, 6)
  })

  test('round-trips through the inverse transform', () => {
    for (const value of [0, 1, 5, 100, 12345]) {
      const transformed = powerTransform(value, 2 / 3)
      expect(inversePowerTransform(transformed, 2 / 3)).toBeCloseTo(value, 4)
    }
  })

  test('clamps negative input to zero rather than producing NaN', () => {
    expect(powerTransform(-5, 2 / 3)).toBe(0)
  })

  test('exponent of 1 is the identity transform', () => {
    expect(powerTransform(42, 1)).toBeCloseTo(42, 6)
  })
})
