// Pure, synchronous logic -- no network calls -- for the AWaRe justification
// rule and the compliance summary computed from a batch of entries. Same
// "stay pure and trivially unit-testable" discipline as
// dhis2-data-quality-auditor/src/lib/qualityChecks.ts.

import type { AwareCategory, FormularyEntry, PrescribingEntry } from '../types/stewardship'

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

// Case-insensitive, trimmed match against the admin's own formulary. Falls
// back to 'Not classified' for a free-text "Other" entry not in the
// formulary, rather than guessing.
export function resolveAwareCategory(formulary: FormularyEntry[], antibioticName: string): AwareCategory {
  const needle = antibioticName.trim().toLowerCase()
  const match = formulary.find((entry) => entry.antibioticName.trim().toLowerCase() === needle)
  return match?.awareCategory ?? 'Not classified'
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
