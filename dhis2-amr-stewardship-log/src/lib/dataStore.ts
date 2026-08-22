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
//
// The overdue-notifications feature (notificationGroupId,
// lastOverdueNotificationCheckAt on StewardshipSettings) deliberately did
// NOT bump this to 5. Every prior bump was specifically about
// dataElementIds growing on ProvisionedProgram -- the signal
// findOrCreateProgram()'s adopt-and-extend logic and SetupPanel's "install
// predates feature X" notices key off. Overdue notifications add no
// dataElementIds and touch no Tracker/programStage metadata at all; it's
// the same shape of change as formulary[].typicalDurationDays (added within
// this same v4 bump but not itself the reason for it) -- a plain optional
// top-level field, read defensively with `??`, with no DHIS2-side state a
// reader needs to distinguish. Bumping here would conflate two meanings of
// "schema version" this codebase has deliberately kept separate.
export const CURRENT_SCHEMA_VERSION = 4 as const

export function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /404|not\s*found/i.test(error.message)
}

export type SettingsBlob = StewardshipSettings
