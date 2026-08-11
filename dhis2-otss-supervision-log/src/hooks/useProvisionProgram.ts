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
import type { ProvisionedProgram } from '../types/otss'

interface ProgramSearchResponse {
  programs: {
    id: string
    programStages: { id: string; programStageDataElements: { dataElement: { id: string; name: string } }[] }[]
  }[]
}

interface CreateResponse {
  response: { uid: string }
}

// Same findOrCreateProgram() self-healing pattern as
// dhis2-amr-stewardship-log/src/hooks/useProvisionProgram.ts: look up by
// name, adopt if every expected data element is present, re-provision from
// scratch if anything is missing.
export function useProvisionProgram() {
  const engine = useDataEngine()

  const findExisting = useCallback(async (): Promise<ProvisionedProgram | null> => {
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

    const dataElementIds: Partial<Record<DataElementRole, string>> = {}
    for (const def of DATA_ELEMENT_DEFS) {
      const match = stage.programStageDataElements.find((psde) => psde.dataElement.name === def.name)
      if (!match) return null
      dataElementIds[def.role] = match.dataElement.id
    }

    return {
      programId: program.id,
      programStageId: stage.id,
      dataElementIds: dataElementIds as Record<DataElementRole, string>,
    }
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

  const findOrCreateProgram = useCallback(
    async (orgUnitIds: string[]): Promise<ProvisionedProgram> => {
      const existing = await findExisting()
      if (existing) return existing
      return createNew(orgUnitIds)
    },
    [findExisting, createNew],
  )

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
