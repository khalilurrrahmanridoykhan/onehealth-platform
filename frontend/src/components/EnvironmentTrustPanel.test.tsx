import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { EnvironmentTrustPanel } from './EnvironmentTrustPanel'
import type { EnvironmentTrustReport } from '../environmentTrust'

const report: EnvironmentTrustReport = {
  metric: { label: 'District climate observations', unit: 'district-months' },
  evidence_type: 'modelled_reanalysis_observation',
  coverage: {
    start_date: '2017-01-01', end_date: '2025-12-31', record_count: 6912,
    location_count: 64, period_types: ['monthly'], complete_periods: 6912, partial_periods: 0,
  },
  freshness: {
    status: 'HISTORICAL', latest_period_end: '2025-12-31', age_days: 218,
    expected_update_days: null, as_of: '2026-08-06',
  },
  provenance: {
    sources: [{ name: 'NASA POWER', url: 'https://power.larc.nasa.gov/' }],
    license: 'NASA POWER data-use policy', repository_url: 'https://github.com/example/onehealth', doi: null,
  },
  quality: {
    status: 'WARNING', issue_count: 1,
    checks: [{ code: 'unverified_crosswalk_entries', status: 'WARNING', message: 'One district relies on an unverified name resolution.' }],
  },
  capabilities: { alerts: false, forecast: false, automated_refresh: false, district_data: true, disease_correlation: false },
  limitations: ['NASA POWER values are a single unweighted centroid per district.'],
}

beforeEach(() => vi.restoreAllMocks())

test('presents coverage, provenance, capabilities and limitations accessibly', () => {
  render(<EnvironmentTrustPanel report={report} />)

  expect(screen.getByRole('heading', { name: 'Environment evidence, freshness and provenance' })).toBeInTheDocument()
  expect(screen.getByText('Modelled reanalysis observation')).toBeInTheDocument()
  expect(screen.getByText('64')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /NASA POWER/ })).toHaveAttribute('href', 'https://power.larc.nasa.gov/')
  expect(screen.getByText('District-level data').nextElementSibling).toHaveTextContent('Available')
  expect(screen.getByText('Disease correlation analysis').nextElementSibling).toHaveTextContent('Not available')
  expect(screen.getByText('NASA POWER values are a single unweighted centroid per district.')).toBeInTheDocument()
})

test('loads trust metadata from the environment data-trust endpoint', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(report), { status: 200 }))))

  render(<EnvironmentTrustPanel />)
  expect(screen.getByText('Loading environment data-trust evidence…')).toBeInTheDocument()

  await waitFor(() => expect(screen.getByText('NASA POWER')).toBeInTheDocument())
  expect(fetch).toHaveBeenCalledWith('/api/v1/environment/data-trust', expect.objectContaining({ signal: expect.any(AbortSignal) }))
})
