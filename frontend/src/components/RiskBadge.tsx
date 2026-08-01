import type { RiskLevel } from '../types'

export function RiskBadge({ level }: { level: RiskLevel | null }) {
  const value = level ?? 'UNKNOWN'
  return <span className={`risk-badge risk-${value.toLowerCase()}`}>{value}</span>
}

