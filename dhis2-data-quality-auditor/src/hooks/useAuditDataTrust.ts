import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useEffect, useState } from 'react'
import { buildDataTrustReport, type DataPoint, type DataTrustReport, type QualityCheck } from '../lib/qualityChecks'
import type { AuditConfig, AuditOrgUnit } from '../types/audit'

type Engine = ReturnType<typeof useDataEngine>

interface RawDataValue {
  dataElement: string
  period: string
  orgUnit: string
  categoryOptionCombo?: string
  value: string
}

interface DataValueSetsResponse {
  result: { dataValues?: RawDataValue[] }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// A real gap the original useProgrammeDataTrust.ts never had to handle:
// OneHealth's 8 bundled data elements were all undisaggregated, so it never
// requested or summed categoryOptionCombo. Any real-world disaggregated
// element (by sex, age group -- common in real DHIS2 instances) returns
// multiple dataValueSets rows per period+orgUnit, one per COC. Summing them
// into a single DataPoint here (rather than in qualityChecks.ts, which stays
// untouched) keeps duplicate_records from false-positiving on legitimate
// disaggregated audits. Reported values are the SUM across all category
// option combinations -- stated explicitly in AuditDetail/README, not hidden.
async function fetchAggregatedPoints(
  engine: Engine,
  dataElementId: string,
  orgUnits: AuditOrgUnit[],
): Promise<DataPoint[]> {
  if (orgUnits.length === 0) return []

  const query = {
    result: {
      resource: 'dataValueSets',
      params: {
        dataElement: dataElementId,
        orgUnit: orgUnits.map((ou) => ou.id),
        startDate: '2000-01-01',
        endDate: todayIso(),
      },
    },
  }

  const response = (await engine.query(query)) as unknown as DataValueSetsResponse
  const dataValues = response.result.dataValues ?? []
  const orgUnitById = new Map(orgUnits.map((ou) => [ou.id, ou]))

  const sums = new Map<string, DataPoint>()
  for (const raw of dataValues) {
    if (raw.dataElement !== dataElementId) continue
    const orgUnit = orgUnitById.get(raw.orgUnit)
    if (!orgUnit) continue
    const key = `${raw.period}::${raw.orgUnit}`
    const value = Number(raw.value)
    const existing = sums.get(key)
    if (existing) {
      existing.value += value
    } else {
      sums.set(key, { period: raw.period, locationCode: orgUnit.id, locationName: orgUnit.name, value })
    }
  }

  return [...sums.values()]
}

// The complete per-audit fetch: primary indicator (COC-aggregated), optional
// comparison indicator, combined with any externally-computed checks (native
// outlier detection, instance validation rules -- see
// hooks/useOutlierDetection.ts / hooks/useInstanceValidation.ts) into a full
// DataTrustReport. Exported as a plain async function (not just wrapped in
// the hook below) so context/AuditReportsContext.tsx can call it imperatively
// from its concurrency-limited queue -- React hooks cannot be invoked in a
// loop over a dynamic list, which is exactly the N+1-fetch trap the original
// app's ProgrammeList/DataTrustDetail fell into.
export async function fetchAuditReport(
  engine: Engine,
  audit: AuditConfig,
  externalChecks: QualityCheck[] = [],
): Promise<DataTrustReport> {
  const points = await fetchAggregatedPoints(engine, audit.dataElementId, audit.orgUnits)

  let comparisonPoints: DataPoint[] | undefined
  if (audit.comparisonDataElementId) {
    comparisonPoints = await fetchAggregatedPoints(engine, audit.comparisonDataElementId, audit.orgUnits)
  }

  return buildDataTrustReport(points, audit, new Date(), { comparisonPoints, externalChecks })
}

interface State {
  loading: boolean
  error: string | null
  report: DataTrustReport | null
}

// Standalone single-audit hook, kept for completeness and as the reference
// implementation the shared context wraps. AuditList/AuditDetail do NOT call
// this directly -- they read from AuditReportsContext instead, so N audits
// never trigger N independent fetches.
export function useAuditDataTrust(audit: AuditConfig): State {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: true, error: null, report: null })

  const load = useCallback(async () => {
    setState({ loading: true, error: null, report: null })
    try {
      const report = await fetchAuditReport(engine, audit)
      setState({ loading: false, error: null, report })
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : String(error), report: null })
    }
  }, [engine, audit])

  useEffect(() => {
    load()
  }, [load])

  return state
}
