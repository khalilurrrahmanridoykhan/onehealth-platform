import type { useDataEngine } from '@dhis2/app-runtime'
import type { QualityCheck } from '../lib/qualityChecks'
import type { AuditConfig } from '../types/audit'

// Typed from useDataEngine's own return type (type-only import, no React
// dependency at runtime) so the real engine instance passed in from
// context/AuditReportsContext.tsx's imperative fetch queue type-checks
// exactly, rather than against a hand-rolled, structurally looser interface.
type Engine = ReturnType<typeof useDataEngine>

// Field names confirmed live against play.dhis2.org (DHIS2 2.43.1): the
// endpoint accepts extra fields beyond what a given DHIS2 version's response
// actually populates, so every field here is read defensively (multiple
// possible key names, all optional) rather than assumed exact -- only the
// wrapper shape ({ outlierValues: [...] }) and its emptiness were directly
// observed; a real DHIS2 instance with actual outliers in range would be
// needed to confirm the per-item field names beyond what the docs describe.
interface OutlierValue {
  pe?: string
  period?: string
  ou?: string
  ouName?: string
  orgUnitName?: string
  value?: number
}

interface OutlierApiResponse {
  result: {
    outlierValues?: OutlierValue[]
  }
}

// Prefers DHIS2's own native outlier-detection endpoint (Z-Score / modified
// Z-Score / Min-Max algorithms) over reinventing statistics from scratch --
// this is a real, existing core DHIS2 feature, confirmed live at
// GET /api/outlierDetection?dx={id}&ou={id}&startDate=...&endDate=...&algorithm=...
// (NOT /api/dataAnalysis/outlierDetection with a `de` param, which is what
// this file originally guessed and which 404s on real DHIS2 -- the `dx`
// dimension-item parameter name matches DHIS2's general analytics convention,
// confirmed by directly testing both against a live instance).
//
// Still written defensively: on any failure (endpoint missing on an older
// DHIS2 core version, unsupported params) it returns null rather than
// throwing, and buildDataTrustReport in qualityChecks.ts automatically falls
// back to the local IQR check (computeOutlierFallback) in that case -- the
// report never blocks on this.
//
// Exported as a plain async function rather than a React hook because the
// shared AuditReportsContext calls it imperatively, once per audit, from a
// concurrency-limited queue -- not from component render.
export async function fetchNativeOutlierCheck(engine: Engine, audit: AuditConfig): Promise<QualityCheck | null> {
  if (!audit.outlierDetectionEnabled) return null

  try {
    const query = {
      result: {
        resource: 'outlierDetection',
        params: {
          dx: audit.dataElementId,
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
              .map((o) => `${o.ouName ?? o.orgUnitName ?? o.ou ?? '?'} ${o.pe ?? o.period ?? '?'}=${o.value ?? '?'}`)
              .join(', ')}${outliers.length > 5 ? ', ...' : ''}.`,
      dimension: 'Validity',
    }
  } catch {
    return null
  }
}
