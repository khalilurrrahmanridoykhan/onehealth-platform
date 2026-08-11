import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useEffect, useState } from 'react'
import {
  CURRENT_SCHEMA_VERSION,
  DATASTORE_RESOURCE,
  SETTINGS_KEY,
  isNotFoundError,
  type SettingsBlob,
} from '../lib/dataStore'
import { emptyStewardshipSettings, type StewardshipSettings } from '../types/stewardship'

interface State {
  loading: boolean
  error: string | null
  settings: StewardshipSettings
}

interface DataStoreGetResponse {
  blob: SettingsBlob
}

export interface UseStewardshipSettingsResult extends State {
  refresh: () => Promise<void>
  save: (settings: StewardshipSettings) => Promise<void>
}

export function useStewardshipSettings(): UseStewardshipSettingsResult {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: true, error: null, settings: emptyStewardshipSettings() })
  const [keyExists, setKeyExists] = useState(false)

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const response = (await engine.query({
        blob: { resource: DATASTORE_RESOURCE, id: SETTINGS_KEY },
      })) as unknown as DataStoreGetResponse
      setKeyExists(true)
      setState({ loading: false, error: null, settings: response.blob })
    } catch (error) {
      if (isNotFoundError(error)) {
        // Expected on a fresh install -- the key hasn't been created yet.
        setKeyExists(false)
        setState({ loading: false, error: null, settings: emptyStewardshipSettings() })
        return
      }
      setState({ loading: false, error: error instanceof Error ? error.message : String(error), settings: emptyStewardshipSettings() })
    }
  }, [engine])

  useEffect(() => {
    load()
  }, [load])

  const save = useCallback(
    async (settings: StewardshipSettings) => {
      const blob: SettingsBlob = { ...settings, schemaVersion: CURRENT_SCHEMA_VERSION }
      if (keyExists) {
        await engine.mutate({ resource: DATASTORE_RESOURCE, id: SETTINGS_KEY, type: 'update', data: blob })
      } else {
        // 'create' rejects an `id` property at runtime -- the key has to be
        // embedded in `resource` instead. Confirmed live for this exact
        // pattern in every sibling app already; not re-verified here since
        // the dataStore mechanics themselves haven't changed.
        await engine.mutate({ resource: `${DATASTORE_RESOURCE}/${SETTINGS_KEY}`, type: 'create', data: blob })
        setKeyExists(true)
      }
      setState({ loading: false, error: null, settings: blob })
    },
    [engine, keyExists],
  )

  return { ...state, refresh: load, save }
}
