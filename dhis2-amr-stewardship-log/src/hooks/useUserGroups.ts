import { useDataEngine } from '@dhis2/app-runtime'
import { useEffect, useState } from 'react'

export interface UserGroupSummary {
  id: string
  name: string
}

interface State {
  loading: boolean
  error: string | null
  userGroups: UserGroupSummary[]
}

interface UserGroupsResponse {
  userGroups: UserGroupSummary[]
}

const DEBOUNCE_MS = 300

// Debounced user-group search for the reviewer-group picker in
// SetupPanel.tsx -- same shape as useOrgUnits.ts, confirmed live against the
// Play demo that /api/userGroups supports the identical fields/filter/order
// query shape.
export function useUserGroups(searchTerm: string): State {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: false, error: null, userGroups: [] })

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      const trimmed = searchTerm.trim()
      const query = {
        result: {
          resource: 'userGroups',
          params: {
            fields: 'id,name',
            pageSize: 25,
            order: 'name:asc',
            ...(trimmed ? { filter: `name:ilike:${trimmed}` } : {}),
          },
        },
      }

      engine
        .query(query)
        .then((response) => {
          if (cancelled) return
          const { userGroups } = (response as unknown as { result: UserGroupsResponse }).result
          setState({ loading: false, error: null, userGroups: userGroups ?? [] })
        })
        .catch((error: Error) => {
          if (!cancelled) setState({ loading: false, error: error.message, userGroups: [] })
        })
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [engine, searchTerm])

  return state
}
