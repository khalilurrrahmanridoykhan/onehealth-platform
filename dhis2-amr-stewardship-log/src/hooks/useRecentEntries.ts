import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useEffect, useState } from 'react'
import { mapTrackerEventToEntry, type RawTrackerEvent } from '../lib/provisioning'
import type { PrescribingEntry, StewardshipSettings } from '../types/stewardship'

interface State {
  loading: boolean
  error: string | null
  entries: PrescribingEntry[]
}

interface TrackerEventsResponse {
  events: RawTrackerEvent[]
}

// Queries by program only (not per-org-unit) and filters to the admin's
// configured org units client-side, rather than relying on an unverified
// multi-org-unit query-param syntax for GET /api/tracker/events -- the
// single-org-unit filter used in the live spike was confirmed, a
// multi-value one wasn't, and the expected data volume here (a facility
// checklist, not bulk case data) makes client-side filtering cheap and safe.
export function useRecentEntries(settings: StewardshipSettings): State & { refresh: () => Promise<void> } {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: true, error: null, entries: [] })

  const load = useCallback(async () => {
    if (!settings.provisioned || settings.orgUnits.length === 0) {
      setState({ loading: false, error: null, entries: [] })
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
      const entries = (response.result.events ?? [])
        .filter((raw) => allowedOrgUnitIds.has(raw.orgUnit))
        .map((raw) => mapTrackerEventToEntry(raw, settings.provisioned!, orgUnitNameById.get(raw.orgUnit) ?? raw.orgUnit))

      setState({ loading: false, error: null, entries })
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : String(error), entries: [] })
    }
  }, [engine, settings])

  useEffect(() => {
    load()
  }, [load])

  return { ...state, refresh: load }
}
