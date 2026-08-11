import { useMemo } from 'react'
import { computeComplianceSummary } from '../lib/awareRules'
import type { PrescribingEntry } from '../types/stewardship'

interface Props {
  entries: PrescribingEntry[]
}

// Client-computed, not a generated DHIS2 Dashboard/Visualization -- event
// analytics tables need a generation cycle this app can't rely on existing
// on a fresh install, so this recomputes directly from the same queried
// events EntryList renders, the same technique qualityChecks.ts already
// uses for its own coverage/quality numbers.
export function ComplianceSummary({ entries }: Props) {
  const summary = useMemo(() => computeComplianceSummary(entries), [entries])

  if (summary.totalEntries === 0) {
    return <div style={{ fontSize: 13, color: '#6e7a89' }}>No entries logged yet for the configured org units.</div>
  }

  const categories: (keyof typeof summary.countByCategory)[] = ['Access', 'Watch', 'Reserve', 'Not classified']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <SummaryCard label="Total entries" value={String(summary.totalEntries)} />
        {categories.map((category) => (
          <SummaryCard
            key={category}
            label={category}
            value={`${summary.countByCategory[category]} (${Math.round((summary.countByCategory[category] / summary.totalEntries) * 100)}%)`}
          />
        ))}
        <SummaryCard
          label="Missing justification"
          value={String(summary.missingJustificationCount)}
          warn={summary.missingJustificationCount > 0}
        />
      </div>

      {summary.topAntibiotics.length > 0 && (
        <div>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>Most-prescribed antibiotics</div>
          <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {summary.topAntibiotics.map((row) => (
                <tr key={row.name}>
                  <td style={{ padding: '4px 16px 4px 0' }}>{row.name}</td>
                  <td style={{ padding: '4px 0', color: '#6e7a89' }}>{row.count}</td>
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
