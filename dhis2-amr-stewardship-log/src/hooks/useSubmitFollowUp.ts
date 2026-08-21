import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useState } from 'react'
import {
  buildFollowUpEventPayload,
  extractTrackerErrorMessage,
  extractUpdatedEventStats,
  type ExistingEventForUpdate,
  type FollowUpFormValues,
  type TrackerImportResponse,
} from '../lib/provisioning'
import type { FollowUpCapableProgram } from '../types/stewardship'

interface State {
  submitting: boolean
  error: string | null
}

interface EventQueryResponse {
  event: ExistingEventForUpdate
}

// Mirrors useSubmitEntry.ts's { submitting, error } shape. Three steps:
// (1) fetch the event fresh -- never reused from an already-loaded list, so
// a concurrent edit by another user is preserved rather than clobbered; a
// fetch failure aborts outright rather than falling back to a partial
// payload. (2) build the merge-safe update payload. (3) submit under
// explicit importStrategy=UPDATE (not the default CREATE_AND_UPDATE) so a
// stale/unrecognized event UID is a loud rejection instead of silently
// creating an orphan event with only follow-up fields and no prescribing
// data.
export function useSubmitFollowUp() {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ submitting: false, error: null })

  const submitFollowUp = useCallback(
    async (provisioned: FollowUpCapableProgram, eventId: string, values: FollowUpFormValues): Promise<boolean> => {
      setState({ submitting: true, error: null })
      try {
        const eventResponse = (await engine.query({
          event: {
            resource: 'tracker/events',
            id: eventId,
            params: { fields: 'event,orgUnit,occurredAt,status,dataValues[dataElement,value]' },
          },
        })) as unknown as EventQueryResponse

        const existing = eventResponse.event
        if (!existing) {
          setState({ submitting: false, error: 'Could not load this entry to record a follow-up -- it may have been deleted.' })
          return false
        }

        const payload = buildFollowUpEventPayload(provisioned, existing, values)
        const response = (await engine.mutate({
          resource: 'tracker',
          type: 'create',
          params: { async: 'false', importStrategy: 'UPDATE' },
          data: payload,
        })) as unknown as TrackerImportResponse

        const stats = extractUpdatedEventStats(response)
        if (response.status !== 'OK' || !stats || stats.updated !== 1) {
          const message = extractTrackerErrorMessage(response) ?? 'DHIS2 did not update this entry as expected.'
          setState({ submitting: false, error: message })
          return false
        }

        setState({ submitting: false, error: null })
        return true
      } catch (error) {
        setState({ submitting: false, error: error instanceof Error ? error.message : String(error) })
        return false
      }
    },
    [engine],
  )

  return { ...state, submitFollowUp }
}
