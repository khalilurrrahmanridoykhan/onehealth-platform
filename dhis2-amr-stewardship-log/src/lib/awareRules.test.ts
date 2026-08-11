import { computeComplianceSummary, requiresJustification, resolveAwareCategory } from './awareRules'
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
})
