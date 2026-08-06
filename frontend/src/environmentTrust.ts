export type EnvironmentFreshnessStatus = 'CURRENT' | 'STALE' | 'HISTORICAL' | 'UNKNOWN'
export type EnvironmentQualityStatus = 'PASS' | 'WARNING' | 'FAIL'

export interface EnvironmentTrustSource {
  name: string
  url: string | null
}

export interface EnvironmentTrustCoverage {
  start_date: string | null
  end_date: string | null
  record_count: number
  location_count: number
  period_types: string[]
  complete_periods: number
  partial_periods: number
}

export interface EnvironmentTrustFreshness {
  status: EnvironmentFreshnessStatus
  latest_period_end: string | null
  age_days: number | null
  expected_update_days: number | null
  as_of: string | null
}

export interface EnvironmentTrustProvenance {
  sources: EnvironmentTrustSource[]
  license: string | null
  repository_url: string | null
  doi: string | null
}

export interface EnvironmentTrustQualityCheck {
  code: string
  status: EnvironmentQualityStatus
  message: string
}

export interface EnvironmentTrustQuality {
  status: EnvironmentQualityStatus
  checks: EnvironmentTrustQualityCheck[]
  issue_count: number
}

export interface EnvironmentTrustCapabilities {
  alerts: boolean
  forecast: boolean
  automated_refresh: boolean
  district_data: boolean
  disease_correlation: boolean
}

export interface EnvironmentTrustReport {
  metric: {
    label: string
    unit: string
  }
  evidence_type: string
  coverage: EnvironmentTrustCoverage
  freshness: EnvironmentTrustFreshness
  provenance: EnvironmentTrustProvenance
  quality: EnvironmentTrustQuality
  capabilities: EnvironmentTrustCapabilities
  limitations: string[]
}

type UnknownObject = Record<string, unknown>

function object(value: unknown): UnknownObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as UnknownObject : {}
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function nullableText(value: unknown): string | null {
  const result = text(value).trim()
  return result || null
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function boolean(value: unknown): boolean {
  return value === true
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function qualityStatus(value: unknown): EnvironmentQualityStatus {
  return value === 'PASS' || value === 'FAIL' || value === 'WARNING' ? value : 'WARNING'
}

function freshnessStatus(value: unknown): EnvironmentFreshnessStatus {
  return value === 'CURRENT' || value === 'STALE' || value === 'HISTORICAL' || value === 'UNKNOWN'
    ? value
    : 'UNKNOWN'
}

/**
 * Keeps the UI stable if an older API omits optional trust metadata.
 */
export function normalizeEnvironmentTrustReport(payload: unknown): EnvironmentTrustReport {
  const root = object(payload)
  const metric = object(root.metric)
  const coverage = object(root.coverage)
  const freshness = object(root.freshness)
  const provenance = object(root.provenance)
  const quality = object(root.quality)
  const capabilities = object(root.capabilities)

  const sources = Array.isArray(provenance.sources)
    ? provenance.sources.map(object).map((source) => ({
      name: text(source.name, 'Source'),
      url: nullableText(source.url),
    }))
    : []

  const checks = Array.isArray(quality.checks)
    ? quality.checks.map(object).map((check) => ({
      code: text(check.code, 'quality-check'),
      status: qualityStatus(check.status),
      message: text(check.message, 'No check details were supplied.'),
    }))
    : []

  return {
    metric: {
      label: text(metric.label, 'District climate observations'),
      unit: text(metric.unit, 'district-months'),
    },
    evidence_type: text(root.evidence_type, 'UNKNOWN'),
    coverage: {
      start_date: nullableText(coverage.start_date),
      end_date: nullableText(coverage.end_date),
      record_count: number(coverage.record_count),
      location_count: number(coverage.location_count),
      period_types: strings(coverage.period_types),
      complete_periods: number(coverage.complete_periods),
      partial_periods: number(coverage.partial_periods),
    },
    freshness: {
      status: freshnessStatus(freshness.status),
      latest_period_end: nullableText(freshness.latest_period_end),
      age_days: nullableNumber(freshness.age_days),
      expected_update_days: nullableNumber(freshness.expected_update_days),
      as_of: nullableText(freshness.as_of),
    },
    provenance: {
      sources,
      license: nullableText(provenance.license),
      repository_url: nullableText(provenance.repository_url),
      doi: nullableText(provenance.doi),
    },
    quality: {
      status: qualityStatus(quality.status),
      checks,
      issue_count: number(quality.issue_count, checks.filter((check) => check.status !== 'PASS').length),
    },
    capabilities: {
      alerts: boolean(capabilities.alerts),
      forecast: boolean(capabilities.forecast),
      automated_refresh: boolean(capabilities.automated_refresh),
      district_data: boolean(capabilities.district_data),
      disease_correlation: boolean(capabilities.disease_correlation),
    },
    limitations: strings(root.limitations),
  }
}

export async function fetchEnvironmentTrustReport(signal?: AbortSignal): Promise<EnvironmentTrustReport> {
  const token = localStorage.getItem('onehealth_session')
  const response = await fetch('/api/v1/environment/data-trust', {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(body?.detail ?? `Environment data-trust request failed with HTTP ${response.status}`)
  }
  return normalizeEnvironmentTrustReport(await response.json())
}
