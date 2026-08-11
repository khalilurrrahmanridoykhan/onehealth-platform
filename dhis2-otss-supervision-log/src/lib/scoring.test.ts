import { computeCompleteness, computeCompetency, computeVisitScoreSummary, isModuleValid } from './scoring'
import type { ChecklistItem, ChecklistResponse, VisitChecklistData } from '../types/otss'

function response(overrides: Partial<ChecklistResponse>): ChecklistResponse {
  return { itemId: 'i1', moduleType: 'Clinical', status: 'Yes', note: null, ...overrides }
}

describe('isModuleValid', () => {
  test('an Observation module with zero responses is invalid', () => {
    expect(isModuleValid('Clinical', [], null, 5)).toBe(false)
  })

  test('an Observation module with at least one non-N/A response is valid', () => {
    const responses = [response({ moduleType: 'Clinical', status: 'Yes' })]
    expect(isModuleValid('Clinical', responses, null, 5)).toBe(true)
  })

  test('an Observation module with only N/A responses is invalid -- matches the paper\'s "needs >=1 complete observation" rule', () => {
    const responses = [response({ moduleType: 'Clinical', status: 'N/A' })]
    expect(isModuleValid('Clinical', responses, null, 5)).toBe(false)
  })

  test('a RegisterReview module is invalid below the required sample size', () => {
    const responses = [response({ moduleType: 'RegisterReview', status: 'Yes' })]
    expect(isModuleValid('RegisterReview', responses, 3, 5)).toBe(false)
  })

  test('a RegisterReview module is valid at or above the required sample size', () => {
    const responses = [response({ moduleType: 'RegisterReview', status: 'Yes' })]
    expect(isModuleValid('RegisterReview', responses, 5, 5)).toBe(true)
    expect(isModuleValid('RegisterReview', responses, 10, 5)).toBe(true)
  })

  test('a RegisterReview module with no recordsReviewed value is invalid', () => {
    const responses = [response({ moduleType: 'RegisterReview', status: 'Yes' })]
    expect(isModuleValid('RegisterReview', responses, null, 5)).toBe(false)
  })
})

const checklist: ChecklistItem[] = [
  { id: 'c1', moduleType: 'Clinical', label: 'Checked temperature' },
  { id: 'rdt1', moduleType: 'RDT', label: 'RDT performed correctly' },
  { id: 'rr1', moduleType: 'RegisterReview', label: 'Correct antimalarial prescribed' },
]

describe('computeCompleteness', () => {
  test('returns null when no modules are configured at all', () => {
    expect(computeCompleteness([], { responses: [], registerReviewRecordsReviewed: null }, 5)).toBeNull()
  })

  test('a fully-answered visit across all 3 configured modules is 100% complete', () => {
    const data: VisitChecklistData = {
      responses: [
        response({ itemId: 'c1', moduleType: 'Clinical', status: 'Yes' }),
        response({ itemId: 'rdt1', moduleType: 'RDT', status: 'Yes' }),
        response({ itemId: 'rr1', moduleType: 'RegisterReview', status: 'Yes' }),
      ],
      registerReviewRecordsReviewed: 5,
    }
    expect(computeCompleteness(checklist, data, 5)).toBe(100)
  })

  test('a visit that skips the RDT module and under-samples the register review is 33% complete (1 of 3 valid)', () => {
    const data: VisitChecklistData = {
      responses: [
        response({ itemId: 'c1', moduleType: 'Clinical', status: 'Yes' }),
        response({ itemId: 'rr1', moduleType: 'RegisterReview', status: 'Yes' }),
      ],
      registerReviewRecordsReviewed: 2,
    }
    expect(computeCompleteness(checklist, data, 5)).toBe(33)
  })

  test('an entirely empty visit against 3 configured modules is 0% complete, not null', () => {
    const data: VisitChecklistData = { responses: [], registerReviewRecordsReviewed: null }
    expect(computeCompleteness(checklist, data, 5)).toBe(0)
  })
})

describe('computeCompetency', () => {
  test('returns null when there is nothing scorable', () => {
    const data: VisitChecklistData = { responses: [], registerReviewRecordsReviewed: null }
    expect(computeCompetency(checklist, data, 5)).toBeNull()
  })

  test('only counts responses from modules that met their own validity rule', () => {
    const data: VisitChecklistData = {
      responses: [
        response({ itemId: 'c1', moduleType: 'Clinical', status: 'No' }), // valid module (>=1 non-N/A)
        response({ itemId: 'rr1', moduleType: 'RegisterReview', status: 'Yes' }), // invalid module (under-sampled)
      ],
      registerReviewRecordsReviewed: 1,
    }
    // Only the Clinical 'No' counts -- RegisterReview's 'Yes' is excluded
    // because that module didn't meet its own sample-size validity rule.
    expect(computeCompetency(checklist, data, 5)).toBe(0)
  })

  test('N/A responses are excluded from the denominator entirely', () => {
    const data: VisitChecklistData = {
      responses: [
        response({ itemId: 'c1', moduleType: 'Clinical', status: 'Yes' }),
        response({ itemId: 'c1', moduleType: 'Clinical', status: 'N/A' }),
      ],
      registerReviewRecordsReviewed: null,
    }
    expect(computeCompetency(checklist, data, 5)).toBe(100)
  })
})

describe('computeVisitScoreSummary', () => {
  const asOf = new Date('2026-08-11T00:00:00.000Z')

  test('averages completeness and competency across visits, ignoring nulls', () => {
    const summary = computeVisitScoreSummary(
      [
        { completenessPercent: 100, competencyPercent: 80, followUpDate: null, occurredAt: '2026-08-01', orgUnitId: 'ou1', checklist: { responses: [], registerReviewRecordsReviewed: null } },
        { completenessPercent: 50, competencyPercent: null, followUpDate: null, occurredAt: '2026-08-02', orgUnitId: 'ou1', checklist: { responses: [], registerReviewRecordsReviewed: null } },
      ],
      asOf,
    )
    expect(summary.averageCompleteness).toBe(75)
    expect(summary.averageCompetency).toBe(80)
  })

  test('flags visits with a follow-up date in the past as overdue', () => {
    const summary = computeVisitScoreSummary(
      [
        { completenessPercent: 100, competencyPercent: 100, followUpDate: '2026-01-01', occurredAt: '2026-01-01', orgUnitId: 'ou1', checklist: { responses: [], registerReviewRecordsReviewed: null } },
        { completenessPercent: 100, competencyPercent: 100, followUpDate: '2027-01-01', occurredAt: '2026-01-01', orgUnitId: 'ou1', checklist: { responses: [], registerReviewRecordsReviewed: null } },
        { completenessPercent: 100, competencyPercent: 100, followUpDate: null, occurredAt: '2026-01-01', orgUnitId: 'ou1', checklist: { responses: [], registerReviewRecordsReviewed: null } },
      ],
      asOf,
    )
    expect(summary.overdueFollowUpCount).toBe(1)
  })

  test('ranks problem items by No/Partial frequency across all visits, excluding N/A', () => {
    const summary = computeVisitScoreSummary(
      [
        {
          completenessPercent: 100,
          competencyPercent: 100,
          followUpDate: null,
          occurredAt: '2026-08-01',
          orgUnitId: 'ou1',
          checklist: {
            responses: [
              response({ itemId: 'c1', status: 'No' }),
              response({ itemId: 'c2', status: 'Yes' }),
            ],
            registerReviewRecordsReviewed: null,
          },
        },
        {
          completenessPercent: 100,
          competencyPercent: 100,
          followUpDate: null,
          occurredAt: '2026-08-02',
          orgUnitId: 'ou1',
          checklist: {
            responses: [
              response({ itemId: 'c1', status: 'Partial' }),
              response({ itemId: 'c2', status: 'N/A' }),
            ],
            registerReviewRecordsReviewed: null,
          },
        },
      ],
      asOf,
    )
    expect(summary.problemItems[0]).toEqual({ itemId: 'c1', moduleType: 'Clinical', noOrPartialCount: 2, totalScored: 2 })
    expect(summary.problemItems.find((p) => p.itemId === 'c2')).toBeUndefined()
  })
})
