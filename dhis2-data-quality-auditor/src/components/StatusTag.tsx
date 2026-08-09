import { Tag } from '@dhis2/ui'
import type { QualityStatus, FreshnessStatus } from '../lib/qualityChecks'

const QUALITY_PROPS: Record<QualityStatus, { positive?: boolean; negative?: boolean; neutral?: boolean }> = {
  PASS: { positive: true },
  WARNING: { neutral: true },
  FAIL: { negative: true },
}

const FRESHNESS_PROPS: Record<FreshnessStatus, { positive?: boolean; negative?: boolean; neutral?: boolean }> = {
  CURRENT: { positive: true },
  HISTORICAL: { neutral: true },
  STALE: { negative: true },
  UNKNOWN: { neutral: true },
}

export function QualityTag({ status }: { status: QualityStatus }) {
  return <Tag {...QUALITY_PROPS[status]}>{status}</Tag>
}

export function FreshnessTag({ status }: { status: FreshnessStatus }) {
  return <Tag {...FRESHNESS_PROPS[status]}>{status}</Tag>
}
