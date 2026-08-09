import { newAuditDefaults, type AuditConfig } from '../types/audit'
import {
  buildDataTrustReport,
  computeOutlierFallback,
  computeRatioCheck,
  computeTrendCheck,
  type DataPoint,
} from './qualityChecks'

function makeAudit(overrides: Partial<AuditConfig> = {}): AuditConfig {
  return {
    id: 'audit-1',
    name: 'Test audit',
    description: null,
    dataSetId: 'ds1',
    dataSetName: 'Test dataset',
    periodType: 'Monthly',
    dataElementId: 'de1',
    dataElementName: 'Test indicator',
    orgUnits: [
      { id: 'ou1', name: 'District A' },
      { id: 'ou2', name: 'District B' },
    ],
    expectedOrgUnitIds: ['ou1', 'ou2'],
    freshnessMode: 'operational',
    expectedUpdateDays: 45,
    sourceName: null,
    sourceUrl: null,
    license: null,
    doi: null,
    ...newAuditDefaults(),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin',
    ...overrides,
  }
}

function point(period: string, locationCode: string, value: number): DataPoint {
  return { period, locationCode, locationName: locationCode, value }
}

describe('buildDataTrustReport: v1 core checks', () => {
  test('all-clean data passes every check', () => {
    const audit = makeAudit()
    const points = [point('202401', 'ou1', 10), point('202401', 'ou2', 5)]
    const report = buildDataTrustReport(points, audit, new Date('2024-02-10'))
    expect(report.quality.status).toBe('PASS')
    expect(report.quality.checks.map((c) => c.code)).toEqual([
      'records_present',
      'nonnegative_values',
      'duplicate_records',
      'declared_location_coverage',
      'future_periods',
    ])
  })

  test('no records fails records_present', () => {
    const report = buildDataTrustReport([], makeAudit(), new Date('2024-02-10'))
    expect(report.quality.status).toBe('FAIL')
    expect(report.quality.checks[0]).toMatchObject({ code: 'records_present', status: 'FAIL' })
  })

  test('negative value fails nonnegative_values', () => {
    const report = buildDataTrustReport([point('202401', 'ou1', -3)], makeAudit(), new Date('2024-02-10'))
    const c = report.quality.checks.find((c) => c.code === 'nonnegative_values')!
    expect(c.status).toBe('FAIL')
  })

  test('duplicate period+location fails duplicate_records', () => {
    const points = [point('202401', 'ou1', 10), point('202401', 'ou1', 12)]
    const report = buildDataTrustReport(points, makeAudit(), new Date('2024-02-10'))
    const c = report.quality.checks.find((c) => c.code === 'duplicate_records')!
    expect(c.status).toBe('FAIL')
  })

  test('missing an expected org unit warns declared_location_coverage', () => {
    const report = buildDataTrustReport([point('202401', 'ou1', 10)], makeAudit(), new Date('2024-02-10'))
    const c = report.quality.checks.find((c) => c.code === 'declared_location_coverage')!
    expect(c.status).toBe('WARNING')
    expect(c.message).toContain('District B')
  })

  test('a period ending after the assessment date warns future_periods', () => {
    const report = buildDataTrustReport([point('202412', 'ou1', 10)], makeAudit(), new Date('2024-02-10'))
    const c = report.quality.checks.find((c) => c.code === 'future_periods')!
    expect(c.status).toBe('WARNING')
  })

  test('every check reports an RDQA dimension', () => {
    const report = buildDataTrustReport([point('202401', 'ou1', 10)], makeAudit(), new Date('2024-02-10'))
    for (const c of report.quality.checks) {
      expect(c.dimension).toBeTruthy()
    }
  })
})

describe('v1.1: outlier detection fallback', () => {
  test('passes when fewer than 4 points exist', () => {
    const result = computeOutlierFallback([point('202401', 'ou1', 5), point('202402', 'ou1', 6)])
    expect(result.status).toBe('PASS')
  })

  test('flags a value far outside the interquartile range', () => {
    const points = [
      point('202401', 'ou1', 10),
      point('202402', 'ou1', 11),
      point('202403', 'ou1', 9),
      point('202404', 'ou1', 10),
      point('202405', 'ou1', 500), // deliberate extreme outlier
    ]
    const result = computeOutlierFallback(points)
    expect(result.status).toBe('WARNING')
    expect(result.message).toContain('500')
  })

  test('is wired into buildDataTrustReport when outlierDetectionEnabled is set', () => {
    const audit = makeAudit({ outlierDetectionEnabled: true })
    const points = [
      point('202401', 'ou1', 10),
      point('202402', 'ou1', 11),
      point('202403', 'ou1', 9),
      point('202404', 'ou1', 10),
      point('202405', 'ou1', 500),
    ]
    const report = buildDataTrustReport(points, audit, new Date('2024-06-01'))
    const c = report.quality.checks.find((c) => c.code === 'outlier_detection')
    expect(c?.status).toBe('WARNING')
  })

  test('an audit with outlierDetectionEnabled left off does not run the check', () => {
    const audit = makeAudit()
    const points = [point('202401', 'ou1', 10)]
    const report = buildDataTrustReport(points, audit, new Date('2024-06-01'))
    expect(report.quality.checks.find((c) => c.code === 'outlier_detection')).toBeUndefined()
  })
})

describe('v1.1: trend / spike-drop detection', () => {
  test('flags a period-over-period jump beyond the threshold', () => {
    const points = [point('202401', 'ou1', 10), point('202402', 'ou1', 100)]
    const result = computeTrendCheck(points, 50)
    expect(result.status).toBe('WARNING')
  })

  test('passes a gradual, in-range change', () => {
    const points = [point('202401', 'ou1', 10), point('202402', 'ou1', 12)]
    const result = computeTrendCheck(points, 50)
    expect(result.status).toBe('PASS')
  })

  test('an audit with trendChangeThresholdPercent left null does not run the check', () => {
    const report = buildDataTrustReport([point('202401', 'ou1', 10)], makeAudit(), new Date('2024-06-01'))
    expect(report.quality.checks.find((c) => c.code === 'trend_spike_drop')).toBeUndefined()
  })
})

describe('v1.1: paired-indicator ratio check', () => {
  test('flags a period where the ratio falls outside the expected range', () => {
    const audit = makeAudit({
      comparisonDataElementId: 'de2',
      comparisonLabel: 'positivity rate',
      expectedRatioMin: 0,
      expectedRatioMax: 1,
    })
    const points = [point('202401', 'ou1', 120)] // positives
    const comparisonPoints = [point('202401', 'ou1', 100)] // tests -- positives > tests, impossible
    const result = computeRatioCheck(points, comparisonPoints, audit)
    expect(result.status).toBe('WARNING')
    expect(result.message).toContain('positivity rate')
  })

  test('passes when every comparable period is within range', () => {
    const audit = makeAudit({
      comparisonDataElementId: 'de2',
      expectedRatioMin: 0,
      expectedRatioMax: 1,
    })
    const points = [point('202401', 'ou1', 20)]
    const comparisonPoints = [point('202401', 'ou1', 100)]
    const result = computeRatioCheck(points, comparisonPoints, audit)
    expect(result.status).toBe('PASS')
  })

  test('an audit with comparisonDataElementId left null does not run the check', () => {
    const report = buildDataTrustReport([point('202401', 'ou1', 10)], makeAudit(), new Date('2024-06-01'))
    expect(report.quality.checks.find((c) => c.code === 'paired_indicator_ratio')).toBeUndefined()
  })
})

describe('additive-not-breaking: a plain v1 audit is unaffected by v1.1 fields', () => {
  test('an audit with no v1.1 fields set renders exactly the original 5 checks', () => {
    const audit = makeAudit() // newAuditDefaults() leaves every v1.1 field null/false
    const report = buildDataTrustReport([point('202401', 'ou1', 10)], audit, new Date('2024-02-10'))
    expect(report.quality.checks).toHaveLength(5)
  })
})
