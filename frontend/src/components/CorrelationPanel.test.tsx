import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { CorrelationPanel } from './CorrelationPanel'
import type { AwdCorrelationReport } from '../types'

const report: AwdCorrelationReport = {
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
      pooled: { pearson_r: 0.141, pearson_p: 0.265, spearman_rho: 0.143, spearman_p: 0.252 },
      within_division: { pearson_r: 0.337, pearson_p: 0.005 },
    },
    total_precip_mm: {
      label: 'Total precipitation', unit: 'mm/year',
      pooled: { pearson_r: 0.621, pearson_p: 0.0002, spearman_rho: 0.589, spearman_p: 0.0002 },
      within_division: { pearson_r: 0.131, pearson_p: 0.414 },
    },
  },
  interpretation_guidance: 'Rough convention only: |r| < 0.3 weak, 0.3-0.5 moderate, > 0.5 strong.',
  limitations: ['This is an ecological-level correlation, not an individual-level analysis.'],
  disclaimer: 'Exploratory ecological-level correlation analysis. Does not establish causation.',
}

beforeEach(() => vi.restoreAllMocks())

test('loads and renders the correlation report from the API, disclaimer first', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(report), { status: 200 }))))

  render(<CorrelationPanel />)
  expect(screen.getByText('Loading AWD-climate correlation analysis…')).toBeInTheDocument()

  await waitFor(() => expect(screen.getByRole('heading', { name: 'AWD & climate correlation' })).toBeInTheDocument())
  expect(screen.getByText(report.disclaimer)).toBeInTheDocument()
  expect(screen.getByText(/r = \+0\.34 \(moderate\)/)).toBeInTheDocument()
  expect(screen.getByText(/r = \+0\.62 \(strong\)/)).toBeInTheDocument()
  expect(screen.getAllByText('not significant').length).toBeGreaterThan(0)
  expect(screen.getAllByText('p<0.05').length).toBeGreaterThan(0)
  expect(screen.getByText('This is an ecological-level correlation, not an individual-level analysis.')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/api/v1/environment/awd-correlation', expect.any(Object))
})
