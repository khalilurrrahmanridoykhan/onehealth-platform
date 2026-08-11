import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useState } from 'react'
import {
  buildEventPayload,
  extractCreatedEventId,
  extractTrackerErrorMessage,
  type TrackerImportResponse,
  type VisitFormValues,
} from '../lib/provisioning'
import type { ProvisionedProgram } from '../types/otss'

interface State {
  submitting: boolean
  error: string | null
}

// Same shape as dhis2-amr-stewardship-log's useSubmitEntry.ts: DHIS2's own
// org-unit capture-scope check on POST /api/tracker is the real boundary --
// confirmed live for that app, not re-verified here since the mechanic is
// identical, only the payload shape differs.
export function useSubmitVisit() {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ submitting: false, error: null })

  const submitVisit = useCallback(
    async (provisioned: ProvisionedProgram, orgUnitId: string, occurredAt: string, values: VisitFormValues): Promise<string | null> => {
      setState({ submitting: true, error: null })
      try {
        const payload = buildEventPayload(provisioned, orgUnitId, occurredAt, values)
        const response = (await engine.mutate({
          resource: 'tracker',
          type: 'create',
          params: { async: 'false' },
          data: payload,
        })) as unknown as TrackerImportResponse

        if (response.status !== 'OK') {
          const message = extractTrackerErrorMessage(response) ?? 'DHIS2 rejected this visit.'
          setState({ submitting: false, error: message })
          return null
        }
        setState({ submitting: false, error: null })
        return extractCreatedEventId(response)
      } catch (error) {
        setState({ submitting: false, error: error instanceof Error ? error.message : String(error) })
        return null
      }
    },
    [engine],
  )

  return { ...state, submitVisit }
}
