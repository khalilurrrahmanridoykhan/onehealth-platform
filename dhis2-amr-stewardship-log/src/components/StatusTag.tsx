import { Tag } from '@dhis2/ui'
import type { ApprovalStatus, AwareCategory, DeEscalationOutcome } from '../types/stewardship'

const AWARE_PROPS: Record<AwareCategory, { positive?: boolean; negative?: boolean; neutral?: boolean }> = {
  Access: { positive: true },
  Watch: { neutral: true },
  Reserve: { negative: true },
  'Not classified': { neutral: true },
}

export function AwareTag({ category }: { category: AwareCategory }) {
  return <Tag {...AWARE_PROPS[category]}>{category}</Tag>
}

// Narrowed/Discontinued are the positive outcomes of a follow-up review
// (successful de-escalation); Continued is a neutral, deliberate clinical
// call; Broadened is flagged negative since it's the direction stewardship
// tries to minimize.
const OUTCOME_PROPS: Record<DeEscalationOutcome, { positive?: boolean; negative?: boolean; neutral?: boolean }> = {
  Narrowed: { positive: true },
  'Continued (confirmed appropriate)': { neutral: true },
  Broadened: { negative: true },
  Discontinued: { positive: true },
}

export function OutcomeTag({ outcome }: { outcome: DeEscalationOutcome }) {
  return <Tag {...OUTCOME_PROPS[outcome]}>{outcome}</Tag>
}

const APPROVAL_PROPS: Record<ApprovalStatus, { positive?: boolean; negative?: boolean }> = {
  Approved: { positive: true },
  Rejected: { negative: true },
}

// The Pending state has no tag here -- it's rendered inline in
// EntryList.tsx as a plain neutral Tag, mirroring how "awaiting follow-up"
// is already an inline-styled element there rather than a component here.
export function ApprovalTag({ status }: { status: ApprovalStatus }) {
  return <Tag {...APPROVAL_PROPS[status]}>{status}</Tag>
}
