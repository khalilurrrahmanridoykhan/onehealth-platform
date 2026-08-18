// New infrastructure -- no dataStore usage existed anywhere in OneHealth Data
// Trust to port from (confirmed via grep before writing this). Persists the
// admin-defined AuditConfig[] as a single blob under one dataStore key, not
// one key per audit, so the whole list loads in one round trip. See
// hooks/useAudits.ts for the read-modify-write cycle that uses this.
//
// Known v1 limitation, documented rather than solved: classic DHIS2 dataStore
// PUT has no ETag/If-Match, so two admins editing simultaneously is
// last-write-wins. Acceptable for the assumed single-admin-at-a-time usage.

import type { AuditConfig } from '../types/audit'

export const DATASTORE_NAMESPACE = 'dataQualityAuditor'
export const AUDITS_KEY = 'audits'
// resource + id (not a single combined path string) is the DHIS2 app-runtime
// data engine's own convention for building `/api/dataStore/{namespace}/{key}` --
// see hooks/useAudits.ts, which is the only place these are used together.
export const DATASTORE_RESOURCE = `dataStore/${DATASTORE_NAMESPACE}`

export const CURRENT_SCHEMA_VERSION = 1 as const

export interface AuditsBlob {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION
  audits: AuditConfig[]
}

export function emptyAuditsBlob(): AuditsBlob {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, audits: [] }
}

export function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /404|not\s*found/i.test(error.message)
}
