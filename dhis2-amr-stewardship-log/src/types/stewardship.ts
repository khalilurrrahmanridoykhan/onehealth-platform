export type AwareCategory = 'Access' | 'Watch' | 'Reserve' | 'Not classified'

export const AWARE_CATEGORIES: AwareCategory[] = ['Access', 'Watch', 'Reserve', 'Not classified']

// Stored as the full display string (matching every other categorical field
// in this app -- 'Empiric', 'Access', etc. all store exactly what they
// display), plain TEXT with app-side validation, no DHIS2 option set.
export type DeEscalationOutcome = 'Narrowed' | 'Continued (confirmed appropriate)' | 'Broadened' | 'Discontinued'

export const DE_ESCALATION_OUTCOMES: DeEscalationOutcome[] = ['Narrowed', 'Continued (confirmed appropriate)', 'Broadened', 'Discontinued']

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
    // Added in schemaVersion 2 (de-escalation follow-up). OPTIONAL so a v1
    // settings blob still type-checks on read -- absence means "this
    // install predates the follow-up feature and hasn't been extended
    // yet." The follow-up UI stays hidden until an admin re-opens Configure
    // Stewardship, which calls findOrCreateProgram() again and adopts these.
    deEscalationOutcome?: string
    deEscalationDate?: string
    deEscalationNote?: string
  }
}

// Narrows a ProvisionedProgram to one where the follow-up data elements are
// confirmed present -- used to gate the follow-up UI and payload builder.
export type FollowUpCapableProgram = ProvisionedProgram & {
  dataElementIds: Required<ProvisionedProgram['dataElementIds']>
}

export function supportsFollowUp(p: ProvisionedProgram): p is FollowUpCapableProgram {
  return (
    p.dataElementIds.deEscalationOutcome !== undefined &&
    p.dataElementIds.deEscalationDate !== undefined &&
    p.dataElementIds.deEscalationNote !== undefined
  )
}

export interface StewardshipSettings {
  schemaVersion: 1 | 2
  provisioned: ProvisionedProgram | null
  // Admin-defined -- no bundled antibiotic/AWaRe data ships with this app.
  // See README for why a bundled WHO AWaRe starter list was deliberately
  // not attempted in v1.
  formulary: FormularyEntry[]
  orgUnits: StewardshipOrgUnit[]
}

export function emptyStewardshipSettings(): StewardshipSettings {
  return { schemaVersion: 2, provisioned: null, formulary: [], orgUnits: [] }
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
  // Only ever populated for entries that started 'Empiric' and have since
  // had a follow-up recorded. The original empiricOrCultureGuided value is
  // never rewritten by a follow-up -- that immutability is what makes
  // follow-up-rate/de-escalation-rate denominators meaningful.
  deEscalationOutcome: DeEscalationOutcome | null
  deEscalationDate: string | null
  deEscalationNote: string | null
}
