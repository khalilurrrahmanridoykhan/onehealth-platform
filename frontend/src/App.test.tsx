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

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    let body: unknown
    if (url.includes('.geojson')) body = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature', properties: { shapeISO: 'BD-C', shapeName: 'Dhaka' },
        geometry: { type: 'Polygon', coordinates: [[[90, 23], [91, 23], [91, 24], [90, 24], [90, 23]]] },
      }],
    }
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
    else if (url.includes('/locations')) body = locations
    else if (url.includes('/overview')) body = overview
    else if (url.includes('/trends')) body = trend
    else body = alert
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
  }))
})

test('renders surveillance metrics and alert guidance', async () => {
  render(<App />)

  expect(screen.getByRole('heading', { name: 'Dengue surveillance' })).toBeInTheDocument()
  await waitFor(() => expect(screen.getByText('Latest weekly cases')).toBeInTheDocument())
  expect(screen.getAllByText('3,000')).toHaveLength(2)
  expect(screen.getByText('Continue routine weekly surveillance.')).toBeInTheDocument()
  expect(screen.getAllByRole('option', { name: 'Dhaka' })).toHaveLength(2)
  await waitFor(() =>
    expect(screen.getByRole('img', { name: /Dengue risk by Bangladesh division/i })).toBeInTheDocument(),
  )
  expect(screen.getByRole('img', { name: 'Dengue risk by Bangladesh division' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Signal workflow' })).toBeInTheDocument()
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
