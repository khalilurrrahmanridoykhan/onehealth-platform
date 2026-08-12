// Peter Acklam's rational approximation to the inverse standard normal CDF
// (the probit function), accurate to about 1.15e-9 relative error -- a
// well-known, widely-used closed-form approximation, not a novel or
// unverified formula. Used to turn an alpha significance level into the
// z-value for a two-sided prediction interval, so `alpha` in
// AlgorithmOptions is genuinely configurable rather than a small hardcoded
// lookup table of common values.
export function inverseNormalCdf(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity

  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0]

  const pLow = 0.02425
  const pHigh = 1 - pLow

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p <= pHigh) {
    const q = p - 0.5
    const r = q * q
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  }
  const q = Math.sqrt(-2 * Math.log(1 - p))
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
}

// The two-sided critical z-value for a (1-alpha) prediction interval, e.g.
// alpha=0.05 -> ~1.96, matching the classic 95% interval.
export function twoSidedCriticalZ(alpha: number): number {
  return inverseNormalCdf(1 - alpha / 2)
}
