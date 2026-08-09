import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useEffect, useState } from 'react'
import { AUDITS_KEY, CURRENT_SCHEMA_VERSION, DATASTORE_RESOURCE, isNotFoundError, type AuditsBlob } from '../lib/dataStore'
import type { AuditConfig } from '../types/audit'

interface State {
  loading: boolean
  error: string | null
  audits: AuditConfig[]
}

interface DataStoreGetResponse {
  blob: AuditsBlob
}

export interface UseAuditsResult extends State {
  refresh: () => Promise<void>
  saveAudit: (audit: AuditConfig) => Promise<void>
  deleteAudit: (id: string) => Promise<void>
}

export function useAudits(): UseAuditsResult {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: true, error: null, audits: [] })
  // Whether the dataStore key has ever been created -- determines POST
  // (create) vs. PUT (update) on the next save. Starts unknown until the
  // first load resolves.
  const [keyExists, setKeyExists] = useState(false)

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const response = (await engine.query({
        blob: { resource: DATASTORE_RESOURCE, id: AUDITS_KEY },
      })) as unknown as DataStoreGetResponse
      setKeyExists(true)
      setState({ loading: false, error: null, audits: response.blob.audits ?? [] })
    } catch (error) {
      if (isNotFoundError(error)) {
        // Expected on a fresh install -- the key hasn't been created yet.
        setKeyExists(false)
        setState({ loading: false, error: null, audits: [] })
        return
      }
      setState({ loading: false, error: error instanceof Error ? error.message : String(error), audits: [] })
    }
  }, [engine])

  useEffect(() => {
    load()
  }, [load])

  const persist = useCallback(
    async (audits: AuditConfig[]) => {
      const blob: AuditsBlob = { schemaVersion: CURRENT_SCHEMA_VERSION, audits }
      if (keyExists) {
        await engine.mutate({ resource: DATASTORE_RESOURCE, id: AUDITS_KEY, type: 'update', data: blob })
      } else {
        await engine.mutate({ resource: DATASTORE_RESOURCE, id: AUDITS_KEY, type: 'create', data: blob })
        setKeyExists(true)
      }
      setState({ loading: false, error: null, audits })
    },
    [engine, keyExists],
  )

  const saveAudit = useCallback(
    async (audit: AuditConfig) => {
      const next = [...state.audits]
      const index = next.findIndex((a) => a.id === audit.id)
      if (index >= 0) next[index] = audit
      else next.push(audit)
      await persist(next)
    },
    [persist, state.audits],
  )

  const deleteAudit = useCallback(
    async (id: string) => {
      await persist(state.audits.filter((a) => a.id !== id))
    },
    [persist, state.audits],
  )

  return { ...state, refresh: load, saveAudit, deleteAudit }
}
