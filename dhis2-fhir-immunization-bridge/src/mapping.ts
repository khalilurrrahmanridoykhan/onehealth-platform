// Pure, synchronous mapping logic -- no network calls -- same "stay pure and
// trivially unit-testable" discipline as every DHIS2-app sibling's own
// lib/*.ts. Built directly against real observed data from the public HAPI
// FHIR R4 server, not an idealized reading of the FHIR spec: most
// Immunization resources there carry only `vaccineCode.text`, a minority
// carry a proper `coding[]`, and several optional fields are frequently
// absent.

import type { FhirImmunization, MappedVisit, SkippedResource } from './types'

export type MappingResult = { ok: true; visit: MappedVisit } | { ok: false; skipped: SkippedResource }

// occurrenceDateTime becomes the DHIS2 event's occurredAt, which the
// Tracker API requires -- a resource missing it is skipped and reported,
// never guessed at (e.g. defaulting to "now" would silently fabricate a
// clinical date that was never actually recorded).
export function mapFhirImmunizationToVisit(resource: FhirImmunization): MappingResult {
  if (!resource.occurrenceDateTime) {
    return { ok: false, skipped: { fhirImmunizationId: resource.id, reason: 'missing occurrenceDateTime' } }
  }

  const coding = resource.vaccineCode.coding?.[0]
  const antigenName = coding?.display ?? resource.vaccineCode.text ?? 'Unknown'

  return {
    ok: true,
    visit: {
      fhirImmunizationId: resource.id,
      antigenName,
      vaccineCodingJson: JSON.stringify(resource.vaccineCode),
      status: resource.status,
      sourcePatientRef: resource.patient?.reference ?? null,
      lotNumber: resource.lotNumber ?? null,
      occurredAt: resource.occurrenceDateTime,
    },
  }
}

export function mapAll(resources: FhirImmunization[]): { visits: MappedVisit[]; skipped: SkippedResource[] } {
  const visits: MappedVisit[] = []
  const skipped: SkippedResource[] = []
  for (const resource of resources) {
    const result = mapFhirImmunizationToVisit(resource)
    if (result.ok) visits.push(result.visit)
    else skipped.push(result.skipped)
  }
  return { visits, skipped }
}
