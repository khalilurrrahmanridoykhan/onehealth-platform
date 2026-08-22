import { buildOverdueNotificationMessage, MAX_ROWS_PER_CATEGORY, selectNewlyOverdueEntries } from './notifications'
import type { FormularyEntry, PrescribingEntry } from '../types/stewardship'

const formulary: FormularyEntry[] = [
  { id: '1', antibioticName: 'Amoxicillin', awareCategory: 'Access', note: null, typicalDurationDays: 7 },
  { id: '2', antibioticName: 'Vancomycin', awareCategory: 'Reserve', note: null, typicalDurationDays: null },
]

function entry(overrides: Partial<PrescribingEntry>): PrescribingEntry {
  return {
    eventId: 'e1',
    orgUnitId: 'ou1',
    orgUnitName: 'Test facility',
    occurredAt: '2026-08-11T00:00:00.000Z',
    // No formulary guideline for this default -- avoids accidentally
    // leaking into the duration-overrun category in tests that aren't
    // about it. Tests that specifically want the duration category
    // override antibioticName to 'Amoxicillin' (typicalDurationDays: 7).
    antibioticName: 'Vancomycin',
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
    actualStopDate: null,
    actualStopNote: null,
    ...overrides,
  }
}

// Fixed reference "now" throughout -- never new Date() -- deterministic
// regardless of when these tests run. DEFAULT_FOLLOW_UP_GRACE_HOURS = 48,
// DEFAULT_APPROVAL_REVIEW_SLA_HOURS = 72.
const NOW = new Date('2026-08-13T00:00:00.000Z')

describe('selectNewlyOverdueEntries', () => {
  test('excludes an entry that crossed its threshold before the cursor -- already notified last time', () => {
    // Crossed at 2026-08-11T00:00:00Z + 48h = 2026-08-13T00:00:00Z... use an
    // entry that crossed well before an early cursor.
    const oldCrossing = entry({
      empiricOrCultureGuided: 'Empiric',
      occurredAt: '2026-08-01T00:00:00.000Z', // crosses 48h grace at 2026-08-03
    })
    const cursor = '2026-08-10T00:00:00.000Z' // well after the crossing
    const items = selectNewlyOverdueEntries([oldCrossing], formulary, cursor, NOW)
    expect(items).toEqual([])
  })

  test('excludes an entry whose crossing time is after now -- not yet actually overdue', () => {
    const notYetOverdue = entry({
      empiricOrCultureGuided: 'Empiric',
      occurredAt: '2026-08-12T12:00:00.000Z', // crosses 48h grace at 2026-08-14T12:00, after NOW
    })
    const items = selectNewlyOverdueEntries([notYetOverdue], formulary, '2026-08-01T00:00:00.000Z', NOW)
    expect(items).toEqual([])
  })

  test('excludes an entry that crossed in-window but has since been resolved', () => {
    const resolved = entry({
      empiricOrCultureGuided: 'Empiric',
      occurredAt: '2026-08-01T00:00:00.000Z',
      deEscalationOutcome: 'Narrowed', // resolved before this check ran
    })
    const items = selectNewlyOverdueEntries([resolved], formulary, '2026-07-01T00:00:00.000Z', NOW)
    expect(items).toEqual([])
  })

  test('includes a follow-up entry that crossed in-window and still qualifies', () => {
    const overdue = entry({
      eventId: 'followup1',
      empiricOrCultureGuided: 'Empiric',
      occurredAt: '2026-08-01T00:00:00.000Z', // crosses 48h grace at 2026-08-03
    })
    const items = selectNewlyOverdueEntries([overdue], formulary, '2026-07-01T00:00:00.000Z', NOW)
    expect(items).toHaveLength(1)
    expect(items[0].entry.eventId).toBe('followup1')
    expect(items[0].category).toBe('Awaiting follow-up')
    expect(items[0].crossedAt).toBe('2026-08-03T00:00:00.000Z')
  })

  test('includes a pending-approval entry that crossed in-window and still qualifies', () => {
    const overdue = entry({
      eventId: 'approval1',
      awareCategory: 'Reserve',
      empiricOrCultureGuided: 'Culture-guided', // isolate from the follow-up category
      occurredAt: '2026-08-01T00:00:00.000Z', // crosses 72h SLA at 2026-08-04
    })
    const items = selectNewlyOverdueEntries([overdue], formulary, '2026-07-01T00:00:00.000Z', NOW)
    expect(items).toHaveLength(1)
    expect(items[0].category).toBe('Pending-approval overdue')
  })

  test('includes a duration overrun-while-open entry that crossed in-window and still qualifies', () => {
    const overdue = entry({
      eventId: 'duration1',
      antibioticName: 'Amoxicillin', // typicalDurationDays = 7, tolerance = 1
      empiricOrCultureGuided: 'Culture-guided', // isolate from the follow-up category
      occurredAt: '2026-08-01T00:00:00.000Z',
      actualStopDate: null,
    })
    const items = selectNewlyOverdueEntries([overdue], formulary, '2026-07-01T00:00:00.000Z', NOW)
    expect(items).toHaveLength(1)
    expect(items[0].category).toBe('Duration overrun (still open)')
  })

  test('one entry qualifying for two categories at once produces two separate items', () => {
    const dual = entry({
      eventId: 'dual1',
      empiricOrCultureGuided: 'Empiric',
      awareCategory: 'Reserve',
      antibioticName: 'Vancomycin', // no guideline set, so no duration category
      occurredAt: '2026-08-01T00:00:00.000Z',
    })
    const items = selectNewlyOverdueEntries([dual], formulary, '2026-07-01T00:00:00.000Z', NOW)
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.category).sort()).toEqual(['Awaiting follow-up', 'Pending-approval overdue'].sort())
  })

  test('combines all three categories across a mixed entry list', () => {
    const followUp = entry({ eventId: 'a', empiricOrCultureGuided: 'Empiric', occurredAt: '2026-08-01T00:00:00.000Z' })
    const approval = entry({
      eventId: 'b',
      awareCategory: 'Reserve',
      empiricOrCultureGuided: 'Culture-guided',
      occurredAt: '2026-08-01T00:00:00.000Z',
    })
    const duration = entry({
      eventId: 'c',
      antibioticName: 'Amoxicillin',
      empiricOrCultureGuided: 'Culture-guided',
      occurredAt: '2026-08-01T00:00:00.000Z',
      actualStopDate: null,
    })
    const items = selectNewlyOverdueEntries([followUp, approval, duration], formulary, '2026-07-01T00:00:00.000Z', NOW)
    expect(items).toHaveLength(3)
  })
})

describe('buildOverdueNotificationMessage', () => {
  const followUpItem = { entry: entry({ antibioticName: 'A' }), category: 'Awaiting follow-up' as const, crossedAt: '2026-08-03T00:00:00.000Z' }
  const approvalItem = {
    entry: entry({ antibioticName: 'B' }),
    category: 'Pending-approval overdue' as const,
    crossedAt: '2026-08-04T00:00:00.000Z',
  }

  test('subject uses singular wording for exactly 1 item', () => {
    const digest = buildOverdueNotificationMessage([followUpItem])
    expect(digest.subject).toBe('AMR Stewardship Log: 1 entry newly overdue')
  })

  test('subject uses plural wording for more than 1 item', () => {
    const digest = buildOverdueNotificationMessage([followUpItem, approvalItem])
    expect(digest.subject).toBe('AMR Stewardship Log: 2 entries newly overdue')
  })

  test('groups items into fixed category order, only including categories present', () => {
    const digest = buildOverdueNotificationMessage([approvalItem, followUpItem])
    const followUpIndex = digest.text.indexOf('Awaiting follow-up')
    const approvalIndex = digest.text.indexOf('Pending-approval overdue')
    expect(followUpIndex).toBeGreaterThanOrEqual(0)
    expect(approvalIndex).toBeGreaterThanOrEqual(0)
    expect(followUpIndex).toBeLessThan(approvalIndex)
    expect(digest.text).not.toContain('Duration overrun')
  })

  test('caps each category at MAX_ROWS_PER_CATEGORY with an "and N more" line', () => {
    expect(MAX_ROWS_PER_CATEGORY).toBe(10)
    const manyItems = Array.from({ length: 13 }, (_, i) => ({
      entry: entry({ eventId: `e${i}`, antibioticName: `Drug ${i}` }),
      category: 'Awaiting follow-up' as const,
      crossedAt: '2026-08-03T00:00:00.000Z',
    }))
    const digest = buildOverdueNotificationMessage(manyItems)
    expect(digest.text).toContain('...and 3 more not shown')
    expect(digest.text).toContain('Awaiting follow-up (13):')
  })

  test('output is deterministic -- depends only on the passed-in items, not on the current time', () => {
    const a = buildOverdueNotificationMessage([followUpItem, approvalItem])
    const b = buildOverdueNotificationMessage([followUpItem, approvalItem])
    expect(a).toEqual(b)
  })
})
