export type AwareCategory = 'Access' | 'Watch' | 'Reserve' | 'Not classified'

export const AWARE_CATEGORIES: AwareCategory[] = ['Access', 'Watch', 'Reserve', 'Not classified']

// Stored as the full display string (matching every other categorical field
// in this app -- 'Empiric', 'Access', etc. all store exactly what they
// display), plain TEXT with app-side validation, no DHIS2 option set.
export type DeEscalationOutcome = 'Narrowed' | 'Continued (confirmed appropriate)' | 'Broadened' | 'Discontinued'

export const DE_ESCALATION_OUTCOMES: DeEscalationOutcome[] = ['Narrowed', 'Continued (confirmed appropriate)', 'Broadened', 'Discontinued']

// Stored the same way as DeEscalationOutcome (full display string, plain
// TEXT). There is no 'Pending' member here -- absence of a stored value IS
// pending, same convention as deEscalationOutcome === null meaning "no
// follow-up yet".
export type ApprovalStatus = 'Approved' | 'Rejected'

export const APPROVAL_STATUSES: ApprovalStatus[] = ['Approved', 'Rejected']

export interface FormularyEntry {
  id: string
  antibioticName: string
  awareCategory: AwareCategory
  note: string | null
  // Admin-defined guideline course length for this antibiotic, in days.
  // Added for the therapy duration tracking feature -- lives here, not as a
  // Tracker dataElement, since it's app config data about the formulary
  // itself, not a per-entry fact (the same relationship awareCategory
  // already has). A formulary row saved before this field existed will have
  // this key genuinely `undefined` at runtime despite the type saying
  // `number | null` -- every read must go through
  // resolveTypicalDurationDays() in awareRules.ts, which reads `?? null`
  // defensively, the same discipline FormularyEditor.tsx already applies to
  // `note`.
  typicalDurationDays: number | null
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
    // Added in schemaVersion 3 (restricted-antibiotic approval). Same
    // optional-forward-compatibility reasoning as the de-escalation fields
    // above.
    approvalStatus?: string
    approvalReviewedBy?: string
    approvalDate?: string
    approvalNote?: string
    // Added in schemaVersion 4 (therapy duration tracking). Same
    // optional-forward-compatibility reasoning as the two prior waves above.
    actualStopDate?: string
    actualStopNote?: string
  }
}

// Narrows a ProvisionedProgram to one where a given capability's data
// elements are confirmed present. Each capability is scoped with Pick<> to
// only its own fields, NOT a blanket Required<> over the whole
// dataElementIds object -- an install can have follow-up provisioned but
// not approval (or vice versa), which is a completely normal in-between
// state. A blanket Required<> here would make FollowUpCapableProgram
// wrongly demand the approval fields too as soon as they exist as optional
// keys on dataElementIds, breaking supportsFollowUp() on any install that
// hasn't also adopted approval yet.
export type FollowUpCapableProgram = ProvisionedProgram & {
  dataElementIds: ProvisionedProgram['dataElementIds'] &
    Required<Pick<ProvisionedProgram['dataElementIds'], 'deEscalationOutcome' | 'deEscalationDate' | 'deEscalationNote'>>
}

export function supportsFollowUp(p: ProvisionedProgram): p is FollowUpCapableProgram {
  return (
    p.dataElementIds.deEscalationOutcome !== undefined &&
    p.dataElementIds.deEscalationDate !== undefined &&
    p.dataElementIds.deEscalationNote !== undefined
  )
}

export type ApprovalCapableProgram = ProvisionedProgram & {
  dataElementIds: ProvisionedProgram['dataElementIds'] &
    Required<Pick<ProvisionedProgram['dataElementIds'], 'approvalStatus' | 'approvalReviewedBy' | 'approvalDate' | 'approvalNote'>>
}

export function supportsApproval(p: ProvisionedProgram): p is ApprovalCapableProgram {
  return (
    p.dataElementIds.approvalStatus !== undefined &&
    p.dataElementIds.approvalReviewedBy !== undefined &&
    p.dataElementIds.approvalDate !== undefined &&
    p.dataElementIds.approvalNote !== undefined
  )
}

export type DurationCapableProgram = ProvisionedProgram & {
  dataElementIds: ProvisionedProgram['dataElementIds'] &
    Required<Pick<ProvisionedProgram['dataElementIds'], 'actualStopDate' | 'actualStopNote'>>
}

export function supportsDuration(p: ProvisionedProgram): p is DurationCapableProgram {
  return p.dataElementIds.actualStopDate !== undefined && p.dataElementIds.actualStopNote !== undefined
}

export interface StewardshipSettings {
  schemaVersion: 1 | 2 | 3 | 4
  provisioned: ProvisionedProgram | null
  // Admin-defined -- no bundled antibiotic/AWaRe data ships with this app.
  // See README for why a bundled WHO AWaRe starter list was deliberately
  // not attempted in v1.
  formulary: FormularyEntry[]
  orgUnits: StewardshipOrgUnit[]
  // Added in schemaVersion 3 (restricted-antibiotic approval). The id of the
  // DHIS2 user group whose members may Approve/Reject a Reserve-category
  // entry -- an app-level authorization *policy* pointer at existing DHIS2
  // metadata, the same relationship orgUnits already has, not something this
  // app provisions itself. OPTIONAL for the same forward-compatibility
  // reason as dataElementIds' new fields: an old settings blob with the key
  // entirely absent must still type-check on read with no migration
  // function. null means "no reviewer group configured yet" -- every write
  // path always writes an explicit value, so only old, pre-existing blobs
  // ever rely on the optional-tolerant read.
  reviewerGroupId?: string | null
}

export function emptyStewardshipSettings(): StewardshipSettings {
  return { schemaVersion: 4, provisioned: null, formulary: [], orgUnits: [], reviewerGroupId: null }
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
  // Only ever meaningful for entries whose awareCategory is 'Reserve'.
  // approvalStatus === null means Pending -- not yet reviewed.
  approvalStatus: ApprovalStatus | null
  approvalReviewedBy: string | null
  approvalDate: string | null
  approvalNote: string | null
  // Only meaningful once a course has actually ended; null means "still
  // open," not "no guideline exists" -- guideline lookup is a separate,
  // formulary-side concern (see resolveTypicalDurationDays in
  // awareRules.ts), not a field on the entry itself.
  actualStopDate: string | null
  actualStopNote: string | null
}
