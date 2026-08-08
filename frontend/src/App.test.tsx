import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import App from './App'

const locations = [
  { code: 'BD', name: 'Bangladesh', level: 'national' },
  { code: 'BD-DHA', name: 'Dhaka', level: 'division' },
]

const overview = [
  {
    location_code: 'BD', location_name: 'Bangladesh', location_level: 'national',
    periods: 21, total_cases: 3000, latest_period: '2026-W22', latest_cases: 127,
    risk_level: 'LOW', expected_cases: 166.75,
  },
]

const trend = [
  {
    disease_code: 'DENGUE', disease_name: 'Dengue', period_start: '2026-05-25',
    period_end: '2026-05-31', period_label: '2026-W22', location_code: 'BD',
    location_name: 'Bangladesh', location_level: 'national', cases: 127,
    complete_period: true,
  },
]

const alert = {
  disease_code: 'DENGUE', location_code: 'BD', period: '2026-W22', risk_level: 'LOW',
  observed_cases: 127, expected_cases: 166.75, predicted_cases: 142.9, confidence: 0.89,
  reasons: ['Observed cases are below baseline.'],
  recommended_actions: ['Continue routine weekly surveillance.'],
}

const dataTrust = {
  disease_code: 'DENGUE', disease_name: 'Dengue',
  metric: { label: 'Reported dengue cases', unit: 'cases' },
  evidence_type: 'observed_surveillance',
  coverage: {
    start_date: '2026-01-05', end_date: '2026-05-31', record_count: 199,
    location_count: 9, location_levels: ['national', 'division'], period_types: ['weekly'],
    complete_periods: 198, partial_periods: 1,
  },
  freshness: {
    status: 'STALE', latest_period_end: '2026-05-31', age_days: 67,
    expected_update_days: 7, as_of: '2026-08-06',
  },
  provenance: {
    sources: [{ name: 'DGHS dengue reports', url: 'https://example.test/dengue' }],
    license: null, repository_url: 'https://github.com/example/onehealth', doi: null,
  },
  quality: {
    status: 'WARNING', issue_count: 1,
    checks: [{ code: 'period_completeness', status: 'WARNING', message: 'One partial period is retained.' }],
  },
  capabilities: { alerts: true, forecast: true, automated_refresh: false, district_data: false },
  limitations: ['Division data are aggregates and do not identify patients.'],
}

const environmentTrust = {
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
  quality: { status: 'PASS', issue_count: 0, checks: [] },
  capabilities: { alerts: false, forecast: false, automated_refresh: false, district_data: true, disease_correlation: false },
  limitations: ['NASA POWER values are a single unweighted centroid per district.'],
}

const awdCorrelation = {
  method: {
    unit_of_analysis: 'division-year (n=64: 8 divisions x 8 overlapping years)',
    aggregation: 'District-month climate aggregated to district-year, then averaged across a division\'s districts.',
    significance_test: 'Two-sided permutation test, 5000 permutations, seed=20260807.',
    pooled_vs_within_division: 'Pooled correlates raw division-year values. Within-division controls for fixed cross-division differences.',
  },
  sample_size: 64,
  years: ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'],
  divisions: ['BD-BAR', 'BD-CTG', 'BD-DHA', 'BD-KHU', 'BD-MYM', 'BD-RAJ', 'BD-RAN', 'BD-SYL'],
  variables: {
    mean_temp_c: {
      label: 'Mean temperature', unit: '°C',
      pooled: { pearson_r: 0.14, pearson_p: 0.26, spearman_rho: 0.14, spearman_p: 0.25 },
      within_division: { pearson_r: 0.34, pearson_p: 0.005 },
    },
  },
  interpretation_guidance: 'Rough convention only: |r| < 0.3 weak, 0.3-0.5 moderate, > 0.5 strong.',
  limitations: ['This is an ecological-level correlation, not an individual-level analysis.'],
  disclaimer: 'Exploratory ecological-level correlation analysis. Does not establish causation.',
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    let body: unknown
    if (url.includes('bangladesh_districts.geojson')) body = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { shapeISO: '', shapeName: 'Dhaka', location_code: 'BD-D-DHAKA', district_name: 'Dhaka', division_code: 'BD-DHA', division_name: 'Dhaka' },
        geometry: { type: 'Polygon', coordinates: [[[90, 23], [91, 23], [91, 24], [90, 24], [90, 23]]] },
      }],
    }
    else if (url.includes('bangladesh_divisions.geojson')) body = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', properties: { shapeISO: 'BD-C', shapeName: 'Dhaka' },
        geometry: { type: 'Polygon', coordinates: [[[90, 23], [91, 23], [91, 24], [90, 24], [90, 23]]] },
      }],
    }
    else if (url.includes('/environment/awd-correlation')) body = awdCorrelation
    else if (url.includes('/environment/data-trust')) body = environmentTrust
    else if (url.includes('/environment/districts') && url.includes('/monthly')) body = [
      {
        location_code: 'BD-D-DHAKA', location_name: 'Dhaka', division_code: 'BD-DHA', division_name: 'Dhaka',
        period_start: '2020-06-01', period_end: '2020-06-30', period_label: '2020-06',
        mean_temp_c: 30, mean_max_temp_c: 35, total_precip_mm: 200, extreme_heat_days: 2,
        days_observed: 30, complete_period: true,
      },
    ]
    else if (url.includes('/environment/districts')) body = [
      {
        location_code: 'BD-D-DHAKA', location_name: 'Dhaka', division_code: 'BD-DHA', division_name: 'Dhaka',
        mean_temp_c: 27, mean_annual_precip_mm: 2000, mean_annual_extreme_heat_days: 20,
        extreme_heat_threshold_c: 35, period_start: '2017-01-01', period_end: '2025-12-31',
      },
    ]
    else if (url.includes('/ebs/schema')) body = { stages: [
      { code: 'detection', uid: 'OhEbsDet001', fields: ['description', 'signal_type'], required_fields: ['description', 'signal_type'], repeatable: false },
      { code: 'verification', uid: 'OhEbsVer001', fields: ['verification_status'], required_fields: ['verification_status'], repeatable: false },
    ] }
    else if (url.includes('/ebs/signals/preview') && init?.method === 'POST') body = {
      mode: 'PREVIEW',
      bundle: {
        trackedEntities: [{ trackedEntity: 'Abcdef12345', orgUnit: 'BdDivDha001' }],
        enrollments: [{ enrollment: 'Bcdefg12345', status: 'ACTIVE' }],
        events: [{ event: 'Cdefgh12345', status: 'COMPLETED', orgUnit: 'BdDivDha001' }],
      },
    }
    else if (url.includes('/ebs/stages/preview') && init?.method === 'POST') body = {
      mode: 'PREVIEW', stage: 'verification', bundle: { events: [{
        event: 'Defghi12345', programStage: 'OhEbsVer001', enrollment: 'Bcdefg12345',
        status: 'COMPLETED', orgUnit: 'BdDivDha001',
        dataValues: [{ dataElement: 'OhEbsVrf001', value: 'VERIFIED' }],
      }] },
    }
    else if (url.includes('/ebs/notifications')) body = {
      notifications: [{ id: 'unassigned:Abcdef12345', type: 'UNASSIGNED', severity: 'WARNING', title: 'EBS-2026-0001 needs an owner', message: 'Assign a responsible officer and response deadline.', signal_id: 'EBS-2026-0001', tracked_entity_uid: 'Abcdef12345', officer: null, due_date: null }], unread_count: 1, generated_at: '2026-08-02',
    }
    else if (url.includes('/ebs/operations')) body = {
      signals: [{ tracked_entity_uid: 'Abcdef12345', enrollment_uid: 'Bcdefg12345', signal_id: 'EBS-2026-0001', title: 'Unusual fever cluster', source: 'Community worker', org_unit_uid: 'BdDivDha001', latest_stage: 'verification', risk_level: 'HIGH', responsible_officer: null, recommended_actions: null, due_date: null, days_remaining: null, due_state: 'UNSCHEDULED', response_status: null, closed: false, overdue: false, event_count: 2, updated_at: '2026-08-02T10:00:00.000' }],
      summary: { total: 1, open: 1, closed: 0, overdue: 0, due_soon: 0, unassigned: 1, high_risk: 1 }, filtered_count: 1, generated_at: '2026-08-02',
    }
    else if (url.includes('/ebs/status')) body = { dhis2_configured: true, reads_enabled: true, writes_enabled: false, program_uid: 'OhEbsProg01' }
    else if (url.includes('/ebs/signals/Abcdef12345')) body = {
      tracked_entity_uid: 'Abcdef12345', org_unit_uid: 'BdDivDha001', enrollment_uid: 'Bcdefg12345',
      signal_id: 'EBS-2026-0001', title: 'Unusual fever cluster', source: 'Community worker',
      created_at: '2026-08-01T10:00:00.000', updated_at: '2026-08-02T10:00:00.000',
      events: [{ event_uid: 'Cdefgh12345', stage: 'verification', status: 'COMPLETED', occurred_at: '2026-08-02T00:00:00.000', updated_at: '2026-08-02T10:00:00.000', values: { verification_status: 'VERIFIED' } }],
    }
    else if (url.includes('/ebs/signals?')) body = { signals: [{
      tracked_entity_uid: 'Abcdef12345', org_unit_uid: 'BdDivDha001', signal_id: 'EBS-2026-0001',
      title: 'Unusual fever cluster', source: 'Community worker', created_at: '2026-08-01T10:00:00.000', updated_at: '2026-08-02T10:00:00.000',
    }] }
    else if (url.includes('/data-trust/')) body = dataTrust
    else if (url.includes('/diseases')) body = [{ code: 'DENGUE', name: 'Dengue' }, { code: 'MEASLES', name: 'Measles' }]
    else if (url.includes('/locations')) body = locations
    else if (url.includes('/overview')) body = overview
    else if (url.includes('/trends')) body = trend
    else body = alert
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
  }))
})

test('renders surveillance metrics and alert guidance', async () => {
  render(<App />)

  expect(screen.getByRole('heading', { name: 'Dengue intelligence' })).toBeInTheDocument()
  await waitFor(() => expect(screen.getByText('Latest weekly cases')).toBeInTheDocument())
  expect(screen.getAllByText('3,000')).toHaveLength(2)
  expect(screen.getByText('Continue routine weekly surveillance.')).toBeInTheDocument()
  expect(screen.getAllByRole('option', { name: 'Dhaka' })).toHaveLength(3)
  expect(screen.getByRole('heading', { name: 'Location and reporting-window analysis' })).toBeInTheDocument()
  expect(screen.getByText('Next-week outlook')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open response workflow →' })).toHaveAttribute('href', '#ebs')
  await waitFor(() =>
    expect(screen.getByRole('img', { name: /Dengue risk by Bangladesh division/i })).toBeInTheDocument(),
  )
  expect(screen.getByRole('img', { name: 'Dengue risk by Bangladesh division' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Toggle division labels' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Signal workflow' })).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Evidence, freshness and provenance' })).toBeInTheDocument())
})

test('builds an EBS Tracker signal preview without committing', async () => {
  render(<App />)
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Signal workflow' })).toBeInTheDocument())

  fireEvent.change(screen.getByLabelText('Signal ID'), { target: { value: 'EBS-2026-0001' } })
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Unusual fever cluster' } })
  fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'Community worker' } })
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Seven people with fever' } })
  fireEvent.click(screen.getByRole('button', { name: 'Preview Tracker signal' }))

  await waitFor(() => expect(screen.getByText('Tracker bundle ready')).toBeInTheDocument())
  expect(screen.getByText('No data is written to DHIS2 in preview mode.')).toBeInTheDocument()
})

test('previews a verification event for the detection enrollment', async () => {
  render(<App />)
  await waitFor(() => expect(screen.getByRole('button', { name: /Verification/i })).toBeDisabled())

  fireEvent.change(screen.getByLabelText('Signal ID'), { target: { value: 'EBS-2026-0002' } })
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Unusual fever cluster' } })
  fireEvent.change(screen.getByLabelText('Source'), { target: { value: 'Community worker' } })
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Seven people with fever' } })
  fireEvent.click(screen.getByRole('button', { name: 'Preview Tracker signal' }))
  await waitFor(() => expect(screen.getByText('Tracker bundle ready')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: /Verification/i }))
  fireEvent.change(screen.getByLabelText('Verification Status *'), { target: { value: 'VERIFIED' } })
  fireEvent.click(screen.getByRole('button', { name: 'Preview Verification' }))

  await waitFor(() => expect(screen.getByText('Verification event ready')).toBeInTheDocument())
  expect(screen.getByText('1 field values · completed event')).toBeInTheDocument()
})

test('loads a saved DHIS2 signal and displays its event history', async () => {
  render(<App />)
  await waitFor(() => expect(screen.getAllByRole('button', { name: /EBS-2026-0001/i })).toHaveLength(2))

  fireEvent.click(screen.getAllByRole('button', { name: /EBS-2026-0001/i }).find((button) => button.classList.contains('signal-row'))!)

  await waitFor(() => expect(screen.getByRole('heading', { name: 'Unusual fever cluster' })).toBeInTheDocument())
  expect(screen.getAllByText('Verification')).toHaveLength(2)
  expect(screen.getByRole('heading', { name: 'Operational alert queue' })).toBeInTheDocument()
  expect(screen.getByText(/Verification Status:/)).toBeInTheDocument()
  expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent?.includes('VERIFIED') === true)).toBeInTheDocument()
})
