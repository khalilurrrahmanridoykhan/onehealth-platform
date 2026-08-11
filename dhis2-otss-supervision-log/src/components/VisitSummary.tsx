import { useMemo } from 'react'
import { computeVisitScoreSummary } from '../lib/scoring'
import { MODULE_LABELS } from '../types/otss'
import type { ChecklistItem, SupervisionVisit } from '../types/otss'

interface Props {
  visits: SupervisionVisit[]
  checklist: ChecklistItem[]
}

// Client-computed, not a generated DHIS2 Dashboard -- same reasoning as
// every sibling app's own summary view: event-analytics tables need a
// generation cycle this app can't rely on existing on a fresh install.
// Completeness and competency are shown as genuinely separate numbers,
// matching the source paper's own two-pronged evaluation rather than a
// single conflated score.
export function VisitSummary({ visits, checklist }: Props) {
  const itemLabelById = useMemo(() => new Map(checklist.map((item) => [item.id, item.label])), [checklist])
  const summary = useMemo(() => computeVisitScoreSummary(visits.map((v) => ({
    completenessPercent: v.completenessPercent,
    competencyPercent: v.competencyPercent,
    followUpDate: v.followUpDate,
    occurredAt: v.occurredAt,
    orgUnitId: v.orgUnitId,
    checklist: v.checklist,
  }))), [visits])

  if (summary.visitCount === 0) {
    return <div style={{ fontSize: 13, color: '#6e7a89' }}>No visits logged yet for the configured org units.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <SummaryCard label="Visits logged" value={String(summary.visitCount)} />
        <SummaryCard label="Avg. completeness" value={summary.averageCompleteness === null ? '--' : `${summary.averageCompleteness}%`} />
        <SummaryCard label="Avg. competency" value={summary.averageCompetency === null ? '--' : `${summary.averageCompetency}%`} />
        <SummaryCard label="Overdue follow-ups" value={String(summary.overdueFollowUpCount)} warn={summary.overdueFollowUpCount > 0} />
      </div>

      {summary.problemItems.length > 0 && (
        <div>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>Most frequent No/Partial items</div>
          <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {summary.problemItems.map((row) => (
                <tr key={row.itemId}>
                  <td style={{ padding: '4px 16px 4px 0' }}>{itemLabelById.get(row.itemId) ?? '(removed item)'}</td>
                  <td style={{ padding: '4px 16px 4px 0', color: '#6e7a89' }}>{MODULE_LABELS[row.moduleType]}</td>
                  <td style={{ padding: '4px 0' }}>{row.noOrPartialCount} of {row.totalScored}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div
      style={{
        border: '1px solid #e0e0e0',
        borderRadius: 4,
        padding: '10px 16px',
        minWidth: 140,
        ...(warn ? { borderColor: '#c22a2a', background: '#fdf3f3' } : {}),
      }}
    >
      <div style={{ fontSize: 12, color: '#6e7a89' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500 }}>{value}</div>
    </div>
  )
}
