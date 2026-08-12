// Idempotency via this bridge's own dataStore blob, not an unverified
// Tracker event data-value filter query -- see the plan for why: the
// dataStore read-modify-write pattern is already proven across every
// sibling app, a Tracker filter-by-data-value query has never been
// exercised in this project. Re-running a sync must never create duplicate
// DHIS2 events for the same FHIR resource; this is the mechanism that
// guarantees it.

import { dhis2GetOrNull, dhis2Post, dhis2Put } from './dhis2Client'
import type { Dhis2Config } from './dhis2Client'
import type { MappedVisit } from './types'

export const DATASTORE_NAMESPACE = 'fhirImmunizationBridge'
export const SYNCED_IDS_KEY = 'syncedIds'

export interface SyncedIdsBlob {
  schemaVersion: 1
  ids: string[]
}

// Pure: given the FHIR resource ids already synced and a batch of newly
// mapped visits, which visits are actually new. Kept separate from the
// dataStore I/O below so it's trivially unit-testable.
export function filterNewVisits(visits: MappedVisit[], alreadySynced: ReadonlySet<string>): MappedVisit[] {
  return visits.filter((v) => !alreadySynced.has(v.fhirImmunizationId))
}

export async function loadSyncedIds(config: Dhis2Config): Promise<Set<string>> {
  const blob = await dhis2GetOrNull<SyncedIdsBlob>(config, `/api/dataStore/${DATASTORE_NAMESPACE}/${SYNCED_IDS_KEY}`)
  return new Set(blob?.ids ?? [])
}

// Raw REST semantics (unlike @dhis2/app-runtime's engine.mutate(), which
// has its own quirky create-vs-update URL convention): POST creates at
// /api/dataStore/{ns}/{key}, PUT updates the same URL. Check existence
// first to pick the right verb.
export async function saveSyncedIds(config: Dhis2Config, ids: ReadonlySet<string>): Promise<void> {
  const path = `/api/dataStore/${DATASTORE_NAMESPACE}/${SYNCED_IDS_KEY}`
  const blob: SyncedIdsBlob = { schemaVersion: 1, ids: [...ids] }
  const existing = await dhis2GetOrNull<SyncedIdsBlob>(config, path)
  if (existing) {
    await dhis2Put(config, path, blob)
  } else {
    await dhis2Post(config, path, blob)
  }
}
