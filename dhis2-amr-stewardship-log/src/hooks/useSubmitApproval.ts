import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useState } from 'react'
import {
  buildApprovalEventPayload,
  extractTrackerErrorMessage,
  extractUpdatedEventStats,
  type ApprovalFormValues,
  type ExistingEventForUpdate,
  type TrackerImportResponse,
} from '../lib/provisioning'
import type { ApprovalCapableProgram } from '../types/stewardship'

interface State {
  submitting: boolean
  error: string | null
}

interface EventQueryResponse {
  event: ExistingEventForUpdate
}

// Mirrors useSubmitFollowUp.ts exactly: fetch the event fresh (never reused
// from an already-loaded list, so a concurrent edit is preserved rather than
// clobbered), build the merge-safe payload, submit under explicit
// importStrategy=UPDATE so a stale/unrecognized event uid is a loud
// rejection instead of silently creating an orphan event.
export function useSubmitApproval() {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ submitting: false, error: null })

  const submitApproval = useCallback(
    async (provisioned: ApprovalCapableProgram, eventId: string, values: ApprovalFormValues): Promise<boolean> => {
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
          setState({ submitting: false, error: 'Could not load this entry to record a review decision -- it may have been deleted.' })
          return false
        }

        const payload = buildApprovalEventPayload(provisioned, existing, values)
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

  return { ...state, submitApproval }
}
