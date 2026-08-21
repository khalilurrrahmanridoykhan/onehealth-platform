import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback } from 'react'
import {
  DATA_ELEMENT_DEFS,
  PROGRAM_NAME,
  PROGRAM_SHARING_PAYLOAD,
  buildDataElementPayload,
  buildProgramPayload,
  buildProgramStagePayload,
  type DataElementRole,
} from '../lib/provisioning'
import type { ProvisionedProgram } from '../types/stewardship'

interface ProgramSearchResponse {
  programs: {
    id: string
    programStages: { id: string; programStageDataElements: { dataElement: { id: string; name: string } }[] }[]
  }[]
}

interface CreateResponse {
  response: { uid: string }
}

interface ProgramStageScan {
  programId: string
  programStageId: string
  foundIds: Partial<Record<DataElementRole, string>>
  missingRoles: DataElementRole[]
}

// findOrCreateProgram() adopts-and-extends rather than re-provisioning from
// scratch: DHIS2 rejects a data element name that already exists, so a
// partially-provisioned install (e.g. one that predates a later feature's
// new fields) must never be run back through createNew(). scanExisting()
// reports exactly which roles are missing; attachMissingDataElements()
// creates only those and appends them to the existing ProgramStage. A fresh
// install (no program found at all) still goes through createNew(), which
// provisions all of DATA_ELEMENT_DEFS in one pass.
export function useProvisionProgram() {
  const engine = useDataEngine()

  const scanExisting = useCallback(async (): Promise<ProgramStageScan | null> => {
    const response = (await engine.query({
      programs: {
        resource: 'programs',
        params: {
          filter: `name:eq:${PROGRAM_NAME}`,
          fields: 'id,programStages[id,programStageDataElements[dataElement[id,name]]]',
        },
      },
    })) as unknown as ProgramSearchResponse

    const program = response.programs[0]
    const stage = program?.programStages[0]
    if (!program || !stage) return null

    const foundIds: Partial<Record<DataElementRole, string>> = {}
    const missingRoles: DataElementRole[] = []
    for (const def of DATA_ELEMENT_DEFS) {
      const match = stage.programStageDataElements.find((psde) => psde.dataElement.name === def.name)
      if (match) foundIds[def.role] = match.dataElement.id
      else missingRoles.push(def.role)
    }

    return { programId: program.id, programStageId: stage.id, foundIds, missingRoles }
  }, [engine])

  const createNew = useCallback(
    async (orgUnitIds: string[]): Promise<ProvisionedProgram> => {
      const dataElementIds: Partial<Record<DataElementRole, string>> = {}
      for (const def of DATA_ELEMENT_DEFS) {
        const response = (await engine.mutate({
          resource: 'dataElements',
          type: 'create',
          data: buildDataElementPayload(def),
        })) as unknown as CreateResponse
        dataElementIds[def.role] = response.response.uid
      }
      const resolvedDataElementIds = dataElementIds as Record<DataElementRole, string>

      const programResponse = (await engine.mutate({
        resource: 'programs',
        type: 'create',
        data: buildProgramPayload(orgUnitIds),
      })) as unknown as CreateResponse
      const programId = programResponse.response.uid

      const stageResponse = (await engine.mutate({
        resource: 'programStages',
        type: 'create',
        data: buildProgramStagePayload(programId, resolvedDataElementIds),
      })) as unknown as CreateResponse
      const programStageId = stageResponse.response.uid

      await engine.mutate({
        resource: 'sharing',
        type: 'create',
        params: { type: 'program', id: programId },
        data: PROGRAM_SHARING_PAYLOAD,
      })

      return { programId, programStageId, dataElementIds: resolvedDataElementIds }
    },
    [engine],
  )

  // Creates only the missing data elements, then read-modify-writes the
  // ProgramStage: DHIS2's metadata PUT replaces the whole object, so sending
  // a bare `{ programStageDataElements: [...new] }` would wipe the original
  // roles from the stage rather than add to them.
  const attachMissingDataElements = useCallback(
    async (scan: ProgramStageScan): Promise<Record<DataElementRole, string>> => {
      const newIds: Partial<Record<DataElementRole, string>> = {}
      for (const role of scan.missingRoles) {
        const def = DATA_ELEMENT_DEFS.find((d) => d.role === role)
        if (!def) continue
        const response = (await engine.mutate({
          resource: 'dataElements',
          type: 'create',
          data: buildDataElementPayload(def),
        })) as unknown as CreateResponse
        newIds[role] = response.response.uid
      }

      const stageResponse = (await engine.query({
        stage: { resource: 'programStages', id: scan.programStageId },
      })) as unknown as { stage: Record<string, unknown> & { programStageDataElements: unknown[] } }

      const appended = scan.missingRoles.map((role) => ({ dataElement: { id: newIds[role] } }))
      await engine.mutate({
        resource: 'programStages',
        id: scan.programStageId,
        type: 'update',
        data: {
          ...stageResponse.stage,
          programStageDataElements: [...stageResponse.stage.programStageDataElements, ...appended],
        },
      })

      return { ...scan.foundIds, ...newIds } as Record<DataElementRole, string>
    },
    [engine],
  )

  const findOrCreateProgram = useCallback(
    async (orgUnitIds: string[]): Promise<ProvisionedProgram> => {
      const scan = await scanExisting()
      if (!scan) return createNew(orgUnitIds)

      if (scan.missingRoles.length === 0) {
        return {
          programId: scan.programId,
          programStageId: scan.programStageId,
          dataElementIds: scan.foundIds as Record<DataElementRole, string>,
        }
      }

      const dataElementIds = await attachMissingDataElements(scan)
      return { programId: scan.programId, programStageId: scan.programStageId, dataElementIds }
    },
    [scanExisting, createNew, attachMissingDataElements],
  )

  // A program's own `organisationUnits` assignment wasn't isolated in the
  // live spike from event submission itself (only one org unit was ever
  // assigned and used together), so rather than assume it's irrelevant to
  // the Tracker API, this keeps it in sync with the admin's org-unit picks
  // on every settings save -- cheap, and avoids depending on unverified
  // platform behavior either way. Read-modify-write on the full object
  // rather than a bare partial payload: DHIS2's metadata PUT replaces the
  // whole object, so sending only `organisationUnits` would wipe every
  // other field (name, programStages, ...) instead of just updating one.
  const syncProgramOrgUnits = useCallback(
    async (programId: string, orgUnitIds: string[]) => {
      const response = (await engine.query({
        program: { resource: 'programs', id: programId },
      })) as unknown as { program: Record<string, unknown> }
      await engine.mutate({
        resource: 'programs',
        id: programId,
        type: 'update',
        data: { ...response.program, organisationUnits: orgUnitIds.map((id) => ({ id })) },
      })
    },
    [engine],
  )

  return { findOrCreateProgram, syncProgramOrgUnits }
}
