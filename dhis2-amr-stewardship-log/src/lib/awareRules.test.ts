import {
  computeApprovalSummary,
  computeComplianceSummary,
  computeFollowUpSummary,
  DEFAULT_APPROVAL_REVIEW_SLA_HOURS,
  DEFAULT_FOLLOW_UP_GRACE_HOURS,
  isAwaitingFollowUp,
  isOverduePendingApproval,
  isPendingApproval,
  requiresJustification,
  resolveAwareCategory,
  selectEntriesNeedingFollowUp,
  selectEntriesPendingApproval,
} from './awareRules'
import type { FormularyEntry, PrescribingEntry } from '../types/stewardship'

describe('requiresJustification', () => {
  test('Watch and Reserve require justification', () => {
    expect(requiresJustification('Watch')).toBe(true)
    expect(requiresJustification('Reserve')).toBe(true)
  })

  test('Access and Not classified do not require justification', () => {
    expect(requiresJustification('Access')).toBe(false)
    expect(requiresJustification('Not classified')).toBe(false)
  })
})

const formulary: FormularyEntry[] = [
  { id: '1', antibioticName: 'Amoxicillin', awareCategory: 'Access', note: null },
  { id: '2', antibioticName: 'Ceftriaxone', awareCategory: 'Watch', note: null },
  { id: '3', antibioticName: 'Vancomycin', awareCategory: 'Reserve', note: null },
]

describe('resolveAwareCategory', () => {
  test('matches a formulary entry case-insensitively and trimmed', () => {
    expect(resolveAwareCategory(formulary, '  amoxicillin ')).toBe('Access')
    expect(resolveAwareCategory(formulary, 'CEFTRIAXONE')).toBe('Watch')
  })

  test('falls back to Not classified for an antibiotic not in the formulary -- the free-text "Other" path', () => {
    expect(resolveAwareCategory(formulary, 'Some brand-new drug')).toBe('Not classified')
  })
})

function entry(overrides: Partial<PrescribingEntry>): PrescribingEntry {
  return {
    eventId: 'e1',
    orgUnitId: 'ou1',
    orgUnitName: 'Test facility',
    occurredAt: '2026-08-11T00:00:00.000',
    antibioticName: 'Amoxicillin',
    awareCategory: 'Access',
    indication: 'UTI',
    empiricOrCultureGuided: 'Empiric',
    justificationNote: null,
    enteredBy: 'tester',
    deEscalationOutcome: null,
    deEscalationDate: null,
    deEscalationNote: null,
    approvalStatus: null,
    approvalReviewedBy: null,
    approvalDate: null,
    approvalNote: null,
    ...overrides,
  }
}

describe('computeComplianceSummary', () => {
  test('counts entries per AWaRe category', () => {
    const summary = computeComplianceSummary([
      entry({ awareCategory: 'Access' }),
      entry({ awareCategory: 'Access' }),
      entry({ awareCategory: 'Watch', justificationNote: 'positive culture' }),
      entry({ awareCategory: 'Reserve', justificationNote: 'MDR confirmed' }),
    ])
    expect(summary.totalEntries).toBe(4)
    expect(summary.countByCategory.Access).toBe(2)
    expect(summary.countByCategory.Watch).toBe(1)
    expect(summary.countByCategory.Reserve).toBe(1)
    expect(summary.countByCategory['Not classified']).toBe(0)
  })

  test('flags a Watch/Reserve entry missing a justification note, even though this app\'s own form would have blocked it', () => {
    const summary = computeComplianceSummary([
      entry({ awareCategory: 'Watch', justificationNote: null }),
      entry({ awareCategory: 'Reserve', justificationNote: '   ' }),
      entry({ awareCategory: 'Access', justificationNote: null }),
    ])
    expect(summary.missingJustificationCount).toBe(2)
  })

  test('ranks the top prescribed antibiotics by count, descending', () => {
    const summary = computeComplianceSummary([
      entry({ antibioticName: 'Amoxicillin' }),
      entry({ antibioticName: 'Amoxicillin' }),
      entry({ antibioticName: 'Amoxicillin' }),
      entry({ antibioticName: 'Ceftriaxone' }),
      entry({ antibioticName: 'Ceftriaxone' }),
      entry({ antibioticName: 'Vancomycin' }),
    ])
    expect(summary.topAntibiotics[0]).toEqual({ name: 'Amoxicillin', count: 3 })
    expect(summary.topAntibiotics[1]).toEqual({ name: 'Ceftriaxone', count: 2 })
    expect(summary.topAntibiotics[2]).toEqual({ name: 'Vancomycin', count: 1 })
  })

  test('an empty entry list produces a zeroed summary, not an error', () => {
    const summary = computeComplianceSummary([])
    expect(summary.totalEntries).toBe(0)
    expect(summary.missingJustificationCount).toBe(0)
    expect(summary.topAntibiotics).toEqual([])
  })

  test('output is unaffected by follow-up fields -- computeComplianceSummary predates and stays independent of the follow-up feature', () => {
    const summary = computeComplianceSummary([
      entry({ awareCategory: 'Access', deEscalationOutcome: 'Narrowed', deEscalationDate: '2026-08-13', deEscalationNote: 'note' }),
    ])
    expect(summary.totalEntries).toBe(1)
    expect(summary.countByCategory.Access).toBe(1)
  })
})

// Fixed reference "now" throughout -- never new Date() -- so these tests are
// deterministic regardless of when they run.
const NOW = new Date('2026-08-13T00:00:00.000Z')

describe('isAwaitingFollowUp', () => {
  test('false for a culture-guided entry -- nothing to de-escalate', () => {
    expect(isAwaitingFollowUp(entry({ empiricOrCultureGuided: 'Culture-guided', occurredAt: '2026-08-01T00:00:00.000Z' }), NOW)).toBe(
      false,
    )
  })

  test('false once an outcome has been recorded, no matter how old the entry', () => {
    expect(
      isAwaitingFollowUp(
        entry({ empiricOrCultureGuided: 'Empiric', occurredAt: '2026-08-01T00:00:00.000Z', deEscalationOutcome: 'Narrowed' }),
        NOW,
      ),
    ).toBe(false)
  })

  test('grace-window boundary: exactly at the default 48h is awaiting, just under is not', () => {
    expect(DEFAULT_FOLLOW_UP_GRACE_HOURS).toBe(48)
    const exactlyAtGrace = entry({ empiricOrCultureGuided: 'Empiric', occurredAt: '2026-08-11T00:00:00.000Z' })
    const justUnderGrace = entry({ empiricOrCultureGuided: 'Empiric', occurredAt: '2026-08-11T01:00:00.000Z' })
    expect(isAwaitingFollowUp(exactlyAtGrace, NOW)).toBe(true)
    expect(isAwaitingFollowUp(justUnderGrace, NOW)).toBe(false)
  })

  test('a custom graceHours parameter is honored', () => {
    const sixHoursOld = entry({ empiricOrCultureGuided: 'Empiric', occurredAt: '2026-08-12T18:00:00.000Z' })
    expect(isAwaitingFollowUp(sixHoursOld, NOW, 4)).toBe(true)
    expect(isAwaitingFollowUp(sixHoursOld, NOW, 8)).toBe(false)
  })
})

describe('selectEntriesNeedingFollowUp', () => {
  test('returns only the entries past the grace window with no recorded outcome', () => {
    const overdue = entry({ eventId: 'overdue', empiricOrCultureGuided: 'Empiric', occurredAt: '2026-08-01T00:00:00.000Z' })
    const fresh = entry({ eventId: 'fresh', empiricOrCultureGuided: 'Empiric', occurredAt: '2026-08-12T23:00:00.000Z' })
    const cultureGuided = entry({ eventId: 'cg', empiricOrCultureGuided: 'Culture-guided', occurredAt: '2026-08-01T00:00:00.000Z' })
    const selected = selectEntriesNeedingFollowUp([overdue, fresh, cultureGuided], NOW)
    expect(selected.map((e) => e.eventId)).toEqual(['overdue'])
  })
})

describe('computeFollowUpSummary', () => {
  test('culture-guided entries are excluded from every denominator', () => {
    const summary = computeFollowUpSummary(
      [entry({ empiricOrCultureGuided: 'Culture-guided', occurredAt: '2026-08-01T00:00:00.000Z' })],
      NOW,
    )
    expect(summary.empiricCount).toBe(0)
    expect(summary.followUpRate).toBeNull()
    expect(summary.deEscalationRate).toBeNull()
  })

  test('both rates are null (not 0) at a zero denominator', () => {
    const summary = computeFollowUpSummary([], NOW)
    expect(summary.empiricCount).toBe(0)
    expect(summary.followUpRate).toBeNull()
    expect(summary.deEscalationRate).toBeNull()
  })

  test('rate arithmetic: followUpRate over all empiric entries, deEscalationRate over recorded follow-ups only', () => {
    const summary = computeFollowUpSummary(
      [
        entry({ empiricOrCultureGuided: 'Empiric', occurredAt: '2026-08-01T00:00:00.000Z', deEscalationOutcome: 'Narrowed' }),
        entry({
          empiricOrCultureGuided: 'Empiric',
          occurredAt: '2026-08-01T00:00:00.000Z',
          deEscalationOutcome: 'Continued (confirmed appropriate)',
        }),
        entry({ empiricOrCultureGuided: 'Empiric', occurredAt: '2026-08-01T00:00:00.000Z' }), // no outcome, overdue
      ],
      NOW,
    )
    expect(summary.empiricCount).toBe(3)
    expect(summary.followUpsRecordedCount).toBe(2)
    expect(summary.followUpRate).toBeCloseTo(2 / 3)
    expect(summary.deEscalationRate).toBeCloseTo(1 / 2)
    expect(summary.awaitingFollowUpCount).toBe(1)
  })

  test("'Discontinued' counts as de-escalation alongside 'Narrowed'", () => {
    const summary = computeFollowUpSummary(
      [
        entry({ empiricOrCultureGuided: 'Empiric', occurredAt: '2026-08-01T00:00:00.000Z', deEscalationOutcome: 'Discontinued' }),
        entry({ empiricOrCultureGuided: 'Empiric', occurredAt: '2026-08-01T00:00:00.000Z', deEscalationOutcome: 'Broadened' }),
      ],
      NOW,
    )
    expect(summary.deEscalationRate).toBeCloseTo(1 / 2)
    expect(summary.countByOutcome.Discontinued).toBe(1)
    expect(summary.countByOutcome.Broadened).toBe(1)
  })

  test('an entry still within the grace window is neither awaiting nor recorded', () => {
    const summary = computeFollowUpSummary(
      [entry({ empiricOrCultureGuided: 'Empiric', occurredAt: '2026-08-12T23:00:00.000Z' })],
      NOW,
    )
    expect(summary.awaitingFollowUpCount).toBe(0)
    expect(summary.withinGraceCount).toBe(1)
    expect(summary.followUpsRecordedCount).toBe(0)
  })
})

describe('isPendingApproval', () => {
  test('true only for a Reserve entry with no recorded decision', () => {
    expect(isPendingApproval(entry({ awareCategory: 'Reserve', approvalStatus: null }))).toBe(true)
  })

  test('false for a decided Reserve entry', () => {
    expect(isPendingApproval(entry({ awareCategory: 'Reserve', approvalStatus: 'Approved' }))).toBe(false)
    expect(isPendingApproval(entry({ awareCategory: 'Reserve', approvalStatus: 'Rejected' }))).toBe(false)
  })

  test('false for any non-Reserve category, regardless of approvalStatus', () => {
    expect(isPendingApproval(entry({ awareCategory: 'Watch', approvalStatus: null }))).toBe(false)
    expect(isPendingApproval(entry({ awareCategory: 'Access', approvalStatus: null }))).toBe(false)
    expect(isPendingApproval(entry({ awareCategory: 'Not classified', approvalStatus: null }))).toBe(false)
  })
})

describe('isOverduePendingApproval', () => {
  test('SLA boundary: exactly at the default 72h is overdue, just under is not', () => {
    expect(DEFAULT_APPROVAL_REVIEW_SLA_HOURS).toBe(72)
    const exactlyAtSla = entry({ awareCategory: 'Reserve', occurredAt: '2026-08-10T00:00:00.000Z' })
    const justUnderSla = entry({ awareCategory: 'Reserve', occurredAt: '2026-08-10T01:00:00.000Z' })
    expect(isOverduePendingApproval(exactlyAtSla, NOW)).toBe(true)
    expect(isOverduePendingApproval(justUnderSla, NOW)).toBe(false)
  })

  test('false for a decided entry no matter how old', () => {
    const old = entry({ awareCategory: 'Reserve', occurredAt: '2026-08-01T00:00:00.000Z', approvalStatus: 'Approved' })
    expect(isOverduePendingApproval(old, NOW)).toBe(false)
  })

  test('a custom slaHours parameter is honored', () => {
    const sixHoursOld = entry({ awareCategory: 'Reserve', occurredAt: '2026-08-12T18:00:00.000Z' })
    expect(isOverduePendingApproval(sixHoursOld, NOW, 4)).toBe(true)
    expect(isOverduePendingApproval(sixHoursOld, NOW, 8)).toBe(false)
  })
})

describe('selectEntriesPendingApproval', () => {
  test('returns only Reserve entries with no recorded decision', () => {
    const pending = entry({ eventId: 'pending', awareCategory: 'Reserve', approvalStatus: null })
    const decided = entry({ eventId: 'decided', awareCategory: 'Reserve', approvalStatus: 'Approved' })
    const notReserve = entry({ eventId: 'nr', awareCategory: 'Watch', approvalStatus: null })
    const selected = selectEntriesPendingApproval([pending, decided, notReserve])
    expect(selected.map((e) => e.eventId)).toEqual(['pending'])
  })
})

describe('computeApprovalSummary', () => {
  test('both reviewRate at a zero denominator is null, not 0', () => {
    const summary = computeApprovalSummary([], NOW)
    expect(summary.reserveCount).toBe(0)
    expect(summary.reviewRate).toBeNull()
  })

  test('non-Reserve entries are excluded from every denominator', () => {
    const summary = computeApprovalSummary([entry({ awareCategory: 'Watch', approvalStatus: null })], NOW)
    expect(summary.reserveCount).toBe(0)
    expect(summary.reviewRate).toBeNull()
  })

  test('rate arithmetic: reviewRate is decided / reserve', () => {
    const summary = computeApprovalSummary(
      [
        entry({ awareCategory: 'Reserve', approvalStatus: 'Approved' }),
        entry({ awareCategory: 'Reserve', approvalStatus: 'Rejected' }),
        entry({ awareCategory: 'Reserve', approvalStatus: null, occurredAt: '2026-08-01T00:00:00.000Z' }),
      ],
      NOW,
    )
    expect(summary.reserveCount).toBe(3)
    expect(summary.approvedCount).toBe(1)
    expect(summary.rejectedCount).toBe(1)
    expect(summary.pendingCount).toBe(1)
    expect(summary.reviewRate).toBeCloseTo(2 / 3)
    expect(summary.overduePendingCount).toBe(1)
  })

  test('countByStatus tallies each decided status', () => {
    const summary = computeApprovalSummary(
      [
        entry({ awareCategory: 'Reserve', approvalStatus: 'Approved' }),
        entry({ awareCategory: 'Reserve', approvalStatus: 'Approved' }),
        entry({ awareCategory: 'Reserve', approvalStatus: 'Rejected' }),
      ],
      NOW,
    )
    expect(summary.countByStatus.Approved).toBe(2)
    expect(summary.countByStatus.Rejected).toBe(1)
  })

  test('a pending entry still within the SLA window is neither overdue nor decided', () => {
    const summary = computeApprovalSummary(
      [entry({ awareCategory: 'Reserve', approvalStatus: null, occurredAt: '2026-08-12T23:00:00.000Z' })],
      NOW,
    )
    expect(summary.pendingCount).toBe(1)
    expect(summary.overduePendingCount).toBe(0)
  })
})

describe('follow-up and approval features are independent', () => {
  test('an entry with both a recorded follow-up outcome and a pending approval produces correct, non-interfering numbers in each summary', () => {
    const entries = [
      entry({
        awareCategory: 'Reserve',
        empiricOrCultureGuided: 'Empiric',
        deEscalationOutcome: 'Narrowed',
        deEscalationDate: '2026-08-12',
        approvalStatus: null,
        occurredAt: '2026-08-01T00:00:00.000Z',
      }),
    ]
    const followUp = computeFollowUpSummary(entries, NOW)
    const approval = computeApprovalSummary(entries, NOW)

    expect(followUp.empiricCount).toBe(1)
    expect(followUp.followUpsRecordedCount).toBe(1)
    expect(followUp.followUpRate).toBeCloseTo(1)

    expect(approval.reserveCount).toBe(1)
    expect(approval.pendingCount).toBe(1)
    expect(approval.overduePendingCount).toBe(1)
    expect(approval.reviewRate).toBeCloseTo(0)
  })
})
