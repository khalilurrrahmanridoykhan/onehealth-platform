export type AwareCategory = 'Access' | 'Watch' | 'Reserve' | 'Not classified'

export const AWARE_CATEGORIES: AwareCategory[] = ['Access', 'Watch', 'Reserve', 'Not classified']

export interface FormularyEntry {
  id: string
  antibioticName: string
  awareCategory: AwareCategory
  note: string | null
}

export interface StewardshipOrgUnit {
  id: string
  name: string
}

// Resolved once by findOrCreateProgram() (see hooks/useProvisionProgram.ts)
// and cached here so every later read/write skips re-querying program
// metadata. Null fields mean "not yet provisioned on this instance."
export interface ProvisionedProgram {
  programId: string
  programStageId: string
  dataElementIds: {
    antibiotic: string
    indication: string
    empiricOrCultureGuided: string
    awareCategory: string
    justificationNote: string
  }
}

export interface StewardshipSettings {
  schemaVersion: 1
  provisioned: ProvisionedProgram | null
  // Admin-defined -- no bundled antibiotic/AWaRe data ships with this app.
  // See README for why a bundled WHO AWaRe starter list was deliberately
  // not attempted in v1.
  formulary: FormularyEntry[]
  orgUnits: StewardshipOrgUnit[]
}

export function emptyStewardshipSettings(): StewardshipSettings {
  return { schemaVersion: 1, provisioned: null, formulary: [], orgUnits: [] }
}

// Not persisted by this app -- always read live from DHIS2's own Tracker API
// (GET /api/tracker/events), the same "derive from live records, don't
// duplicate the store" principle already used for coverage/quality checks
// elsewhere in this project. This type just shapes a mapped query response.
export type EmpiricOrCultureGuided = 'Empiric' | 'Culture-guided'

export interface PrescribingEntry {
  eventId: string
  orgUnitId: string
  orgUnitName: string
  occurredAt: string
  antibioticName: string
  awareCategory: AwareCategory
  indication: string
  empiricOrCultureGuided: EmpiricOrCultureGuided | null
  justificationNote: string | null
  enteredBy: string | null
}
