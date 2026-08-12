// Orchestration -- real network I/O, so unlike mapping.ts/dedupe.ts this
// isn't unit-tested directly; it's exercised by the live verification pass
// against the real FHIR server and a real DHIS2 instance, same "unit-test
// the pure logic, live-verify the orchestration" split every sibling app's
// own hooks/*.ts follows.

import type { Dhis2Config } from './dhis2Client'
import { loadSyncedIds, saveSyncedIds, filterNewVisits } from './dedupe'
import { fetchImmunizations } from './fhirClient'
import { mapAll } from './mapping'
import { findOrCreateProgram, submitEvent } from './provisioning'
import type { SkippedResource } from './types'

export interface SyncOptions {
  dhis2: Dhis2Config
  orgUnitId: string
  fhirBaseUrl?: string
  count?: number
  maxPages?: number
}

export interface SyncReport {
  fetched: number
  mappedOk: number
  skippedMapping: SkippedResource[]
  alreadySynced: number
  created: number
  errors: { fhirImmunizationId: string; message: string }[]
}

export async function runSync(options: SyncOptions): Promise<SyncReport> {
  const resources = await fetchImmunizations({ baseUrl: options.fhirBaseUrl, count: options.count, maxPages: options.maxPages })
  const { visits, skipped } = mapAll(resources)

  const alreadySyncedIds = await loadSyncedIds(options.dhis2)
  const newVisits = filterNewVisits(visits, alreadySyncedIds)

  const provisioned = await findOrCreateProgram(options.dhis2, [options.orgUnitId])

  const errors: { fhirImmunizationId: string; message: string }[] = []
  const updatedSyncedIds = new Set(alreadySyncedIds)
  let created = 0

  for (const visit of newVisits) {
    try {
      await submitEvent(options.dhis2, provisioned, options.orgUnitId, visit)
      updatedSyncedIds.add(visit.fhirImmunizationId)
      created++
    } catch (error) {
      errors.push({ fhirImmunizationId: visit.fhirImmunizationId, message: error instanceof Error ? error.message : String(error) })
    }
  }

  // Persist even if some events errored -- the ones that did succeed must
  // stay recorded as synced so a retry doesn't duplicate them too.
  await saveSyncedIds(options.dhis2, updatedSyncedIds)

  return {
    fetched: resources.length,
    mappedOk: visits.length,
    skippedMapping: skipped,
    alreadySynced: visits.length - newVisits.length,
    created,
    errors,
  }
}
