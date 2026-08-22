// Pure payload builders + response parsers for provisioning this app's own
// DHIS2 Program/ProgramStage/DataElements and reading back Tracker import
// results. Every shape here was confirmed live against play.dhis2.org
// (stable-2-43-1) before being written, via a standalone curl spike -- see
// the plan for the full trail. Three real corrections from what was assumed
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
// 3. (De-escalation follow-up feature) Updating an existing Tracker event's
//    dataValues MERGES by dataElement, not a wholesale replace -- confirmed
//    live: an update sent with only 2 of 5 dataValues left the other 3
//    untouched on read-back. A separate, explicit `value: ""` DOES clear a
//    field (distinct from omitting it, which leaves the existing value
//    alone). Despite merge being confirmed safe, buildFollowUpEventPayload
//    below still resends the complete known dataValues set unconditionally
//    -- defensive by design, not because merge was found unsafe. Also
//    confirmed: `valueType: 'DATE'` accepts a plain `"YYYY-MM-DD"` string,
//    no full ISO datetime required.
// 4. (Restricted-antibiotic approval feature) buildApprovalEventPayload
//    reuses the exact same merge-safe update pattern as
//    buildFollowUpEventPayload -- no new Tracker-update behavior to verify,
//    this was already confirmed by finding 3.

import type {
  ApprovalCapableProgram,
  ApprovalStatus,
  AwareCategory,
  DeEscalationOutcome,
  FollowUpCapableProgram,
  PrescribingEntry,
  ProvisionedProgram,
} from '../types/stewardship'
import { APPROVAL_STATUSES, DE_ESCALATION_OUTCOMES } from '../types/stewardship'

export const PROGRAM_NAME = 'AMR Stewardship Log'
export const PROGRAM_SHORT_NAME = 'AMR Stewardship Log'
export const PROGRAM_STAGE_NAME = 'Prescribing entry'

export type DataElementRole =
  | 'antibiotic'
  | 'indication'
  | 'empiricOrCultureGuided'
  | 'awareCategory'
  | 'justificationNote'
  | 'deEscalationOutcome'
  | 'deEscalationDate'
  | 'deEscalationNote'
  | 'approvalStatus'
  | 'approvalReviewedBy'
  | 'approvalDate'
  | 'approvalNote'

export interface DataElementDef {
  role: DataElementRole
  name: string
  shortName: string
  valueType: 'TEXT' | 'LONG_TEXT' | 'DATE'
}

// The original 5, present on every install regardless of version.
export const CORE_ROLES: DataElementRole[] = ['antibiotic', 'indication', 'empiricOrCultureGuided', 'awareCategory', 'justificationNote']

// Added for the de-escalation follow-up feature -- absent on any install
// provisioned before this feature shipped, until it's adopted-and-extended
// (see useProvisionProgram.ts).
export const FOLLOW_UP_ROLES: DataElementRole[] = ['deEscalationOutcome', 'deEscalationDate', 'deEscalationNote']

// Added for the restricted-antibiotic approval feature -- same
// absent-until-adopted-and-extended story as FOLLOW_UP_ROLES.
export const APPROVAL_ROLES: DataElementRole[] = ['approvalStatus', 'approvalReviewedBy', 'approvalDate', 'approvalNote']

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
  {
    role: 'deEscalationOutcome',
    name: 'AMR Stewardship -- De-escalation outcome',
    shortName: 'AMR SL De-escalation',
    valueType: 'TEXT',
  },
  {
    role: 'deEscalationDate',
    name: 'AMR Stewardship -- De-escalation review date',
    shortName: 'AMR SL De-esc date',
    valueType: 'DATE',
  },
  {
    role: 'deEscalationNote',
    name: 'AMR Stewardship -- De-escalation note',
    shortName: 'AMR SL De-esc note',
    valueType: 'LONG_TEXT',
  },
  {
    role: 'approvalStatus',
    name: 'AMR Stewardship -- Restricted approval status',
    shortName: 'AMR SL Approval status',
    valueType: 'TEXT',
  },
  {
    role: 'approvalReviewedBy',
    name: 'AMR Stewardship -- Restricted approval reviewed by',
    shortName: 'AMR SL Approval reviewer',
    valueType: 'TEXT',
  },
  {
    role: 'approvalDate',
    name: 'AMR Stewardship -- Restricted approval date',
    shortName: 'AMR SL Approval date',
    valueType: 'DATE',
  },
  {
    role: 'approvalNote',
    name: 'AMR Stewardship -- Restricted approval note',
    shortName: 'AMR SL Approval note',
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

// The subset of a queried Tracker event this app needs to safely build an
// update -- fetched fresh by useSubmitFollowUp.ts immediately before
// submitting, never reused from an already-loaded list, so a concurrent edit
// by another user is preserved rather than clobbered.
export interface ExistingEventForUpdate {
  event: string
  orgUnit: string
  occurredAt: string
  status: 'ACTIVE' | 'COMPLETED' | 'SCHEDULE' | 'OVERDUE' | 'SKIPPED'
  dataValues: { dataElement: string; value: string }[]
}

export interface FollowUpFormValues {
  deEscalationOutcome: DeEscalationOutcome
  deEscalationDate: string
  deEscalationNote: string | null
}

// Updates the same event in place (see plan Context: WITHOUT_REGISTRATION
// caps a program at one stage, so "second visit" isn't representable as a
// second stage -- one antibiotic course is one record, completed over time).
// Starts from the existing dataValues and upserts the follow-up fields by
// dataElement (replace-by-id, not append -- matters when re-recording an
// already-recorded follow-up). Resends `existing`'s orgUnit/occurredAt/status
// verbatim: occurredAt is the *prescribing* date and must never be
// overwritten with today's date, which is what deEscalationDate is for.
// Confirmed live that a Tracker event update MERGES dataValues by
// dataElement rather than replacing the array wholesale (see module
// comment) -- resending the full known set here is defensive by design, not
// because merge was found unsafe.
export function buildFollowUpEventPayload(
  provisioned: FollowUpCapableProgram,
  existing: ExistingEventForUpdate,
  values: FollowUpFormValues,
) {
  const dataValues = existing.dataValues.filter(
    (dv) =>
      dv.dataElement !== provisioned.dataElementIds.deEscalationOutcome &&
      dv.dataElement !== provisioned.dataElementIds.deEscalationDate &&
      dv.dataElement !== provisioned.dataElementIds.deEscalationNote,
  )
  dataValues.push({ dataElement: provisioned.dataElementIds.deEscalationOutcome, value: values.deEscalationOutcome })
  dataValues.push({ dataElement: provisioned.dataElementIds.deEscalationDate, value: values.deEscalationDate })
  if (values.deEscalationNote) {
    dataValues.push({ dataElement: provisioned.dataElementIds.deEscalationNote, value: values.deEscalationNote })
  }
  return {
    events: [
      {
        event: existing.event,
        program: provisioned.programId,
        programStage: provisioned.programStageId,
        orgUnit: existing.orgUnit,
        occurredAt: existing.occurredAt,
        status: existing.status,
        dataValues,
      },
    ],
  }
}

export interface ApprovalFormValues {
  approvalStatus: ApprovalStatus
  approvalReviewedBy: string
  approvalDate: string
  approvalNote: string | null
}

// Same merge-safe update-in-place pattern as buildFollowUpEventPayload --
// upserts (replace-by-dataElement, not append) so re-recording an
// already-decided review (e.g. Rejected -> Approved) doesn't accumulate
// duplicate dataValues. approvalReviewedBy stores the reviewing steward's
// DHIS2 username, supplied by the caller: no Tracker event field
// distinguishes "who made this specific update" from `createdBy` (which
// stays fixed to the original prescriber -- see mapTrackerEventToEntry's
// enteredBy), so this has to be app-supplied, not read back from the
// platform.
export function buildApprovalEventPayload(
  provisioned: ApprovalCapableProgram,
  existing: ExistingEventForUpdate,
  values: ApprovalFormValues,
) {
  const dataValues = existing.dataValues.filter(
    (dv) =>
      dv.dataElement !== provisioned.dataElementIds.approvalStatus &&
      dv.dataElement !== provisioned.dataElementIds.approvalReviewedBy &&
      dv.dataElement !== provisioned.dataElementIds.approvalDate &&
      dv.dataElement !== provisioned.dataElementIds.approvalNote,
  )
  dataValues.push({ dataElement: provisioned.dataElementIds.approvalStatus, value: values.approvalStatus })
  dataValues.push({ dataElement: provisioned.dataElementIds.approvalReviewedBy, value: values.approvalReviewedBy })
  dataValues.push({ dataElement: provisioned.dataElementIds.approvalDate, value: values.approvalDate })
  if (values.approvalNote) {
    dataValues.push({ dataElement: provisioned.dataElementIds.approvalNote, value: values.approvalNote })
  }
  return {
    events: [
      {
        event: existing.event,
        program: provisioned.programId,
        programStage: provisioned.programStageId,
        orgUnit: existing.orgUnit,
        occurredAt: existing.occurredAt,
        status: existing.status,
        dataValues,
      },
    ],
  }
}

// Confirmed live shape of a POST /api/tracker response. `stats` is present on
// both create and update responses (importStrategy=UPDATE spike confirmed
// `stats.updated`).
export interface TrackerImportResponse {
  status: 'OK' | 'ERROR' | 'WARNING'
  stats?: { created?: number; updated?: number; deleted?: number; ignored?: number }
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

// A response with status 'OK' but stats.updated: 0 is a silent no-op (e.g. a
// stale/unrecognized event UID under importStrategy=UPDATE) and must surface
// as an error to the caller, never as a success toast.
export function extractUpdatedEventStats(response: TrackerImportResponse): { updated: number } | null {
  const updated = response.stats?.updated
  return typeof updated === 'number' ? { updated } : null
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
    deEscalationOutcome: undefined,
    deEscalationDate: undefined,
    deEscalationNote: undefined,
    approvalStatus: undefined,
    approvalReviewedBy: undefined,
    approvalDate: undefined,
    approvalNote: undefined,
  }
  for (const [role, id] of idToRole) values[role] = byRole.get(id)

  const awareCategory = values.awareCategory
  const isKnownCategory = (v: string | undefined): v is AwareCategory =>
    v === 'Access' || v === 'Watch' || v === 'Reserve' || v === 'Not classified'

  const isKnownOutcome = (v: string | undefined): v is DeEscalationOutcome =>
    (DE_ESCALATION_OUTCOMES as string[]).includes(v ?? '')

  const isKnownApprovalStatus = (v: string | undefined): v is ApprovalStatus =>
    (APPROVAL_STATUSES as string[]).includes(v ?? '')

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
    deEscalationOutcome: isKnownOutcome(values.deEscalationOutcome) ? values.deEscalationOutcome : null,
    deEscalationDate: values.deEscalationDate ?? null,
    deEscalationNote: values.deEscalationNote ?? null,
    approvalStatus: isKnownApprovalStatus(values.approvalStatus) ? values.approvalStatus : null,
    approvalReviewedBy: values.approvalReviewedBy ?? null,
    approvalDate: values.approvalDate ?? null,
    approvalNote: values.approvalNote ?? null,
  }
}
