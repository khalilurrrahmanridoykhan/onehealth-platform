// Pure, synchronous logic -- no network calls -- for the AWaRe justification
// rule and the compliance summary computed from a batch of entries. Same
// "stay pure and trivially unit-testable" discipline as
// dhis2-data-quality-auditor/src/lib/qualityChecks.ts.

import type { ApprovalStatus, AwareCategory, DeEscalationOutcome, FormularyEntry, PrescribingEntry } from '../types/stewardship'
import { APPROVAL_STATUSES, DE_ESCALATION_OUTCOMES } from '../types/stewardship'

// occurredAt carries a full timestamp (the moment of prescribing) while
// actualStopDate is DATE-only ("YYYY-MM-DD"); comparing the two as whole
// days can be off by up to a day purely from that truncation even when the
// *true* elapsed course exactly matches the formulary's guideline. This is a
// measurement-precision buffer, not a clinical or operational SLA window --
// deliberately its own constant, not DEFAULT_FOLLOW_UP_GRACE_HOURS (culture
// turnaround) or DEFAULT_APPROVAL_REVIEW_SLA_HOURS (review staffing), both
// of which model a completely different, hour-scale concern.
export const DEFAULT_DURATION_OVERRUN_TOLERANCE_DAYS = 1

function daysBetween(startIsoOrDate: string, endIsoOrDate: string): number {
  const start = new Date(startIsoOrDate.slice(0, 10)).getTime()
  const end = new Date(endIsoOrDate.slice(0, 10)).getTime()
  return Math.round((end - start) / (1000 * 60 * 60 * 24))
}

// WHO AWaRe: Watch and Reserve antibiotics carry a higher resistance-driving
// or last-line risk, so a prescriber choosing one is expected to record why
// (e.g. a positive culture, a documented allergy to the Access-category
// first choice, or an escalation after treatment failure). "Not classified"
// deliberately does NOT require justification -- an admin whose formulary
// hasn't categorized a drug yet shouldn't have every entry blocked by that
// gap; it becomes visible instead as its own slice in the compliance summary.
export function requiresJustification(category: AwareCategory): boolean {
  return category === 'Watch' || category === 'Reserve'
}

// Shared case-insensitive, trimmed lookup -- how this app matches an
// antibiotic name against the formulary, used by both the AWaRe category
// resolver and the typical-duration resolver below.
function findFormularyEntry(formulary: FormularyEntry[], antibioticName: string): FormularyEntry | undefined {
  const needle = antibioticName.trim().toLowerCase()
  return formulary.find((entry) => entry.antibioticName.trim().toLowerCase() === needle)
}

// Falls back to 'Not classified' for a free-text "Other" entry not in the
// formulary, rather than guessing.
export function resolveAwareCategory(formulary: FormularyEntry[], antibioticName: string): AwareCategory {
  return findFormularyEntry(formulary, antibioticName)?.awareCategory ?? 'Not classified'
}

// A formulary row saved before typicalDurationDays existed will have this
// key genuinely `undefined` at runtime despite the type saying
// `number | null` -- read defensively with `??`, same discipline
// FormularyEditor.tsx already applies to `note`.
export function resolveTypicalDurationDays(formulary: FormularyEntry[], antibioticName: string): number | null {
  return findFormularyEntry(formulary, antibioticName)?.typicalDurationDays ?? null
}

export interface ComplianceSummary {
  totalEntries: number
  countByCategory: Record<AwareCategory, number>
  // Entries whose category requires justification but have none recorded.
  // Computed independently of this app's own client-side form validation,
  // so it still catches an entry submitted by any other API client that
  // bypassed that validation -- the same "don't just trust your own UI"
  // stance as RDQA-style quality checks elsewhere in this project.
  missingJustificationCount: number
  topAntibiotics: { name: string; count: number }[]
}

export function computeComplianceSummary(entries: PrescribingEntry[]): ComplianceSummary {
  const countByCategory: Record<AwareCategory, number> = { Access: 0, Watch: 0, Reserve: 0, 'Not classified': 0 }
  const antibioticCounts = new Map<string, number>()
  let missingJustificationCount = 0

  for (const entry of entries) {
    countByCategory[entry.awareCategory]++
    if (requiresJustification(entry.awareCategory) && !entry.justificationNote?.trim()) {
      missingJustificationCount++
    }
    antibioticCounts.set(entry.antibioticName, (antibioticCounts.get(entry.antibioticName) ?? 0) + 1)
  }

  const topAntibiotics = [...antibioticCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return { totalEntries: entries.length, countByCategory, missingJustificationCount, topAntibiotics }
}

// Cultures typically take 48-72h to result, so a same-morning empiric entry
// isn't yet a compliance failure -- it's just too soon to expect a
// follow-up. graceHours is a named, testable parameter (not a hidden
// constant) so the grace window can be tuned or tested at its boundary.
export const DEFAULT_FOLLOW_UP_GRACE_HOURS = 48

function hoursSince(occurredAt: string, now: Date): number {
  return (now.getTime() - new Date(occurredAt).getTime()) / (1000 * 60 * 60)
}

// True only once an empiric entry has gone unreviewed past the grace
// window. Never true for a culture-guided entry (nothing to de-escalate)
// or for one that already has a recorded outcome.
export function isAwaitingFollowUp(entry: PrescribingEntry, now: Date, graceHours = DEFAULT_FOLLOW_UP_GRACE_HOURS): boolean {
  if (entry.empiricOrCultureGuided !== 'Empiric') return false
  if (entry.deEscalationOutcome !== null) return false
  return hoursSince(entry.occurredAt, now) >= graceHours
}

export function selectEntriesNeedingFollowUp(
  entries: PrescribingEntry[],
  now: Date,
  graceHours = DEFAULT_FOLLOW_UP_GRACE_HOURS,
): PrescribingEntry[] {
  return entries.filter((entry) => isAwaitingFollowUp(entry, now, graceHours))
}

export interface FollowUpSummary {
  empiricCount: number
  followUpsRecordedCount: number
  awaitingFollowUpCount: number
  withinGraceCount: number
  // null (not 0) at a zero denominator -- rendering "0%" for a brand-new
  // install with no empiric entries yet reads as total failure; null is
  // meant to render as "--" in the UI instead.
  followUpRate: number | null
  // Denominator is followUpsRecordedCount, not empiricCount: dividing by
  // every empiric entry would blend "nobody reviewed it" (a follow-up
  // problem) with "reviewed and correctly not narrowed" (a clinical
  // judgment) into one uninterpretable number.
  deEscalationRate: number | null
  countByOutcome: Record<DeEscalationOutcome, number>
}

export function computeFollowUpSummary(
  entries: PrescribingEntry[],
  now: Date,
  graceHours = DEFAULT_FOLLOW_UP_GRACE_HOURS,
): FollowUpSummary {
  const empiricEntries = entries.filter((entry) => entry.empiricOrCultureGuided === 'Empiric')
  const countByOutcome = Object.fromEntries(DE_ESCALATION_OUTCOMES.map((outcome) => [outcome, 0])) as Record<
    DeEscalationOutcome,
    number
  >

  let followUpsRecordedCount = 0
  let awaitingFollowUpCount = 0
  let withinGraceCount = 0
  // 'Discontinued' counts as de-escalation alongside 'Narrowed' -- stopping
  // therapy on a negative culture is the strongest possible narrowing.
  // countByOutcome is exposed so this definition can be recomputed
  // differently downstream without touching this function.
  let deEscalatedCount = 0

  for (const entry of empiricEntries) {
    if (entry.deEscalationOutcome !== null) {
      followUpsRecordedCount++
      countByOutcome[entry.deEscalationOutcome]++
      if (entry.deEscalationOutcome === 'Narrowed' || entry.deEscalationOutcome === 'Discontinued') {
        deEscalatedCount++
      }
    } else if (isAwaitingFollowUp(entry, now, graceHours)) {
      awaitingFollowUpCount++
    } else {
      withinGraceCount++
    }
  }

  const empiricCount = empiricEntries.length
  return {
    empiricCount,
    followUpsRecordedCount,
    awaitingFollowUpCount,
    withinGraceCount,
    followUpRate: empiricCount > 0 ? followUpsRecordedCount / empiricCount : null,
    deEscalationRate: followUpsRecordedCount > 0 ? deEscalatedCount / followUpsRecordedCount : null,
    countByOutcome,
  }
}

// An operational SLA for how quickly a steward should review a
// Reserve-category entry -- a workflow/staffing choice, not a clinical or
// biological one, so this is deliberately its own constant rather than
// reusing DEFAULT_FOLLOW_UP_GRACE_HOURS (which models culture turnaround
// time). Anchored at occurredAt, same as the follow-up grace window, but for
// a different reason: unlike a follow-up outcome (which genuinely can't be
// known until culture results are back), a Reserve category is known
// instantly at logging time, so the review-backlog clock starts ticking
// from the moment the entry was logged. 72h (covers a weekend) is a
// reasonable default; tunable per-call like graceHours.
export const DEFAULT_APPROVAL_REVIEW_SLA_HOURS = 72

// True only for a Reserve-category entry with no recorded decision yet.
// Never true for any other AWaRe category, regardless of approvalStatus.
export function isPendingApproval(entry: PrescribingEntry): boolean {
  return entry.awareCategory === 'Reserve' && entry.approvalStatus === null
}

// True only once a still-pending Reserve entry has gone unreviewed past the
// SLA window.
export function isOverduePendingApproval(
  entry: PrescribingEntry,
  now: Date,
  slaHours = DEFAULT_APPROVAL_REVIEW_SLA_HOURS,
): boolean {
  if (!isPendingApproval(entry)) return false
  return hoursSince(entry.occurredAt, now) >= slaHours
}

export function selectEntriesPendingApproval(entries: PrescribingEntry[]): PrescribingEntry[] {
  return entries.filter((entry) => isPendingApproval(entry))
}

export interface ApprovalSummary {
  reserveCount: number
  pendingCount: number
  overduePendingCount: number
  approvedCount: number
  rejectedCount: number
  // decidedCount / reserveCount; null (not 0) at a zero denominator, same
  // "render as --, not 0%" convention as followUpRate/deEscalationRate.
  reviewRate: number | null
  countByStatus: Record<ApprovalStatus, number>
}

export function computeApprovalSummary(
  entries: PrescribingEntry[],
  now: Date,
  slaHours = DEFAULT_APPROVAL_REVIEW_SLA_HOURS,
): ApprovalSummary {
  const reserveEntries = entries.filter((entry) => entry.awareCategory === 'Reserve')
  const countByStatus = Object.fromEntries(APPROVAL_STATUSES.map((status) => [status, 0])) as Record<ApprovalStatus, number>

  let pendingCount = 0
  let overduePendingCount = 0
  let approvedCount = 0
  let rejectedCount = 0

  for (const entry of reserveEntries) {
    if (entry.approvalStatus !== null) {
      countByStatus[entry.approvalStatus]++
      if (entry.approvalStatus === 'Approved') approvedCount++
      else rejectedCount++
    } else {
      pendingCount++
      if (isOverduePendingApproval(entry, now, slaHours)) overduePendingCount++
    }
  }

  const reserveCount = reserveEntries.length
  const decidedCount = approvedCount + rejectedCount
  return {
    reserveCount,
    pendingCount,
    overduePendingCount,
    approvedCount,
    rejectedCount,
    reviewRate: reserveCount > 0 ? decidedCount / reserveCount : null,
    countByStatus,
  }
}

// False for a still-open course (nothing "actual" to compare yet) or one
// whose antibiotic has no typicalDurationDays set (nothing to compare
// against). True only once actual duration exceeds typical + tolerance.
export function isDurationOverrun(
  entry: PrescribingEntry,
  formulary: FormularyEntry[],
  toleranceDays = DEFAULT_DURATION_OVERRUN_TOLERANCE_DAYS,
): boolean {
  if (entry.actualStopDate === null) return false
  const typical = resolveTypicalDurationDays(formulary, entry.antibioticName)
  if (typical === null) return false
  return daysBetween(entry.occurredAt, entry.actualStopDate) > typical + toleranceDays
}

export interface DurationSummary {
  totalEntries: number
  withGuidelineCount: number
  withoutGuidelineCount: number
  completedCount: number
  stillOpenCount: number
  overrunCount: number
  // overrunCount / completedCount; null (not 0) at a zero denominator, same
  // "render as --" convention as followUpRate/deEscalationRate/reviewRate.
  overrunRate: number | null
  // Still-open entries whose elapsed time since occurredAt already exceeds
  // typical+tolerance -- a likely-in-progress overrun, kept distinct from
  // overrunCount (which only counts *confirmed* overruns on a course that's
  // actually been closed out).
  stillOpenPastGuidelineCount: number
}

// Filters by "does a guideline exist," not by an AWaRe/empiric field on the
// entry -- genuinely different from computeFollowUpSummary's empiric-only
// and computeApprovalSummary's Reserve-only filtering, since duration
// tracking applies to any logged entry with a formulary-defined guideline.
export function computeDurationSummary(
  entries: PrescribingEntry[],
  formulary: FormularyEntry[],
  now: Date,
  toleranceDays = DEFAULT_DURATION_OVERRUN_TOLERANCE_DAYS,
): DurationSummary {
  let withGuidelineCount = 0
  let completedCount = 0
  let stillOpenCount = 0
  let overrunCount = 0
  let stillOpenPastGuidelineCount = 0

  for (const entry of entries) {
    const typical = resolveTypicalDurationDays(formulary, entry.antibioticName)
    if (typical === null) continue
    withGuidelineCount++
    if (entry.actualStopDate !== null) {
      completedCount++
      if (isDurationOverrun(entry, formulary, toleranceDays)) overrunCount++
    } else {
      stillOpenCount++
      const elapsedDays = daysBetween(entry.occurredAt, now.toISOString())
      if (elapsedDays > typical + toleranceDays) stillOpenPastGuidelineCount++
    }
  }

  return {
    totalEntries: entries.length,
    withGuidelineCount,
    withoutGuidelineCount: entries.length - withGuidelineCount,
    completedCount,
    stillOpenCount,
    overrunCount,
    overrunRate: completedCount > 0 ? overrunCount / completedCount : null,
    stillOpenPastGuidelineCount,
  }
}
