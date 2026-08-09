// Runtime, admin-defined replacement for OneHealth Data Trust's static,
// hand-compiled config/programmes.ts. Every AuditConfig is created, edited,
// and persisted at runtime through this app's own UI -- nothing here is
// bundled or instance-specific. See lib/dataStore.ts for how the AuditConfig[]
// array is persisted.

export type FreshnessMode = 'operational' | 'historical'

// Deliberately a subset of DHIS2's full period-type list (excludes BiWeekly,
// WeeklyWednesday/Thursday/Saturday/Sunday, Financial* variants, and
// SixMonthlyApril -- see lib/period.ts). Datasets using an unsupported period
// type are blocked at picker time in AuditForm, not silently mis-parsed.
export type PeriodType = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'SixMonthly' | 'Yearly'

export interface AuditOrgUnit {
  id: string
  name: string
}

export interface AuditConfig {
  id: string
  name: string
  description: string | null

  dataSetId: string
  dataSetName: string
  periodType: PeriodType

  dataElementId: string
  dataElementName: string

  orgUnits: AuditOrgUnit[]
  // Subset of orgUnits.id expected to always have a value -- feeds the
  // declared_location_coverage check. Defaults to "all selected org units".
  expectedOrgUnitIds: string[]

  freshnessMode: FreshnessMode
  expectedUpdateDays: number | null

  sourceName: string | null
  sourceUrl: string | null
  license: string | null
  doi: string | null

  // v1.1 -- public-health-grade advanced checks. All optional/nullable: an
  // audit created before these existed, or one that never sets them, behaves
  // exactly like a plain v1 core audit (additive, not a breaking redesign).
  outlierDetectionEnabled: boolean
  trendChangeThresholdPercent: number | null

  comparisonDataElementId: string | null
  comparisonDataElementName: string | null
  comparisonLabel: string | null
  expectedRatioMin: number | null
  expectedRatioMax: number | null

  createdAt: string
  updatedAt: string
  createdBy: string
}

export const SUPPORTED_PERIOD_TYPES: PeriodType[] = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'SixMonthly', 'Yearly']

export const NUMERIC_VALUE_TYPES = ['INTEGER', 'INTEGER_POSITIVE', 'INTEGER_ZERO_OR_POSITIVE', 'NUMBER'] as const

export function newAuditDefaults(): Pick<
  AuditConfig,
  | 'outlierDetectionEnabled'
  | 'trendChangeThresholdPercent'
  | 'comparisonDataElementId'
  | 'comparisonDataElementName'
  | 'comparisonLabel'
  | 'expectedRatioMin'
  | 'expectedRatioMax'
> {
  return {
    outlierDetectionEnabled: false,
    trendChangeThresholdPercent: null,
    comparisonDataElementId: null,
    comparisonDataElementName: null,
    comparisonLabel: null,
    expectedRatioMin: null,
    expectedRatioMax: null,
  }
}
