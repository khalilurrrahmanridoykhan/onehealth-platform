import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { DataTrustPanel } from './DataTrustPanel'
import type { DataTrustReport } from '../dataTrust'

const report: DataTrustReport = {
  disease_code: 'DENGUE',
  disease_name: 'Dengue',
  metric: { label: 'Reported cases', unit: 'people' },
  evidence_type: 'OBSERVED_SURVEILLANCE',
  coverage: {
    start_date: '2026-01-05', end_date: '2026-05-31', record_count: 189,
    location_count: 9, location_levels: ['national', 'division'], period_types: ['weekly'],
    complete_periods: 21, partial_periods: 0,
  },
  freshness: {
    status: 'STALE', latest_period_end: '2026-05-31', age_days: 67,
    expected_update_days: 7, as_of: '2026-08-06',
  },
  provenance: {
    sources: [{ name: 'DGHS dengue reports', url: 'https://example.test/dengue' }],
    license: 'Source terms apply', repository_url: 'https://github.com/example/data', doi: null,
  },
  quality: {
    status: 'WARNING', issue_count: 1,
    checks: [{ code: 'freshness', status: 'WARNING', message: 'The latest period is older than the expected update cycle.' }],
  },
  capabilities: { alerts: true, forecast: true, automated_refresh: false, district_data: false },
  limitations: ['Public data is available at division level only.'],
}

beforeEach(() => vi.restoreAllMocks())

test('presents coverage, provenance, capabilities and limitations accessibly', () => {
  render(<DataTrustPanel diseaseCode="DENGUE" report={report} />)

  expect(screen.getByRole('heading', { name: 'Evidence, freshness and provenance' })).toBeInTheDocument()
  expect(screen.getByText('Observed surveillance')).toBeInTheDocument()
  expect(screen.getByText('21 complete')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /DGHS dengue reports/ })).toHaveAttribute('href', 'https://example.test/dengue')
  expect(screen.getByText('Automated alerts').nextElementSibling).toHaveTextContent('Available')
  expect(screen.getByText('District-level data').nextElementSibling).toHaveTextContent('Not available')
  expect(screen.getByText('Public data is available at division level only.')).toBeInTheDocument()
})

test('loads trust metadata from the disease-specific endpoint', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(report), { status: 200 }))))

  render(<DataTrustPanel diseaseCode="DENGUE" />)
  expect(screen.getByText('Loading data-trust evidence…')).toBeInTheDocument()

  await waitFor(() => expect(screen.getByText('DGHS dengue reports')).toBeInTheDocument())
  expect(fetch).toHaveBeenCalledWith('/api/v1/data-trust/DENGUE', expect.objectContaining({ signal: expect.any(AbortSignal) }))
})
