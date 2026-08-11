import { useDataEngine } from '@dhis2/app-runtime'
import { useEffect, useState } from 'react'

export interface OrgUnitSummary {
  id: string
  name: string
}

interface State {
  loading: boolean
  error: string | null
  orgUnits: OrgUnitSummary[]
}

interface OrgUnitsResponse {
  organisationUnits: OrgUnitSummary[]
}

const DEBOUNCE_MS = 300

// Debounced org-unit search, adapted from useDataSets.ts's own debounced
// pattern -- same reasoning: instances can have thousands of org units, so
// this is a search box, not a dump of every one.
export function useOrgUnits(searchTerm: string): State {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: false, error: null, orgUnits: [] })

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      setState((prev) => ({ ...prev, loading: true, error: null }))

      const trimmed = searchTerm.trim()
      const query = {
        result: {
          resource: 'organisationUnits',
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
          const { organisationUnits } = (response as unknown as { result: OrgUnitsResponse }).result
          setState({ loading: false, error: null, orgUnits: organisationUnits ?? [] })
        })
        .catch((error: Error) => {
          if (!cancelled) setState({ loading: false, error: error.message, orgUnits: [] })
        })
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [engine, searchTerm])

  return state
}
