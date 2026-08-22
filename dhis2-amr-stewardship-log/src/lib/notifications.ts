// Pure, synchronous selection and message-formatting logic for the
// overdue-notifications feature -- no network calls (the actual
// POST /api/messageConversations call and the cursor-advance save live in
// hooks/useOverdueNotifications.ts). Kept separate from awareRules.ts
// (clinical/compliance rules) and provisioning.ts (Tracker mechanics) --
// this is a third concern, messaging-digest selection/formatting, not a new
// AWaRe rule.

import {
  DEFAULT_APPROVAL_REVIEW_SLA_HOURS,
  DEFAULT_DURATION_OVERRUN_TOLERANCE_DAYS,
  DEFAULT_FOLLOW_UP_GRACE_HOURS,
  isAwaitingFollowUp,
  isDurationOverrunStillOpen,
  isOverduePendingApproval,
  resolveTypicalDurationDays,
} from './awareRules'
import type { FormularyEntry, PrescribingEntry } from '../types/stewardship'

export type OverdueCategory = 'Awaiting follow-up' | 'Pending-approval overdue' | 'Duration overrun (still open)'

// Fixed order, not discovery order -- deterministic output, same "fixed
// category array" convention ComplianceSummary.tsx already uses for AWaRe
// categories.
const CATEGORY_ORDER: OverdueCategory[] = ['Awaiting follow-up', 'Pending-approval overdue', 'Duration overrun (still open)']

export interface OverdueNotificationItem {
  entry: PrescribingEntry
  category: OverdueCategory
  // ISO timestamp of the moment this entry crossed its overdue threshold
  // (not "now") -- day-granular for the duration category (matches
  // isDurationOverrunStillOpen's own date-only truncation), hour-granular
  // for the other two.
  crossedAt: string
}

function addHoursIso(occurredAt: string, hours: number): string {
  return new Date(new Date(occurredAt).getTime() + hours * 60 * 60 * 1000).toISOString()
}

// First day on which elapsed-days-since-occurredAt exceeds thresholdDays --
// i.e. thresholdDays + 1 whole days after occurredAt's own date, truncated
// the same way isDurationOverrunStillOpen already truncates. Deliberately
// day-granular, not sub-day precise -- matches the existing tolerance-buffer
// reasoning already documented on DEFAULT_DURATION_OVERRUN_TOLERANCE_DAYS.
function firstOverrunDayIso(occurredAt: string, thresholdDays: number): string {
  const d = new Date(occurredAt.slice(0, 10))
  d.setUTCDate(d.getUTCDate() + thresholdDays + 1)
  return d.toISOString()
}

export interface OverdueThresholds {
  graceHours?: number
  slaHours?: number
  toleranceDays?: number
}

// cursor is a required, non-nullable string -- deliberately NOT
// `string | null`. Whether a null/absent cursor means "notify about
// everything" or "notify about nothing" is a first-run UX policy decision
// (see useOverdueNotifications.ts's seeding step), not something this pure
// selection function should silently decide per-entry inside its own loop.
// Forcing callers to resolve a real cursor first keeps this function total
// and its tests unambiguous.
export function selectNewlyOverdueEntries(
  entries: PrescribingEntry[],
  formulary: FormularyEntry[],
  cursor: string,
  now: Date,
  thresholds: OverdueThresholds = {},
): OverdueNotificationItem[] {
  const graceHours = thresholds.graceHours ?? DEFAULT_FOLLOW_UP_GRACE_HOURS
  const slaHours = thresholds.slaHours ?? DEFAULT_APPROVAL_REVIEW_SLA_HOURS
  const toleranceDays = thresholds.toleranceDays ?? DEFAULT_DURATION_OVERRUN_TOLERANCE_DAYS
  const cursorTime = new Date(cursor).getTime()
  const nowTime = now.getTime()
  const items: OverdueNotificationItem[] = []

  const inWindow = (crossedAtIso: string) => {
    const t = new Date(crossedAtIso).getTime()
    return t > cursorTime && t <= nowTime
  }

  for (const entry of entries) {
    // Each branch requires the entry to STILL currently satisfy its overdue
    // predicate (checked first, at `now`) -- not just have crossed the
    // threshold timestamp at some point. An entry that crossed and was then
    // resolved before this check runs has nothing to alert about.
    if (isAwaitingFollowUp(entry, now, graceHours)) {
      const crossedAt = addHoursIso(entry.occurredAt, graceHours)
      if (inWindow(crossedAt)) items.push({ entry, category: 'Awaiting follow-up', crossedAt })
    }
    if (isOverduePendingApproval(entry, now, slaHours)) {
      const crossedAt = addHoursIso(entry.occurredAt, slaHours)
      if (inWindow(crossedAt)) items.push({ entry, category: 'Pending-approval overdue', crossedAt })
    }
    if (isDurationOverrunStillOpen(entry, formulary, now, toleranceDays)) {
      const typical = resolveTypicalDurationDays(formulary, entry.antibioticName)
      if (typical === null) continue // unreachable in practice -- the predicate above already requires a non-null guideline
      const crossedAt = firstOverrunDayIso(entry.occurredAt, typical + toleranceDays)
      if (inWindow(crossedAt)) items.push({ entry, category: 'Duration overrun (still open)', crossedAt })
    }
  }
  return items
}

export interface OverdueDigest {
  subject: string
  text: string
}

// A defensible cap, not a full dump -- a digest listing hundreds of rows is
// useless and undermines the "one useful notification" goal. Per-category,
// not a single global cap, so a large follow-up backlog doesn't crowd out a
// single urgent duration-overrun row.
export const MAX_ROWS_PER_CATEGORY = 10

export function buildOverdueNotificationMessage(items: OverdueNotificationItem[], appName = 'AMR Stewardship Log'): OverdueDigest {
  const byCategory = new Map<OverdueCategory, OverdueNotificationItem[]>()
  for (const item of items) {
    const list = byCategory.get(item.category) ?? []
    list.push(item)
    byCategory.set(item.category, list)
  }

  const subject = `${appName}: ${items.length} ${items.length === 1 ? 'entry' : 'entries'} newly overdue`

  const sections = CATEGORY_ORDER.filter((category) => byCategory.has(category)).map((category) => {
    const rows = byCategory.get(category)!
    const shown = rows.slice(0, MAX_ROWS_PER_CATEGORY)
    const lines = shown.map(
      (item) => `- ${item.entry.antibioticName} - ${item.entry.orgUnitName} - overdue since ${item.crossedAt.slice(0, 10)}`,
    )
    const remaining = rows.length - shown.length
    if (remaining > 0) lines.push(`  ...and ${remaining} more not shown`)
    return `${category} (${rows.length}):\n${lines.join('\n')}`
  })

  return { subject, text: sections.join('\n\n') }
}
