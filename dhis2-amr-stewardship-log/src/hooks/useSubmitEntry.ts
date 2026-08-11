import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useState } from 'react'
import {
  buildEventPayload,
  extractCreatedEventId,
  extractTrackerErrorMessage,
  type EventFormValues,
  type TrackerImportResponse,
} from '../lib/provisioning'
import type { ProvisionedProgram } from '../types/stewardship'

interface State {
  submitting: boolean
  error: string | null
}

// Confirmed live: a rejected submission (e.g. no org-unit capture scope) is
// a real 409 with a DHIS2-specific message ("User: ... has no capture scope
// access to OrganisationUnit: ..."), not a silent failure. Whether
// @dhis2/app-runtime's engine.mutate() surfaces that message directly on a
// thrown Error, or only a generic HTTP-status string, was left to confirm in
// the live verification pass -- see the plan. This catch block tries the
// structured tracker response first and falls back to the raw error message.
export function useSubmitEntry() {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ submitting: false, error: null })

  const submitEntry = useCallback(
    async (provisioned: ProvisionedProgram, orgUnitId: string, occurredAt: string, values: EventFormValues): Promise<string | null> => {
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
          const message = extractTrackerErrorMessage(response) ?? 'DHIS2 rejected this entry.'
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

  return { ...state, submitEntry }
}
