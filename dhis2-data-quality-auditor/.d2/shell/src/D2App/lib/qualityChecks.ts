// TypeScript port of OneHealth Data Trust's src/lib/qualityChecks.ts, adapted
// from a config compiled against one instance's 8 hardcoded programmes to a
// config an admin defines and edits at runtime (see types/audit.ts). The
// original 5 checks port over unmodified -- they already only read generic
// AuditConfig fields, no disease-specific logic. 4 new checks are added
// alongside them, aligned to RDQA (Routine Data Quality Assessment)
// dimensions -- see README.md for the full dimension mapping.
//
// Deliberate difference kept from the original: raw DHIS2 data values carry
// no per-value "disease identity" or "data status" field, so there is no
// DHIS2-native equivalent of the Python data_trust.py service's
// "disease_identity"/"evidence_semantics" checks. Provenance comes from the
// audit's own admin-entered fields, not from live records, for the same
// reason.
//
// This file stays pure and synchronous on purpose -- no network calls. The
// native-DHIS2-API outlier detection and instance validation-rule checks
// (see hooks/useOutlierDetection.ts and hooks/useInstanceValidation.ts) are
// computed elsewhere and passed in via BuildReportOptions.externalChecks, so
// this file remains trivially unit-testable in isolation.

import type { AuditConfig } from '../types/audit'
import { parsePeriod } from './period'

export type QualityStatus = 'PASS' | 'WARNING' | 'FAIL'
export type FreshnessStatus = 'CURRENT' | 'STALE' | 'HISTORICAL' | 'UNKNOWN'

export interface DataPoint {
  period: string
  locationCode: string
  locationName: string
  value: number
}

export interface QualityCheck {
  code: string
  status: QualityStatus
  message: string
  // RDQA dimension this check maps to -- see README.md's dimension table.
  dimension: 'Completeness' | 'Timeliness' | 'Validity' | 'Reliability' | 'Integrity' | 'Consistency'
}

export interface Coverage {
  startDate: string | null
  endDate: string | null
  recordCount: number
  locationCount: number
  periodCount: number
}

export interface Freshness {
  status: FreshnessStatus
  latestPeriodEnd: string | null
  ageDays: number | null
  expectedUpdateDays: number | null
  asOf: string
}

export interface Provenance {
  sourceName: string | null
  sourceUrl: string | null
  license: string | null
  doi: string | null
}

export interface Quality {
  status: QualityStatus
  checks: QualityCheck[]
  issueCount: number
}

export interface DataTrustReport {
  audit: AuditConfig
  coverage: Coverage
  freshness: Freshness
  provenance: Provenance
  quality: Quality
}

export interface BuildReportOptions {
  // Second indicator's data points, only used when audit.comparisonDataElementId
  // is set -- see computeRatioCheck.
  comparisonPoints?: DataPoint[]
  // Checks computed outside this file (native DHIS2 outlier-detection API,
  // instance-configured validation rules) -- appended as-is into quality.checks.
  externalChecks?: QualityCheck[]
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function check(
  code: string,
  status: QualityStatus,
  message: string,
  dimension: QualityCheck['dimension'],
): QualityCheck {
  return { code, status, message, dimension }
}

function buildCoverage(points: DataPoint[], audit: AuditConfig): Coverage {
  if (points.length === 0) {
    return { startDate: null, endDate: null, recordCount: 0, locationCount: 0, periodCount: 0 }
  }
  const parsed = points.map((point) => parsePeriod(audit.periodType, point.period))
  const start = parsed.reduce((min, p) => (p.start < min ? p.start : min), parsed[0].start)
  const end = parsed.reduce((max, p) => (p.end > max ? p.end : max), parsed[0].end)
  return {
    startDate: isoDate(start),
    endDate: isoDate(end),
    recordCount: points.length,
    locationCount: new Set(points.map((point) => point.locationCode)).size,
    periodCount: new Set(points.map((point) => point.period)).size,
  }
}

function buildFreshness(points: DataPoint[], audit: AuditConfig, asOf: Date): Freshness {
  const expectedUpdateDays = audit.expectedUpdateDays
  if (points.length === 0) {
    return { status: 'UNKNOWN', latestPeriodEnd: null, ageDays: null, expectedUpdateDays, asOf: isoDate(asOf) }
  }
  const latestEnd = points
    .map((point) => parsePeriod(audit.periodType, point.period).end)
    .reduce((max, end) => (end > max ? end : max))
  const ageDays = Math.round((asOf.getTime() - latestEnd.getTime()) / 86_400_000)

  let status: FreshnessStatus
  if (audit.freshnessMode === 'historical') {
    status = 'HISTORICAL'
  } else if (expectedUpdateDays === null) {
    status = 'UNKNOWN'
  } else {
    status = ageDays <= expectedUpdateDays ? 'CURRENT' : 'STALE'
  }

  return { status, latestPeriodEnd: isoDate(latestEnd), ageDays, expectedUpdateDays, asOf: isoDate(asOf) }
}

function buildProvenance(audit: AuditConfig): Provenance {
  return {
    sourceName: audit.sourceName,
    sourceUrl: audit.sourceUrl,
    license: audit.license,
    doi: audit.doi,
  }
}

// --- v1 core checks (RDQA: Completeness, Reliability, Validity, Integrity) ---

function checkRecordsPresent(points: DataPoint[]): QualityCheck {
  return check(
    'records_present',
    points.length > 0 ? 'PASS' : 'FAIL',
    points.length > 0
      ? `${points.length} data values were returned by this DHIS2 instance.`
      : 'No data values were returned by this DHIS2 instance for this audit.',
    'Completeness',
  )
}

function checkNonnegativeValues(points: DataPoint[]): QualityCheck {
  const negativeCount = points.filter((point) => point.value < 0).length
  return check(
    'nonnegative_values',
    negativeCount === 0 ? 'PASS' : 'FAIL',
    negativeCount === 0 ? 'All values are within allowed ranges.' : `${negativeCount} values are negative.`,
    'Validity',
  )
}

function checkDuplicateRecords(points: DataPoint[]): QualityCheck {
  const seen = new Map<string, number>()
  for (const point of points) {
    const key = `${point.period}::${point.locationCode}`
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  const duplicateCount = [...seen.values()].reduce((sum, count) => sum + (count > 1 ? count - 1 : 0), 0)
  return check(
    'duplicate_records',
    duplicateCount === 0 ? 'PASS' : 'FAIL',
    duplicateCount === 0
      ? 'No duplicate period-location values were found.'
      : `${duplicateCount} duplicate period-location values were found.`,
    'Reliability',
  )
}

function checkDeclaredLocationCoverage(points: DataPoint[], audit: AuditConfig): QualityCheck {
  const observedLocations = new Set(points.map((point) => point.locationCode))
  const missingLocations = audit.expectedOrgUnitIds.filter((id) => !observedLocations.has(id))
  const missingNames = audit.orgUnits.filter((ou) => missingLocations.includes(ou.id)).map((ou) => ou.name)
  return check(
    'declared_location_coverage',
    missingLocations.length === 0 ? 'PASS' : 'WARNING',
    missingLocations.length === 0
      ? 'All org units declared for this audit have at least one value.'
      : `No values for declared org units: ${missingNames.join(', ')}.`,
    'Completeness',
  )
}

function checkFuturePeriods(points: DataPoint[], audit: AuditConfig, asOf: Date): QualityCheck {
  const futureCount = points.filter((point) => parsePeriod(audit.periodType, point.period).end > asOf).length
  return check(
    'future_periods',
    futureCount === 0 ? 'PASS' : 'WARNING',
    futureCount === 0
      ? 'No reporting period ends after the assessment date.'
      : `${futureCount} reporting periods end after the assessment date.`,
    'Integrity',
  )
}

// --- v1.1 public-health-grade checks ---

// Local, in-app statistical fallback for outlier detection, used when the
// target instance's DHIS2 core version doesn't expose the native
// /api/dataAnalysis/outlierDetection endpoint (see hooks/useOutlierDetection.ts,
// which prefers the native API and only falls back to this). Interquartile
// range (IQR) method: flags points more than 1.5x IQR beyond Q1/Q3, a
// well-established, distribution-free outlier rule (not dependent on assuming
// a normal distribution the way a raw z-score would be).
export function computeOutlierFallback(points: DataPoint[]): QualityCheck {
  if (points.length < 4) {
    return check('outlier_detection', 'PASS', 'Not enough data points to assess plausibility.', 'Validity')
  }
  const sorted = [...points.map((p) => p.value)].sort((a, b) => a - b)
  const q1 = sorted[Math.floor(sorted.length * 0.25)]
  const q3 = sorted[Math.floor(sorted.length * 0.75)]
  const iqr = q3 - q1
  const lowerBound = q1 - 1.5 * iqr
  const upperBound = q3 + 1.5 * iqr
  const outliers = points.filter((p) => p.value < lowerBound || p.value > upperBound)
  return check(
    'outlier_detection',
    outliers.length === 0 ? 'PASS' : 'WARNING',
    outliers.length === 0
      ? 'No values fall outside the expected range (IQR method).'
      : `${outliers.length} values are statistical outliers (outside 1.5x IQR): ${outliers
          .slice(0, 5)
          .map((p) => `${p.locationName} ${p.period}=${p.value}`)
          .join(', ')}${outliers.length > 5 ? ', ...' : ''}.`,
    'Validity',
  )
}

// Flags a period+location whose value jumps beyond `thresholdPercent` versus
// that same org unit's own immediately preceding period -- catches the single
// most common real-world DHIS2 data-entry error (an extra typed zero, a
// decimal-point slip) that none of the other checks can see.
export function computeTrendCheck(points: DataPoint[], thresholdPercent: number): QualityCheck {
  const byLocation = new Map<string, DataPoint[]>()
  for (const point of points) {
    const list = byLocation.get(point.locationCode) ?? []
    list.push(point)
    byLocation.set(point.locationCode, list)
  }

  const spikes: string[] = []
  for (const [, series] of byLocation) {
    const sorted = [...series].sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0))
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const curr = sorted[i]
      if (prev.value === 0) continue // undefined percent change from zero -- not a meaningful spike signal
      const changePercent = Math.abs((curr.value - prev.value) / prev.value) * 100
      if (changePercent > thresholdPercent) {
        spikes.push(`${curr.locationName} ${prev.period}→${curr.period}: ${prev.value}→${curr.value}`)
      }
    }
  }

  return check(
    'trend_spike_drop',
    spikes.length === 0 ? 'PASS' : 'WARNING',
    spikes.length === 0
      ? `No period-over-period change exceeds ${thresholdPercent}%.`
      : `${spikes.length} period-over-period changes exceed ${thresholdPercent}%: ${spikes.slice(0, 5).join('; ')}${
          spikes.length > 5 ? '; ...' : ''
        }.`,
    'Validity',
  )
}

// Paired-indicator plausibility -- the DHIS2-native equivalent of RDQA's
// cross-check step (e.g. positives should never exceed tests). Matches
// comparison points to primary points by period+locationCode.
export function computeRatioCheck(
  points: DataPoint[],
  comparisonPoints: DataPoint[],
  audit: AuditConfig,
): QualityCheck {
  const label = audit.comparisonLabel ?? 'ratio'
  const comparisonByKey = new Map(comparisonPoints.map((p) => [`${p.period}::${p.locationCode}`, p.value]))

  const breaches: string[] = []
  let comparableCount = 0
  for (const point of points) {
    const comparisonValue = comparisonByKey.get(`${point.period}::${point.locationCode}`)
    if (comparisonValue === undefined || comparisonValue === 0) continue
    comparableCount++
    const ratio = point.value / comparisonValue
    const belowMin = audit.expectedRatioMin !== null && ratio < audit.expectedRatioMin
    const aboveMax = audit.expectedRatioMax !== null && ratio > audit.expectedRatioMax
    if (belowMin || aboveMax) {
      breaches.push(`${point.locationName} ${point.period}: ${label}=${ratio.toFixed(2)}`)
    }
  }

  if (comparableCount === 0) {
    return check(
      'paired_indicator_ratio',
      'WARNING',
      'No periods have both the primary and comparison indicator, so the ratio could not be checked.',
      'Consistency',
    )
  }

  return check(
    'paired_indicator_ratio',
    breaches.length === 0 ? 'PASS' : 'WARNING',
    breaches.length === 0
      ? `All ${comparableCount} comparable periods have a ${label} within the expected range.`
      : `${breaches.length} of ${comparableCount} comparable periods have a ${label} outside the expected range: ${breaches
          .slice(0, 5)
          .join('; ')}${breaches.length > 5 ? '; ...' : ''}.`,
    'Consistency',
  )
}

function buildQuality(
  points: DataPoint[],
  audit: AuditConfig,
  asOf: Date,
  options: BuildReportOptions,
): Quality {
  const checks: QualityCheck[] = [
    checkRecordsPresent(points),
    checkNonnegativeValues(points),
    checkDuplicateRecords(points),
    checkDeclaredLocationCoverage(points, audit),
    checkFuturePeriods(points, audit, asOf),
  ]

  if (audit.trendChangeThresholdPercent !== null) {
    checks.push(computeTrendCheck(points, audit.trendChangeThresholdPercent))
  }

  if (audit.outlierDetectionEnabled && !options.externalChecks?.some((c) => c.code === 'outlier_detection')) {
    // Only add the local fallback if no native-API result was already supplied.
    checks.push(computeOutlierFallback(points))
  }

  if (audit.comparisonDataElementId !== null && options.comparisonPoints) {
    checks.push(computeRatioCheck(points, options.comparisonPoints, audit))
  }

  if (options.externalChecks) {
    checks.push(...options.externalChecks)
  }

  const statuses = new Set(checks.map((c) => c.status))
  const status: QualityStatus = statuses.has('FAIL') ? 'FAIL' : statuses.has('WARNING') ? 'WARNING' : 'PASS'
  return { status, checks, issueCount: checks.filter((c) => c.status !== 'PASS').length }
}

export function buildDataTrustReport(
  points: DataPoint[],
  audit: AuditConfig,
  asOf: Date = new Date(),
  options: BuildReportOptions = {},
): DataTrustReport {
  return {
    audit,
    coverage: buildCoverage(points, audit),
    freshness: buildFreshness(points, audit, asOf),
    provenance: buildProvenance(audit),
    quality: buildQuality(points, audit, asOf, options),
  }
}
