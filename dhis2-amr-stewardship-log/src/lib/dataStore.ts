// Same single-blob-per-key dataStore pattern as every sibling app in this
// monorepo (see dhis2-data-quality-auditor/src/lib/dataStore.ts and
// dhis2-data-share-hub's equivalent). One key this time: `settings`, holding
// the whole StewardshipSettings object -- there's no per-item list here the
// way audits/shares are lists, so one read-modify-write blob is simplest.

import type { StewardshipSettings } from '../types/stewardship'

export const DATASTORE_NAMESPACE = 'amrStewardshipLog'
export const SETTINGS_KEY = 'settings'
export const DATASTORE_RESOURCE = `dataStore/${DATASTORE_NAMESPACE}`

// Bumped to 4 for the therapy duration tracking feature (adds 2 more
// optional dataElementIds). Same forward-compatible-by-construction
// reasoning as the v2/v3 bumps: a v3 blob still type-checks on read as-is,
// no migration function needed. The next Configure-and-Save
// (findOrCreateProgram()) extends the DHIS2-side program stage and the blob
// is rewritten with schemaVersion 4 at that point.
export const CURRENT_SCHEMA_VERSION = 4 as const

export function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /404|not\s*found/i.test(error.message)
}

export type SettingsBlob = StewardshipSettings
