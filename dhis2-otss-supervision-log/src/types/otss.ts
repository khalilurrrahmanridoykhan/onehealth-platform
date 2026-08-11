// Module structure mirrors the real OTSS (Outreach Training and Supportive
// Supervision) model described in Burnett et al. 2019 (PMC6447118) -- 5 of
// the paper's 6 core modules are scored checklists here; the 6th
// ("Feedback and action plans") maps directly to this app's own
// gapsIdentified/actionPlan/followUpDate fields rather than being a scored
// checklist itself, since that's what it actually is in the paper too.
export type ModuleType = 'Microscopy' | 'RDT' | 'Clinical' | 'RegisterReview' | 'GeneralOtss'

export const MODULE_TYPES: ModuleType[] = ['Microscopy', 'RDT', 'Clinical', 'RegisterReview', 'GeneralOtss']

export const MODULE_LABELS: Record<ModuleType, string> = {
  Microscopy: 'Microscopy observation',
  RDT: 'Malaria RDT observation',
  Clinical: 'Clinical observation',
  RegisterReview: 'Adherence (register review)',
  GeneralOtss: 'General OTSS (staffing, commodities, infrastructure)',
}

// Determines the validity rule a module's responses are gated by -- the
// paper's own methodology, not a guess: an Observation module needs at
// least one complete observation; a RegisterReview module needs at least
// half the recommended record sample (5 or 10, indicator-dependent in the
// paper; admin-configurable here). GeneralOtss follows the same rule as an
// Observation module.
export type ModuleKind = 'Observation' | 'RegisterReview' | 'General'

export const MODULE_KIND: Record<ModuleType, ModuleKind> = {
  Microscopy: 'Observation',
  RDT: 'Observation',
  Clinical: 'Observation',
  RegisterReview: 'RegisterReview',
  GeneralOtss: 'General',
}

export type ChecklistItemStatus = 'Yes' | 'No' | 'Partial' | 'N/A'

export interface ChecklistItem {
  id: string
  moduleType: ModuleType
  label: string
}

export interface OtssSettings {
  schemaVersion: 1
  provisioned: ProvisionedProgram | null
  // Admin-defined, empty on fresh install -- no bundled checklist content,
  // same "unbounded, admin-configurable" stance as every sibling app's core
  // domain object.
  checklist: ChecklistItem[]
  // Minimum records a supervisor must review for the RegisterReview module
  // to count as complete. Paper used 5 or 10 depending on indicator; this
  // app uses one admin-set number, default 5.
  registerReviewRequiredSample: number
  orgUnits: { id: string; name: string }[]
}

export function emptyOtssSettings(): OtssSettings {
  return {
    schemaVersion: 1,
    provisioned: null,
    checklist: [],
    registerReviewRequiredSample: 5,
    orgUnits: [],
  }
}

export interface ProvisionedProgram {
  programId: string
  programStageId: string
  dataElementIds: {
    cadreObserved: string
    checklistResponses: string
    completenessPercent: string
    competencyPercent: string
    gapsIdentified: string
    actionPlan: string
    followUpDate: string
  }
}

export interface ChecklistResponse {
  itemId: string
  moduleType: ModuleType
  status: ChecklistItemStatus
  note: string | null
}

// The JSON payload stored in the checklistResponses data element.
export interface VisitChecklistData {
  responses: ChecklistResponse[]
  // Only meaningful if a RegisterReview module has configured items --
  // how many records the supervisor actually reviewed this visit.
  registerReviewRecordsReviewed: number | null
}

// Not persisted by this app -- read live from Tracker, same principle as
// every sibling's own visit/entry type.
export interface SupervisionVisit {
  eventId: string
  orgUnitId: string
  orgUnitName: string
  occurredAt: string
  cadreObserved: string
  checklist: VisitChecklistData
  completenessPercent: number | null
  competencyPercent: number | null
  gapsIdentified: string | null
  actionPlan: string | null
  followUpDate: string | null
  enteredBy: string | null
}
