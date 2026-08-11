// Pure payload builders + response parsers for provisioning this app's own
// DHIS2 Program/ProgramStage/DataElements and reading back Tracker import
// results. Reuses the exact shapes confirmed live against play.dhis2.org
// (stable-2-43-1) for dhis2-amr-stewardship-log's own lib/provisioning.ts --
// no new spike was run for this app, since none of these mechanics changed:
//
// 1. POST /api/programs does NOT accept a nested `programStages` array --
//    the program and its stage are created as two separate calls.
// 2. A Program's sharing access string uses the same 4-part convention as
//    datasets/dashboards (`r-rw----` = metadata read-only, data read+write);
//    DHIS2's own org-unit capture-scope check remains the real boundary on
//    who can actually submit for which facility.
//
// The one genuinely new-to-this-app element is the `DATE` valueType on
// `followUpDate` -- verified live in this app's own build/verification pass
// rather than needing its own up-front spike, since it's a standard,
// well-documented DHIS2 value type.

import type { ProvisionedProgram, VisitChecklistData } from '../types/otss'

export const PROGRAM_NAME = 'OTSS Supervision Log'
export const PROGRAM_SHORT_NAME = 'OTSS Supervision Log'
export const PROGRAM_STAGE_NAME = 'Supervision visit'

export type DataElementRole =
  | 'cadreObserved'
  | 'checklistResponses'
  | 'completenessPercent'
  | 'competencyPercent'
  | 'gapsIdentified'
  | 'actionPlan'
  | 'followUpDate'

export interface DataElementDef {
  role: DataElementRole
  name: string
  shortName: string
  valueType: 'TEXT' | 'LONG_TEXT' | 'INTEGER_ZERO_OR_POSITIVE' | 'DATE'
}

export const DATA_ELEMENT_DEFS: DataElementDef[] = [
  { role: 'cadreObserved', name: 'OTSS Supervision -- Cadre observed', shortName: 'OTSS Cadre observed', valueType: 'TEXT' },
  {
    role: 'checklistResponses',
    name: 'OTSS Supervision -- Checklist responses (JSON)',
    shortName: 'OTSS Checklist JSON',
    valueType: 'LONG_TEXT',
  },
  {
    role: 'completenessPercent',
    name: 'OTSS Supervision -- Completeness percent',
    shortName: 'OTSS Completeness pct',
    valueType: 'INTEGER_ZERO_OR_POSITIVE',
  },
  {
    role: 'competencyPercent',
    name: 'OTSS Supervision -- Competency percent',
    shortName: 'OTSS Competency pct',
    valueType: 'INTEGER_ZERO_OR_POSITIVE',
  },
  { role: 'gapsIdentified', name: 'OTSS Supervision -- Gaps identified', shortName: 'OTSS Gaps identified', valueType: 'LONG_TEXT' },
  { role: 'actionPlan', name: 'OTSS Supervision -- Action plan', shortName: 'OTSS Action plan', valueType: 'LONG_TEXT' },
  { role: 'followUpDate', name: 'OTSS Supervision -- Follow-up date', shortName: 'OTSS Follow-up date', valueType: 'DATE' },
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

export const PROGRAM_SHARING_PAYLOAD = {
  object: { publicAccess: 'r-rw----', userGroupAccesses: [], userAccesses: [] },
}

export interface VisitFormValues {
  cadreObserved: string
  checklist: VisitChecklistData
  completenessPercent: number | null
  competencyPercent: number | null
  gapsIdentified: string | null
  actionPlan: string | null
  followUpDate: string | null
}

export function buildEventPayload(provisioned: ProvisionedProgram, orgUnitId: string, occurredAt: string, values: VisitFormValues) {
  const dataValues: { dataElement: string; value: string }[] = [
    { dataElement: provisioned.dataElementIds.cadreObserved, value: values.cadreObserved },
    { dataElement: provisioned.dataElementIds.checklistResponses, value: JSON.stringify(values.checklist) },
  ]
  if (values.completenessPercent !== null) {
    dataValues.push({ dataElement: provisioned.dataElementIds.completenessPercent, value: String(values.completenessPercent) })
  }
  if (values.competencyPercent !== null) {
    dataValues.push({ dataElement: provisioned.dataElementIds.competencyPercent, value: String(values.competencyPercent) })
  }
  if (values.gapsIdentified) {
    dataValues.push({ dataElement: provisioned.dataElementIds.gapsIdentified, value: values.gapsIdentified })
  }
  if (values.actionPlan) {
    dataValues.push({ dataElement: provisioned.dataElementIds.actionPlan, value: values.actionPlan })
  }
  if (values.followUpDate) {
    dataValues.push({ dataElement: provisioned.dataElementIds.followUpDate, value: values.followUpDate })
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

export interface RawTrackerEvent {
  event: string
  orgUnit: string
  occurredAt: string
  dataValues: { dataElement: string; value: string }[]
  createdBy?: { username: string } | null
}

function emptyChecklistData(): VisitChecklistData {
  return { responses: [], registerReviewRecordsReviewed: null }
}

export function mapTrackerEventToVisit(
  raw: RawTrackerEvent,
  provisioned: ProvisionedProgram,
  orgUnitName: string,
): import('../types/otss').SupervisionVisit {
  const byRole = new Map<string, string>()
  for (const dv of raw.dataValues) byRole.set(dv.dataElement, dv.value)

  const idToRole = Object.entries(provisioned.dataElementIds) as [DataElementRole, string][]
  const values: Partial<Record<DataElementRole, string>> = {}
  for (const [role, id] of idToRole) values[role] = byRole.get(id)

  let checklist: VisitChecklistData = emptyChecklistData()
  if (values.checklistResponses) {
    try {
      const parsed = JSON.parse(values.checklistResponses)
      if (parsed && Array.isArray(parsed.responses)) checklist = parsed
    } catch {
      // Malformed JSON (e.g. an event created by something other than this
      // app) -- fall back to an empty checklist rather than throwing, same
      // "don't let one bad record break the whole summary" stance as every
      // sibling app's own defensive parsing.
      checklist = emptyChecklistData()
    }
  }

  const toIntOrNull = (v: string | undefined): number | null => {
    if (v === undefined) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  return {
    eventId: raw.event,
    orgUnitId: raw.orgUnit,
    orgUnitName,
    occurredAt: raw.occurredAt,
    cadreObserved: values.cadreObserved ?? '',
    checklist,
    completenessPercent: toIntOrNull(values.completenessPercent),
    competencyPercent: toIntOrNull(values.competencyPercent),
    gapsIdentified: values.gapsIdentified ?? null,
    actionPlan: values.actionPlan ?? null,
    followUpDate: values.followUpDate ?? null,
    enteredBy: raw.createdBy?.username ?? null,
  }
}
