import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useEffect, useState } from 'react'
import {
  CURRENT_SCHEMA_VERSION,
  DATASTORE_RESOURCE,
  SETTINGS_KEY,
  isNotFoundError,
  type SettingsBlob,
} from '../lib/dataStore'
import { emptyOtssSettings, type OtssSettings } from '../types/otss'

interface State {
  loading: boolean
  error: string | null
  settings: OtssSettings
}

interface DataStoreGetResponse {
  blob: SettingsBlob
}

export interface UseOtssSettingsResult extends State {
  refresh: () => Promise<void>
  save: (settings: OtssSettings) => Promise<void>
}

export function useOtssSettings(): UseOtssSettingsResult {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: true, error: null, settings: emptyOtssSettings() })
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
        setKeyExists(false)
        setState({ loading: false, error: null, settings: emptyOtssSettings() })
        return
      }
      setState({ loading: false, error: error instanceof Error ? error.message : String(error), settings: emptyOtssSettings() })
    }
  }, [engine])

  useEffect(() => {
    load()
  }, [load])

  const save = useCallback(
    async (settings: OtssSettings) => {
      const blob: SettingsBlob = { ...settings, schemaVersion: CURRENT_SCHEMA_VERSION }
      if (keyExists) {
        await engine.mutate({ resource: DATASTORE_RESOURCE, id: SETTINGS_KEY, type: 'update', data: blob })
      } else {
        await engine.mutate({ resource: `${DATASTORE_RESOURCE}/${SETTINGS_KEY}`, type: 'create', data: blob })
        setKeyExists(true)
      }
      setState({ loading: false, error: null, settings: blob })
    },
    [engine, keyExists],
  )

  return { ...state, refresh: load, save }
}
