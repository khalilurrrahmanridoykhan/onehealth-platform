import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useState } from 'react'
import {
  buildDurationEventPayload,
  extractTrackerErrorMessage,
  extractUpdatedEventStats,
  type DurationFormValues,
  type ExistingEventForUpdate,
  type TrackerImportResponse,
} from '../lib/provisioning'
import type { DurationCapableProgram } from '../types/stewardship'

interface State {
  submitting: boolean
  error: string | null
}

interface EventQueryResponse {
  event: ExistingEventForUpdate
}

// Mirrors useSubmitFollowUp.ts exactly -- the ungated model, not
// useSubmitApproval.ts's gated one: recording when a course ended is a
// factual clinical observation available to anyone, not a controlled
// decision. Fetch fresh, build the merge-safe payload, submit under explicit
// importStrategy=UPDATE.
export function useSubmitDuration() {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ submitting: false, error: null })

  const submitDuration = useCallback(
    async (provisioned: DurationCapableProgram, eventId: string, values: DurationFormValues): Promise<boolean> => {
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
          setState({ submitting: false, error: 'Could not load this entry to record a stop date -- it may have been deleted.' })
          return false
        }

        const payload = buildDurationEventPayload(provisioned, existing, values)
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

  return { ...state, submitDuration }
}
