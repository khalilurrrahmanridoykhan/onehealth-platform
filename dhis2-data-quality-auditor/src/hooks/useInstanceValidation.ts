import type { useDataEngine } from '@dhis2/app-runtime'
import type { QualityCheck } from '../lib/qualityChecks'
import type { AuditConfig } from '../types/audit'

// See useOutlierDetection.ts for why this is typed from useDataEngine's own
// return type rather than a hand-rolled interface.
type Engine = ReturnType<typeof useDataEngine>

interface MinMaxDataElement {
  min: number
  max: number
}

interface MinMaxResponse {
  result: { minMaxDataElements?: MinMaxDataElement[] }
}

// Surfaces the target instance's OWN configured min/max value bounds
// (minMaxDataElements) for the audited data element, if any exist, rather
// than only ever applying this app's own logic -- reuses whatever rigor the
// instance's admins have already configured instead of duplicating it. This
// is presence-surfacing (does the instance have its own rules configured
// here at all), complementary to this app's own plausibility checks above,
// not a re-implementation of DHIS2's validation-rule engine.
//
// Plain async function, not a hook, for the same reason as
// useOutlierDetection.ts: called imperatively from the shared
// AuditReportsContext's fetch queue.
export async function fetchInstanceValidationCheck(engine: Engine, audit: AuditConfig): Promise<QualityCheck | null> {
  try {
    const query = {
      result: {
        resource: 'minMaxDataElements',
        params: {
          fields: 'min,max',
          filter: [
            `dataElement.id:eq:${audit.dataElementId}`,
            `source.id:in:[${audit.orgUnits.map((ou) => ou.id).join(',')}]`,
          ],
          paging: false,
        },
      },
    }

    const response = (await engine.query(query)) as unknown as MinMaxResponse
    const bounds = response.result?.minMaxDataElements ?? []

    return {
      code: 'instance_validation_rules',
      status: 'PASS',
      message:
        bounds.length === 0
          ? 'This instance has no min/max value bounds configured for this data element -- nothing additional to surface.'
          : `This instance has its own min/max value bounds configured for this data element at ${bounds.length} org unit(s), on top of this app's own checks above.`,
      dimension: 'Reliability',
    }
  } catch {
    return null
  }
}
