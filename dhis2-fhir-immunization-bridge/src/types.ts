// A deliberately narrow subset of the FHIR R4 Immunization resource -- only
// the fields this bridge actually reads. Confirmed live against the public
// HAPI FHIR R4 test server (https://hapi.fhir.org/baseR4): most records
// carry only `vaccineCode.text` with no `coding` array; a minority carry a
// proper `coding[]`. Every field below except `resourceType`/`id`/`status`/
// `vaccineCode` is genuinely optional in real data, not just in the spec.

export interface FhirCoding {
  system?: string
  code?: string
  display?: string
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[]
  text?: string
}

export interface FhirReference {
  reference?: string
}

export interface FhirImmunization {
  resourceType: 'Immunization'
  id: string
  status: string
  vaccineCode: FhirCodeableConcept
  patient?: FhirReference
  occurrenceDateTime?: string
  lotNumber?: string
  primarySource?: boolean
}

export interface FhirBundleEntry {
  fullUrl?: string
  resource?: FhirImmunization
}

export interface FhirBundle {
  resourceType: 'Bundle'
  entry?: FhirBundleEntry[]
  link?: { relation: string; url: string }[]
}

// The mapped, DHIS2-ready shape for one Immunization resource. Produced by
// mapping.ts, consumed by sync.ts to build the actual Tracker event payload.
export interface MappedVisit {
  fhirImmunizationId: string
  antigenName: string
  vaccineCodingJson: string
  status: string
  sourcePatientRef: string | null
  lotNumber: string | null
  occurredAt: string
}

// A resource that couldn't be mapped (missing occurrenceDateTime) -- kept
// separate from MappedVisit rather than silently dropped, so the CLI can
// report exactly what was skipped and why.
export interface SkippedResource {
  fhirImmunizationId: string
  reason: string
}

export interface ProvisionedProgram {
  programId: string
  programStageId: string
  dataElementIds: {
    fhirImmunizationId: string
    antigenName: string
    vaccineCodingJson: string
    status: string
    sourcePatientRef: string
    lotNumber: string
  }
}
