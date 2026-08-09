import { programmeByCode } from '../config/programmes'
import { buildDataTrustReport, type DataPoint } from './qualityChecks'

const dengue = programmeByCode('DENGUE')!

function point(period: string, locationCode: string, value: number): DataPoint {
  const location = dengue.locations.find((l) => l.code === locationCode)!
  return { period, locationCode, locationName: location.name, value }
}

describe('coverage', () => {
  test('empty points produce an empty, non-throwing coverage summary', () => {
    const report = buildDataTrustReport([], dengue, new Date('2026-08-09'))
    expect(report.coverage).toEqual({ startDate: null, endDate: null, recordCount: 0, locationCount: 0, periodCount: 0 })
  })

  test('date range spans the earliest period start to the latest period end', () => {
    const points = [point('2026W01', 'BD', 100), point('2026W03', 'BD-DHA', 40)]
    const report = buildDataTrustReport(points, dengue, new Date('2026-08-09'))
    expect(report.coverage.startDate).toBe('2025-12-29') // Monday of 2026W01
    expect(report.coverage.endDate).toBe('2026-01-18') // Sunday of 2026W03
    expect(report.coverage.recordCount).toBe(2)
    expect(report.coverage.locationCount).toBe(2)
  })
})

describe('freshness', () => {
  test('operational programme within its update window is CURRENT', () => {
    const points = [point('2026W31', 'BD', 100)] // ends 2026-08-02 (verified against Python's isocalendar)
    const report = buildDataTrustReport(points, dengue, new Date('2026-08-05')) // 3 days later, window is 7
    expect(report.freshness.status).toBe('CURRENT')
  })

  test('operational programme past its update window is STALE', () => {
    const points = [point('2026W10', 'BD', 100)]
    const report = buildDataTrustReport(points, dengue, new Date('2026-08-05'))
    expect(report.freshness.status).toBe('STALE')
  })

  test('historical programme is always HISTORICAL once any data exists', () => {
    const awd = programmeByCode('AWD')!
    const points = [{ period: '2024', locationCode: 'BD', locationName: 'Bangladesh', value: 100 }]
    const report = buildDataTrustReport(points, awd, new Date('2026-08-09'))
    expect(report.freshness.status).toBe('HISTORICAL')
  })

  test('no data at all is UNKNOWN', () => {
    const report = buildDataTrustReport([], dengue, new Date('2026-08-09'))
    expect(report.freshness.status).toBe('UNKNOWN')
  })
})

describe('provenance', () => {
  test('comes from the bundled programme config, not from records', () => {
    const report = buildDataTrustReport([], dengue, new Date('2026-08-09'))
    expect(report.provenance.sourceName).toBe('DGHS HEOC Dengue Dynamic Dashboard')
    expect(report.provenance.sourceUrl).toContain('dghs.gov.bd')
  })
})

describe('quality', () => {
  test('a clean dataset passes every check', () => {
    const points = dengue.locations.map((location) => point('2026W20', location.code, 10))
    const report = buildDataTrustReport(points, dengue, new Date('2026-08-09'))
    expect(report.quality.status).toBe('PASS')
    expect(report.quality.issueCount).toBe(0)
  })

  test('no data at all fails records_present', () => {
    const report = buildDataTrustReport([], dengue, new Date('2026-08-09'))
    expect(report.quality.status).toBe('FAIL')
    const check = report.quality.checks.find((c) => c.code === 'records_present')!
    expect(check.status).toBe('FAIL')
  })

  test('a negative value fails nonnegative_values', () => {
    const points = [point('2026W20', 'BD', -5)]
    const report = buildDataTrustReport(points, dengue, new Date('2026-08-09'))
    const check = report.quality.checks.find((c) => c.code === 'nonnegative_values')!
    expect(check.status).toBe('FAIL')
    expect(report.quality.status).toBe('FAIL')
  })

  test('a repeated period+location pair fails duplicate_records', () => {
    const points = [point('2026W20', 'BD', 10), point('2026W20', 'BD', 12)]
    const report = buildDataTrustReport(points, dengue, new Date('2026-08-09'))
    const check = report.quality.checks.find((c) => c.code === 'duplicate_records')!
    expect(check.status).toBe('FAIL')
  })

  test('a missing declared location warns but does not fail', () => {
    const points = [point('2026W20', 'BD', 10)] // only national, missing all 8 divisions
    const report = buildDataTrustReport(points, dengue, new Date('2026-08-09'))
    const check = report.quality.checks.find((c) => c.code === 'declared_location_coverage')!
    expect(check.status).toBe('WARNING')
    expect(report.quality.status).toBe('WARNING')
  })

  test('a period ending after the assessment date warns', () => {
    const points = [point('2026W40', 'BD', 10)] // far in the future relative to asOf below
    const report = buildDataTrustReport(points, dengue, new Date('2026-08-09'))
    const check = report.quality.checks.find((c) => c.code === 'future_periods')!
    expect(check.status).toBe('WARNING')
  })

  // Regression test: a queryable location (in `locations`, so it's included in
  // the DHIS2 API request) that is NOT in `expectedLocationCodes` (because the
  // programme is documented as never reporting there -- e.g. HPAI's source
  // never separately reports Mymensingh) must not be flagged as missing.
  test('a location that is queryable but not expected does not warn when absent', () => {
    const hpai = programmeByCode('HPAI')!
    expect(hpai.locations.some((location) => location.code === 'BD-MYM')).toBe(true)
    expect(hpai.expectedLocationCodes).not.toContain('BD-MYM')

    const points = hpai.expectedLocationCodes.map((code) => {
      const location = hpai.locations.find((l) => l.code === code)!
      return { period: '2025S1', locationCode: code, locationName: location.name, value: 1 }
    })
    const report = buildDataTrustReport(points, hpai, new Date('2026-08-09'))
    const check = report.quality.checks.find((c) => c.code === 'declared_location_coverage')!
    expect(check.status).toBe('PASS')
  })
})
