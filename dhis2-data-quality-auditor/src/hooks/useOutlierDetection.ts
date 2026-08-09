import type { useDataEngine } from '@dhis2/app-runtime'
import type { QualityCheck } from '../lib/qualityChecks'
import type { AuditConfig } from '../types/audit'

// Typed from useDataEngine's own return type (type-only import, no React
// dependency at runtime) so the real engine instance passed in from
// context/AuditReportsContext.tsx's imperative fetch queue type-checks
// exactly, rather than against a hand-rolled, structurally looser interface.
type Engine = ReturnType<typeof useDataEngine>

interface OutlierValue {
  pe: string
  ou: string
  ouName?: string
  value: number
}

interface OutlierApiResponse {
  result: {
    outlierValues?: OutlierValue[]
  }
}

// Prefers DHIS2's own native Data Analysis outlier-detection endpoint
// (/api/dataAnalysis/outlierDetection, Z-Score / modified Z-Score / Min-Max
// algorithms) over reinventing statistics from scratch -- this is a real,
// existing core DHIS2 feature. Exact parameter names/availability vary by
// DHIS2 core version, so this is written defensively: on any failure
// (endpoint missing on this instance, unsupported version, bad params) it
// returns null rather than throwing, and buildDataTrustReport in
// qualityChecks.ts automatically falls back to the local IQR check
// (computeOutlierFallback) in that case -- the report never blocks on this.
//
// Exported as a plain async function rather than a React hook because the
// shared AuditReportsContext calls it imperatively, once per audit, from a
// concurrency-limited queue -- not from component render.
export async function fetchNativeOutlierCheck(engine: Engine, audit: AuditConfig): Promise<QualityCheck | null> {
  if (!audit.outlierDetectionEnabled) return null

  try {
    const query = {
      result: {
        resource: 'dataAnalysis/outlierDetection',
        params: {
          ds: audit.dataSetId,
          de: audit.dataElementId,
          ou: audit.orgUnits.map((ou) => ou.id),
          startDate: '2000-01-01',
          endDate: new Date().toISOString().slice(0, 10),
          algorithm: 'Z_SCORE',
          threshold: 3,
        },
      },
    }

    const response = (await engine.query(query)) as unknown as OutlierApiResponse
    const outliers = response.result?.outlierValues ?? []

    return {
      code: 'outlier_detection',
      status: outliers.length === 0 ? 'PASS' : 'WARNING',
      message:
        outliers.length === 0
          ? "No outliers were flagged by this instance's native outlier-detection analysis (Z-Score)."
          : `${outliers.length} values were flagged by this instance's native outlier-detection analysis (Z-Score): ${outliers
              .slice(0, 5)
              .map((o) => `${o.ouName ?? o.ou} ${o.pe}=${o.value}`)
              .join(', ')}${outliers.length > 5 ? ', ...' : ''}.`,
      dimension: 'Validity',
    }
  } catch {
    return null
  }
}
