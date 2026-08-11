// Pure payload builders + response parsers for provisioning this app's own
// DHIS2 Program/ProgramStage/DataElements and reading back Tracker import
// results. Every shape here was confirmed live against play.dhis2.org
// (stable-2-43-1) before being written, via a standalone curl spike -- see
// the plan for the full trail. Two real corrections from what was assumed
// going in:
//
// 1. POST /api/programs with a nested `programStages` array does NOT work --
//    it fails with "Invalid reference ... (ProgramStage) ... [null]" even
//    though the program itself gets created (then rolled back with the rest
//    of the transaction). The program and its stage must be created as two
//    separate calls: POST /api/programs first (no programStages), then
//    POST /api/programStages referencing the new program via `program: {id}`.
// 2. A Program's sharing access string uses the same 4-part convention as
//    datasets/dashboards (`r-rw----` = metadata read-only, data read+write),
//    confirmed by granting it publicly and then confirming, with two
//    separate real test accounts, that (a) an org-unit-scoped account can
//    submit a real event and (b) an out-of-scope account is rejected with a
//    real 409 and a specific "no capture scope access" message -- DHIS2's
//    own org-unit capture-scope check remains the real security boundary
//    regardless of this sharing grant.

import type { AwareCategory, PrescribingEntry, ProvisionedProgram } from '../types/stewardship'

export const PROGRAM_NAME = 'AMR Stewardship Log'
export const PROGRAM_SHORT_NAME = 'AMR Stewardship Log'
export const PROGRAM_STAGE_NAME = 'Prescribing entry'

export type DataElementRole = 'antibiotic' | 'indication' | 'empiricOrCultureGuided' | 'awareCategory' | 'justificationNote'

export interface DataElementDef {
  role: DataElementRole
  name: string
  shortName: string
  valueType: 'TEXT' | 'LONG_TEXT'
}

export const DATA_ELEMENT_DEFS: DataElementDef[] = [
  { role: 'antibiotic', name: 'AMR Stewardship -- Antibiotic name', shortName: 'AMR SL Antibiotic', valueType: 'TEXT' },
  { role: 'indication', name: 'AMR Stewardship -- Indication', shortName: 'AMR SL Indication', valueType: 'TEXT' },
  {
    role: 'empiricOrCultureGuided',
    name: 'AMR Stewardship -- Empiric or culture-guided',
    shortName: 'AMR SL Empiric/Culture',
    valueType: 'TEXT',
  },
  { role: 'awareCategory', name: 'AMR Stewardship -- AWaRe category', shortName: 'AMR SL AWaRe category', valueType: 'TEXT' },
  {
    role: 'justificationNote',
    name: 'AMR Stewardship -- Justification note',
    shortName: 'AMR SL Justification',
    valueType: 'LONG_TEXT',
  },
]

export function buildDataElementPayload(def: DataElementDef) {
  return {
    name: def.name,
    shortName: def.shortName,
    domainType: 'TRACKER' as const,
    valueType: def.valueType,
    aggregationType: 'NONE' as const,
  }
}

export function buildProgramPayload(orgUnitIds: string[]) {
  return {
    name: PROGRAM_NAME,
    shortName: PROGRAM_SHORT_NAME,
    programType: 'WITHOUT_REGISTRATION' as const,
    organisationUnits: orgUnitIds.map((id) => ({ id })),
  }
}

export function buildProgramStagePayload(programId: string, dataElementIds: Record<DataElementRole, string>) {
  return {
    name: PROGRAM_STAGE_NAME,
    program: { id: programId },
    programStageDataElements: DATA_ELEMENT_DEFS.map((def) => ({ dataElement: { id: dataElementIds[def.role] } })),
  }
}

// Metadata read-only + data read/write for any authenticated user -- see
// module comment for why this is safe: DHIS2's own org-unit capture-scope
// check still gates who can actually submit for which facility.
export const PROGRAM_SHARING_PAYLOAD = {
  object: { publicAccess: 'r-rw----', userGroupAccesses: [], userAccesses: [] },
}

export interface EventFormValues {
  antibiotic: string
  indication: string
  empiricOrCultureGuided: string
  awareCategory: AwareCategory
  justificationNote: string | null
}

export function buildEventPayload(provisioned: ProvisionedProgram, orgUnitId: string, occurredAt: string, values: EventFormValues) {
  const dataValues: { dataElement: string; value: string }[] = [
    { dataElement: provisioned.dataElementIds.antibiotic, value: values.antibiotic },
    { dataElement: provisioned.dataElementIds.indication, value: values.indication },
    { dataElement: provisioned.dataElementIds.empiricOrCultureGuided, value: values.empiricOrCultureGuided },
    { dataElement: provisioned.dataElementIds.awareCategory, value: values.awareCategory },
  ]
  if (values.justificationNote) {
    dataValues.push({ dataElement: provisioned.dataElementIds.justificationNote, value: values.justificationNote })
  }
  return {
    events: [
      {
        program: provisioned.programId,
        programStage: provisioned.programStageId,
        orgUnit: orgUnitId,
        occurredAt,
        status: 'COMPLETED' as const,
        dataValues,
      },
    ],
  }
}

// Confirmed live shape of a POST /api/tracker response.
export interface TrackerImportResponse {
  status: 'OK' | 'ERROR' | 'WARNING'
  validationReport?: { errorReports?: { message: string }[] }
  bundleReport?: { typeReportMap?: { EVENT?: { objectReports?: { uid: string }[] } } }
}

export function extractCreatedEventId(response: TrackerImportResponse): string | null {
  return response.bundleReport?.typeReportMap?.EVENT?.objectReports?.[0]?.uid ?? null
}

export function extractTrackerErrorMessage(response: TrackerImportResponse): string | null {
  const messages = response.validationReport?.errorReports?.map((r) => r.message) ?? []
  return messages.length > 0 ? messages.join(' ') : null
}

// Confirmed live shape of a single item in GET /api/tracker/events's
// `events` array (with fields=event,occurredAt,orgUnit,dataValues[dataElement,value],createdBy).
export interface RawTrackerEvent {
  event: string
  orgUnit: string
  occurredAt: string
  dataValues: { dataElement: string; value: string }[]
  createdBy?: { username: string } | null
}

// Inverse of buildEventPayload: maps a raw queried event back to a
// PrescribingEntry, resolving each dataValue's dataElement UID back to its
// role via the same provisioned.dataElementIds mapping used to build it.
// orgUnitName comes from the caller's own settings.orgUnits list rather than
// the query response, which doesn't include it.
export function mapTrackerEventToEntry(
  raw: RawTrackerEvent,
  provisioned: ProvisionedProgram,
  orgUnitName: string,
): PrescribingEntry {
  const byRole = new Map<string, string>()
  for (const dv of raw.dataValues) byRole.set(dv.dataElement, dv.value)

  const idToRole = Object.entries(provisioned.dataElementIds) as [DataElementRole, string][]
  const values: Record<DataElementRole, string | undefined> = {
    antibiotic: undefined,
    indication: undefined,
    empiricOrCultureGuided: undefined,
    awareCategory: undefined,
    justificationNote: undefined,
  }
  for (const [role, id] of idToRole) values[role] = byRole.get(id)

  const awareCategory = values.awareCategory
  const isKnownCategory = (v: string | undefined): v is AwareCategory =>
    v === 'Access' || v === 'Watch' || v === 'Reserve' || v === 'Not classified'

  return {
    eventId: raw.event,
    orgUnitId: raw.orgUnit,
    orgUnitName,
    occurredAt: raw.occurredAt,
    antibioticName: values.antibiotic ?? '',
    awareCategory: isKnownCategory(awareCategory) ? awareCategory : 'Not classified',
    indication: values.indication ?? '',
    empiricOrCultureGuided:
      values.empiricOrCultureGuided === 'Empiric' || values.empiricOrCultureGuided === 'Culture-guided'
        ? values.empiricOrCultureGuided
        : null,
    justificationNote: values.justificationNote ?? null,
    enteredBy: raw.createdBy?.username ?? null,
  }
}
