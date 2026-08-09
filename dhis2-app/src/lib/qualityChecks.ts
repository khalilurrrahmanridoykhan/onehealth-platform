// TypeScript port of the OneHealth Platform repo's
// src/onehealth/services/data_trust.py, adapted to run entirely client-side
// against this DHIS2 instance's own data values -- no separate backend.
//
// Deliberate difference from the Python version: raw DHIS2 data values carry
// no per-value "disease identity" or "data status" field (those are CSV-only
// concepts), so the "disease_identity" and "evidence_semantics" checks from
// the Python version have no DHIS2-native equivalent and are not ported.
// Provenance (source name/URL, license, DOI) comes from this app's bundled
// programme config, not from live records, for the same reason.

import type { ProgrammeConfig } from '../config/programmes'
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
  sourceName: string
  sourceUrl: string
  license: string | null
  doi: string | null
}

export interface Quality {
  status: QualityStatus
  checks: QualityCheck[]
  issueCount: number
}

export interface DataTrustReport {
  programme: ProgrammeConfig
  coverage: Coverage
  freshness: Freshness
  provenance: Provenance
  quality: Quality
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function check(code: string, status: QualityStatus, message: string): QualityCheck {
  return { code, status, message }
}

function buildCoverage(points: DataPoint[], programme: ProgrammeConfig): Coverage {
  if (points.length === 0) {
    return { startDate: null, endDate: null, recordCount: 0, locationCount: 0, periodCount: 0 }
  }
  const parsed = points.map((point) => parsePeriod(programme.periodType, point.period))
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

function buildFreshness(points: DataPoint[], programme: ProgrammeConfig, asOf: Date): Freshness {
  const expectedUpdateDays = programme.expectedUpdateDays
  if (points.length === 0) {
    return { status: 'UNKNOWN', latestPeriodEnd: null, ageDays: null, expectedUpdateDays, asOf: isoDate(asOf) }
  }
  const latestEnd = points
    .map((point) => parsePeriod(programme.periodType, point.period).end)
    .reduce((max, end) => (end > max ? end : max))
  const ageDays = Math.round((asOf.getTime() - latestEnd.getTime()) / 86_400_000)

  let status: FreshnessStatus
  if (programme.freshnessMode === 'historical') {
    status = 'HISTORICAL'
  } else if (expectedUpdateDays === null) {
    status = 'UNKNOWN'
  } else {
    status = ageDays <= expectedUpdateDays ? 'CURRENT' : 'STALE'
  }

  return { status, latestPeriodEnd: isoDate(latestEnd), ageDays, expectedUpdateDays, asOf: isoDate(asOf) }
}

function buildProvenance(programme: ProgrammeConfig): Provenance {
  return {
    sourceName: programme.sourceName,
    sourceUrl: programme.sourceUrl,
    license: programme.license,
    doi: programme.doi,
  }
}

function buildQuality(points: DataPoint[], programme: ProgrammeConfig, asOf: Date): Quality {
  const checks: QualityCheck[] = []

  checks.push(
    check(
      'records_present',
      points.length > 0 ? 'PASS' : 'FAIL',
      points.length > 0
        ? `${points.length} data values were returned by this DHIS2 instance.`
        : 'No data values were returned by this DHIS2 instance for this programme.',
    ),
  )

  const negativeCount = points.filter((point) => point.value < 0).length
  checks.push(
    check(
      'nonnegative_values',
      negativeCount === 0 ? 'PASS' : 'FAIL',
      negativeCount === 0
        ? 'All values are within allowed ranges.'
        : `${negativeCount} values are negative.`,
    ),
  )

  const seen = new Map<string, number>()
  for (const point of points) {
    const key = `${point.period}::${point.locationCode}`
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  const duplicateCount = [...seen.values()].reduce((sum, count) => sum + (count > 1 ? count - 1 : 0), 0)
  checks.push(
    check(
      'duplicate_records',
      duplicateCount === 0 ? 'PASS' : 'FAIL',
      duplicateCount === 0
        ? 'No duplicate period-location values were found.'
        : `${duplicateCount} duplicate period-location values were found.`,
    ),
  )

  const observedLocations = new Set(points.map((point) => point.locationCode))
  const missingLocations = programme.locations
    .map((location) => location.code)
    .filter((code) => !observedLocations.has(code))
  checks.push(
    check(
      'declared_location_coverage',
      missingLocations.length === 0 ? 'PASS' : 'WARNING',
      missingLocations.length === 0
        ? 'All locations declared for this programme have at least one value.'
        : `No values for declared locations: ${missingLocations.join(', ')}.`,
    ),
  )

  const futureCount = points.filter((point) => parsePeriod(programme.periodType, point.period).end > asOf).length
  checks.push(
    check(
      'future_periods',
      futureCount === 0 ? 'PASS' : 'WARNING',
      futureCount === 0
        ? 'No reporting period ends after the assessment date.'
        : `${futureCount} reporting periods end after the assessment date.`,
    ),
  )

  const statuses = new Set(checks.map((c) => c.status))
  const status: QualityStatus = statuses.has('FAIL') ? 'FAIL' : statuses.has('WARNING') ? 'WARNING' : 'PASS'
  return { status, checks, issueCount: checks.filter((c) => c.status !== 'PASS').length }
}

export function buildDataTrustReport(
  points: DataPoint[],
  programme: ProgrammeConfig,
  asOf: Date = new Date(),
): DataTrustReport {
  return {
    programme,
    coverage: buildCoverage(points, programme),
    freshness: buildFreshness(points, programme, asOf),
    provenance: buildProvenance(programme),
    quality: buildQuality(points, programme, asOf),
  }
}
