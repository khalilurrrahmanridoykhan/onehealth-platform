// Pure, synchronous scoring logic -- no network calls -- implementing the
// paper's own two-pronged evaluation (Burnett et al. 2019, PMC6447118):
// completeness (were the applicable modules actually filled in, gated by
// each module's own validity rule) and competency (within only the modules
// that met that validity rule, what fraction of checklist items passed).
// Same "stay pure and trivially unit-testable" discipline as every sibling
// app's own qualityChecks.ts / awareRules.ts.

import { MODULE_KIND, MODULE_TYPES, type ChecklistItem, type ChecklistResponse, type ModuleType, type VisitChecklistData } from '../types/otss'

// A module counts as complete/valid using the paper's own rule for its
// kind: an Observation (or General) module needs at least one non-N/A
// response; a RegisterReview module needs the supervisor to have reviewed
// at least the admin-configured minimum sample of records.
export function isModuleValid(
  moduleType: ModuleType,
  responses: ChecklistResponse[],
  registerReviewRecordsReviewed: number | null,
  requiredSample: number,
): boolean {
  const kind = MODULE_KIND[moduleType]
  const moduleResponses = responses.filter((r) => r.moduleType === moduleType)
  if (moduleResponses.length === 0) return false

  if (kind === 'RegisterReview') {
    return (registerReviewRecordsReviewed ?? 0) >= requiredSample
  }
  return moduleResponses.some((r) => r.status !== 'N/A')
}

function applicableModules(checklistItems: ChecklistItem[]): ModuleType[] {
  return MODULE_TYPES.filter((mt) => checklistItems.some((item) => item.moduleType === mt))
}

// Percent of applicable modules (per the admin's current checklist config)
// that were validly completed at this visit. Null if no modules are
// configured at all -- there's nothing to be complete against.
export function computeCompleteness(
  checklistItems: ChecklistItem[],
  data: VisitChecklistData,
  requiredSample: number,
): number | null {
  const applicable = applicableModules(checklistItems)
  if (applicable.length === 0) return null
  const validCount = applicable.filter((mt) => isModuleValid(mt, data.responses, data.registerReviewRecordsReviewed, requiredSample)).length
  return Math.round((validCount / applicable.length) * 100)
}

// Percent 'Yes' among non-N/A responses, counted ONLY within modules that
// met their own validity rule -- an incomplete module's partial answers
// don't get to inflate or deflate the competency score, matching the
// paper's own methodology of scoring only valid observations.
export function computeCompetency(
  checklistItems: ChecklistItem[],
  data: VisitChecklistData,
  requiredSample: number,
): number | null {
  const applicable = applicableModules(checklistItems)
  const validModules = new Set(
    applicable.filter((mt) => isModuleValid(mt, data.responses, data.registerReviewRecordsReviewed, requiredSample)),
  )
  const scorable = data.responses.filter((r) => validModules.has(r.moduleType) && r.status !== 'N/A')
  if (scorable.length === 0) return null
  const yesCount = scorable.filter((r) => r.status === 'Yes').length
  return Math.round((yesCount / scorable.length) * 100)
}

export interface VisitSummaryInput {
  completenessPercent: number | null
  competencyPercent: number | null
  followUpDate: string | null
  occurredAt: string
  orgUnitId: string
  checklist: VisitChecklistData
}

export interface ProblemItem {
  itemId: string
  moduleType: ModuleType
  noOrPartialCount: number
  totalScored: number
}

export interface VisitScoreSummary {
  visitCount: number
  averageCompleteness: number | null
  averageCompetency: number | null
  overdueFollowUpCount: number
  problemItems: ProblemItem[]
}

// Aggregates already-computed per-visit scores (read back from Tracker, not
// recomputed against today's checklist config -- each visit's own stored
// score reflects the checklist as it was configured at that time) plus a
// cross-visit breakdown of which specific items most often score No/Partial.
export function computeVisitScoreSummary(visits: VisitSummaryInput[], asOf: Date = new Date()): VisitScoreSummary {
  const completenessValues = visits.map((v) => v.completenessPercent).filter((v): v is number => v !== null)
  const competencyValues = visits.map((v) => v.competencyPercent).filter((v): v is number => v !== null)

  const overdueFollowUpCount = visits.filter((v) => {
    if (!v.followUpDate) return false
    return new Date(v.followUpDate).getTime() < asOf.getTime()
  }).length

  const itemCounts = new Map<string, { moduleType: ModuleType; noOrPartial: number; total: number }>()
  for (const visit of visits) {
    for (const response of visit.checklist.responses) {
      if (response.status === 'N/A') continue
      const key = response.itemId
      const entry = itemCounts.get(key) ?? { moduleType: response.moduleType, noOrPartial: 0, total: 0 }
      entry.total++
      if (response.status === 'No' || response.status === 'Partial') entry.noOrPartial++
      itemCounts.set(key, entry)
    }
  }
  const problemItems: ProblemItem[] = [...itemCounts.entries()]
    .map(([itemId, v]) => ({ itemId, moduleType: v.moduleType, noOrPartialCount: v.noOrPartial, totalScored: v.total }))
    .filter((p) => p.noOrPartialCount > 0)
    .sort((a, b) => b.noOrPartialCount - a.noOrPartialCount)
    .slice(0, 5)

  return {
    visitCount: visits.length,
    averageCompleteness: completenessValues.length > 0 ? Math.round(completenessValues.reduce((a, b) => a + b, 0) / completenessValues.length) : null,
    averageCompetency: competencyValues.length > 0 ? Math.round(competencyValues.reduce((a, b) => a + b, 0) / competencyValues.length) : null,
    overdueFollowUpCount,
    problemItems,
  }
}
