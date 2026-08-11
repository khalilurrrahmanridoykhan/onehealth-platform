import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useEffect, useState } from 'react'
import { mapTrackerEventToVisit, type RawTrackerEvent } from '../lib/provisioning'
import type { OtssSettings, SupervisionVisit } from '../types/otss'

interface State {
  loading: boolean
  error: string | null
  visits: SupervisionVisit[]
}

interface TrackerEventsResponse {
  events: RawTrackerEvent[]
}

// Queries by program only and filters to the admin's configured org units
// client-side -- same reasoning as the AMR app's useRecentEntries.ts: the
// single-org-unit filter was the one confirmed live, a multi-value one
// wasn't, and the expected data volume (facility supervision visits, not
// bulk case data) makes client-side filtering cheap and safe.
export function useRecentVisits(settings: OtssSettings): State & { refresh: () => Promise<void> } {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: true, error: null, visits: [] })

  const load = useCallback(async () => {
    if (!settings.provisioned || settings.orgUnits.length === 0) {
      setState({ loading: false, error: null, visits: [] })
      return
    }
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const response = (await engine.query({
        result: {
          resource: 'tracker/events',
          params: {
            program: settings.provisioned.programId,
            fields: 'event,occurredAt,orgUnit,dataValues[dataElement,value],createdBy',
            pageSize: 200,
            order: 'occurredAt:desc',
          },
        },
      })) as unknown as { result: TrackerEventsResponse }

      const orgUnitNameById = new Map(settings.orgUnits.map((ou) => [ou.id, ou.name]))
      const allowedOrgUnitIds = new Set(settings.orgUnits.map((ou) => ou.id))
      const visits = (response.result.events ?? [])
        .filter((raw) => allowedOrgUnitIds.has(raw.orgUnit))
        .map((raw) => mapTrackerEventToVisit(raw, settings.provisioned!, orgUnitNameById.get(raw.orgUnit) ?? raw.orgUnit))

      setState({ loading: false, error: null, visits })
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : String(error), visits: [] })
    }
  }, [engine, settings])

  useEffect(() => {
    load()
  }, [load])

  return { ...state, refresh: load }
}
