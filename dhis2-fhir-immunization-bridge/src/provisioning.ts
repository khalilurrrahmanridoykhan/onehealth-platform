// Payload shapes reused unchanged from dhis2-otss-supervision-log's own
// lib/provisioning.ts, confirmed live against play.dhis2.org
// (stable-2-43-1): a Program's `programStages` array can't be nested in the
// creation POST (it silently fails), so the Program and its ProgramStage
// are created as two separate calls; a Program's sharing access string is
// `r-rw----` (metadata read-only, data read+write). Only the HTTP layer
// differs here -- dhis2Client's plain fetch instead of engine.mutate().

import { dhis2Get, dhis2Post, dhis2Put } from './dhis2Client'
import type { Dhis2Config } from './dhis2Client'
import type { MappedVisit, ProvisionedProgram } from './types'

export const PROGRAM_NAME = 'FHIR Immunization Bridge'
export const PROGRAM_STAGE_NAME = 'Synced immunization'

export type DataElementRole = 'fhirImmunizationId' | 'antigenName' | 'vaccineCodingJson' | 'status' | 'sourcePatientRef' | 'lotNumber'

export interface DataElementDef {
  role: DataElementRole
  name: string
  shortName: string
  valueType: 'TEXT' | 'LONG_TEXT'
}

export const DATA_ELEMENT_DEFS: DataElementDef[] = [
  { role: 'fhirImmunizationId', name: 'FHIR Bridge -- Source FHIR Immunization id', shortName: 'FHIR Bridge Source id', valueType: 'TEXT' },
  { role: 'antigenName', name: 'FHIR Bridge -- Antigen name', shortName: 'FHIR Bridge Antigen', valueType: 'TEXT' },
  { role: 'vaccineCodingJson', name: 'FHIR Bridge -- Vaccine coding (raw JSON)', shortName: 'FHIR Bridge Coding JSON', valueType: 'LONG_TEXT' },
  { role: 'status', name: 'FHIR Bridge -- Immunization status', shortName: 'FHIR Bridge Status', valueType: 'TEXT' },
  { role: 'sourcePatientRef', name: 'FHIR Bridge -- Source patient reference', shortName: 'FHIR Bridge Patient ref', valueType: 'TEXT' },
  { role: 'lotNumber', name: 'FHIR Bridge -- Lot number', shortName: 'FHIR Bridge Lot number', valueType: 'TEXT' },
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
    shortName: PROGRAM_NAME,
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

export function buildEventPayload(provisioned: ProvisionedProgram, orgUnitId: string, visit: MappedVisit) {
  const dataValues: { dataElement: string; value: string }[] = [
    { dataElement: provisioned.dataElementIds.fhirImmunizationId, value: visit.fhirImmunizationId },
    { dataElement: provisioned.dataElementIds.antigenName, value: visit.antigenName },
    { dataElement: provisioned.dataElementIds.vaccineCodingJson, value: visit.vaccineCodingJson },
    { dataElement: provisioned.dataElementIds.status, value: visit.status },
  ]
  if (visit.sourcePatientRef) {
    dataValues.push({ dataElement: provisioned.dataElementIds.sourcePatientRef, value: visit.sourcePatientRef })
  }
  if (visit.lotNumber) {
    dataValues.push({ dataElement: provisioned.dataElementIds.lotNumber, value: visit.lotNumber })
  }
  return {
    events: [
      {
        program: provisioned.programId,
        programStage: provisioned.programStageId,
        orgUnit: orgUnitId,
        occurredAt: visit.occurredAt,
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

interface ProgramSearchResponse {
  programs: {
    id: string
    programStages: { id: string; programStageDataElements: { dataElement: { id: string; name: string } }[] }[]
  }[]
}

interface CreateResponse {
  response: { uid: string }
}

// Same findOrCreateProgram() self-healing pattern as every sibling app's
// own hooks/useProvisionProgram.ts: look up by name, adopt if every
// expected data element is present, re-provision from scratch otherwise.
export async function findOrCreateProgram(config: Dhis2Config, orgUnitIds: string[]): Promise<ProvisionedProgram> {
  const existing = await findExistingProgram(config)
  if (existing) return existing
  return createProgram(config, orgUnitIds)
}

async function findExistingProgram(config: Dhis2Config): Promise<ProvisionedProgram | null> {
  const params = new URLSearchParams({
    filter: `name:eq:${PROGRAM_NAME}`,
    fields: 'id,programStages[id,programStageDataElements[dataElement[id,name]]]',
  })
  const response = await dhis2Get<ProgramSearchResponse>(config, `/api/programs?${params.toString()}`)
  const program = response.programs[0]
  const stage = program?.programStages[0]
  if (!program || !stage) return null

  const dataElementIds: Partial<Record<DataElementRole, string>> = {}
  for (const def of DATA_ELEMENT_DEFS) {
    const match = stage.programStageDataElements.find((psde) => psde.dataElement.name === def.name)
    if (!match) return null
    dataElementIds[def.role] = match.dataElement.id
  }

  return { programId: program.id, programStageId: stage.id, dataElementIds: dataElementIds as Record<DataElementRole, string> }
}

async function createProgram(config: Dhis2Config, orgUnitIds: string[]): Promise<ProvisionedProgram> {
  const dataElementIds: Partial<Record<DataElementRole, string>> = {}
  for (const def of DATA_ELEMENT_DEFS) {
    const response = await dhis2Post<CreateResponse>(config, '/api/dataElements', buildDataElementPayload(def))
    dataElementIds[def.role] = response.response.uid
  }
  const resolvedDataElementIds = dataElementIds as Record<DataElementRole, string>

  const programResponse = await dhis2Post<CreateResponse>(config, '/api/programs', buildProgramPayload(orgUnitIds))
  const programId = programResponse.response.uid

  const stageResponse = await dhis2Post<CreateResponse>(
    config,
    '/api/programStages',
    buildProgramStagePayload(programId, resolvedDataElementIds),
  )
  const programStageId = stageResponse.response.uid

  await dhis2Post(config, `/api/sharing?type=program&id=${programId}`, PROGRAM_SHARING_PAYLOAD)

  return { programId, programStageId, dataElementIds: resolvedDataElementIds }
}

export async function submitEvent(config: Dhis2Config, provisioned: ProvisionedProgram, orgUnitId: string, visit: MappedVisit): Promise<string> {
  const payload = buildEventPayload(provisioned, orgUnitId, visit)
  const response = await dhis2Post<TrackerImportResponse>(config, '/api/tracker?async=false', payload)
  if (response.status !== 'OK') {
    throw new Error(extractTrackerErrorMessage(response) ?? 'DHIS2 rejected this event.')
  }
  const eventId = extractCreatedEventId(response)
  if (!eventId) throw new Error('DHIS2 reported success but no event id was returned.')
  return eventId
}

// dhis2Put on /api/programs needs the full object (DHIS2 metadata PUT
// replaces the whole object), same reasoning as every sibling app's own
// syncProgramOrgUnits().
export async function syncProgramOrgUnits(config: Dhis2Config, programId: string, orgUnitIds: string[]): Promise<void> {
  const program = await dhis2Get<Record<string, unknown>>(config, `/api/programs/${programId}`)
  await dhis2Put(config, `/api/programs/${programId}`, { ...program, organisationUnits: orgUnitIds.map((id) => ({ id })) })
}
