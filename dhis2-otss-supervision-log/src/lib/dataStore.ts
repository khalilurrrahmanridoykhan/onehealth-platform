// Same single-blob-per-key dataStore pattern as every sibling app -- see
// dhis2-amr-stewardship-log/src/lib/dataStore.ts. One key: `settings`.

import type { OtssSettings } from '../types/otss'

export const DATASTORE_NAMESPACE = 'otssSupervisionLog'
export const SETTINGS_KEY = 'settings'
export const DATASTORE_RESOURCE = `dataStore/${DATASTORE_NAMESPACE}`

export const CURRENT_SCHEMA_VERSION = 1 as const

export function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /404|not\s*found/i.test(error.message)
}

export type SettingsBlob = OtssSettings
