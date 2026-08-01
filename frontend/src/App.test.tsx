import { render, screen, waitFor } from '@testing-library/react'
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
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    let body: unknown
    if (url.includes('/locations')) body = locations
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
  expect(screen.getByRole('option', { name: 'Dhaka' })).toBeInTheDocument()
})
