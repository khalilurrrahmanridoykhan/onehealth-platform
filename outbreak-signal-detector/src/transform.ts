// The variance-stabilizing power transform from the Farrington algorithm --
// default exponent 2/3, matching the original method's `powertrans="2/3"`.
// Count data (Poisson-like) has variance proportional to its mean; this
// transform makes the transformed variable's variance roughly constant, so
// ordinary least-squares regression on the transformed scale is a
// reasonable approximation to the quasi-Poisson fit the original performs
// via IRLS (documented simplification -- see README).

export function powerTransform(value: number, exponent: number): number {
  return Math.pow(Math.max(value, 0), exponent)
}

export function inversePowerTransform(transformed: number, exponent: number): number {
  return Math.pow(Math.max(transformed, 0), 1 / exponent)
}
