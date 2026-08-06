export type FreshnessStatus = 'CURRENT' | 'STALE' | 'HISTORICAL' | 'UNKNOWN'
export type QualityStatus = 'PASS' | 'WARNING' | 'FAIL'

export interface DataTrustSource {
  name: string
  url: string | null
}

export interface DataTrustCoverage {
  start_date: string | null
  end_date: string | null
  record_count: number
  location_count: number
  location_levels: string[]
  period_types: string[]
  complete_periods: number
  partial_periods: number
}

export interface DataTrustFreshness {
  status: FreshnessStatus
  latest_period_end: string | null
  age_days: number | null
  expected_update_days: number | null
  as_of: string | null
}

export interface DataTrustProvenance {
  sources: DataTrustSource[]
  license: string | null
  repository_url: string | null
  doi: string | null
}

export interface DataTrustQualityCheck {
  code: string
  status: QualityStatus
  message: string
}

export interface DataTrustQuality {
  status: QualityStatus
  checks: DataTrustQualityCheck[]
  issue_count: number
}

export interface DataTrustCapabilities {
  alerts: boolean
  forecast: boolean
  automated_refresh: boolean
  district_data: boolean
}

export interface DataTrustReport {
  disease_code: string
  disease_name: string
  metric: {
    label: string
    unit: string
  }
  evidence_type: string
  coverage: DataTrustCoverage
  freshness: DataTrustFreshness
  provenance: DataTrustProvenance
  quality: DataTrustQuality
  capabilities: DataTrustCapabilities
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

function qualityStatus(value: unknown): QualityStatus {
  return value === 'PASS' || value === 'FAIL' || value === 'WARNING' ? value : 'WARNING'
}

function freshnessStatus(value: unknown): FreshnessStatus {
  return value === 'CURRENT' || value === 'STALE' || value === 'HISTORICAL' || value === 'UNKNOWN'
    ? value
    : 'UNKNOWN'
}

/**
 * Keeps the UI stable if an older API omits optional trust metadata. Required
 * identity fields still fail loudly so one disease cannot be labelled as another.
 */
export function normalizeDataTrustReport(payload: unknown): DataTrustReport {
  const root = object(payload)
  const diseaseCode = text(root.disease_code).trim()
  const diseaseName = text(root.disease_name).trim()
  if (!diseaseCode || !diseaseName) throw new Error('The data-trust response is missing its disease identity.')

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
    disease_code: diseaseCode,
    disease_name: diseaseName,
    metric: {
      label: text(metric.label, text(root.metric, 'Reported observations')),
      unit: text(metric.unit, text(root.unit, 'records')),
    },
    evidence_type: text(root.evidence_type, 'UNKNOWN'),
    coverage: {
      start_date: nullableText(coverage.start_date),
      end_date: nullableText(coverage.end_date),
      record_count: number(coverage.record_count),
      location_count: number(coverage.location_count),
      location_levels: strings(coverage.location_levels),
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
    },
    limitations: strings(root.limitations),
  }
}

export async function fetchDataTrustReport(diseaseCode: string, signal?: AbortSignal): Promise<DataTrustReport> {
  const token = localStorage.getItem('onehealth_session')
  const response = await fetch(`/api/v1/data-trust/${encodeURIComponent(diseaseCode)}`, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(body?.detail ?? `Data-trust request failed with HTTP ${response.status}`)
  }
  return normalizeDataTrustReport(await response.json())
}
