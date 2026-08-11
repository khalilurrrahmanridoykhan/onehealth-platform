import type { PrescribingEntry } from '../types/stewardship'
import { AwareTag } from './StatusTag'

interface Props {
  entries: PrescribingEntry[]
}

export function EntryList({ entries }: Props) {
  if (entries.length === 0) {
    return <div style={{ fontSize: 13, color: '#6e7a89' }}>No entries yet.</div>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>
            <th style={{ padding: '6px 12px 6px 0' }}>Date</th>
            <th style={{ padding: '6px 12px' }}>Org unit</th>
            <th style={{ padding: '6px 12px' }}>Antibiotic</th>
            <th style={{ padding: '6px 12px' }}>AWaRe</th>
            <th style={{ padding: '6px 12px' }}>Indication</th>
            <th style={{ padding: '6px 12px' }}>Mode</th>
            <th style={{ padding: '6px 12px' }}>Justification</th>
            <th style={{ padding: '6px 12px' }}>Entered by</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.eventId} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '6px 12px 6px 0' }}>{entry.occurredAt.slice(0, 10)}</td>
              <td style={{ padding: '6px 12px' }}>{entry.orgUnitName}</td>
              <td style={{ padding: '6px 12px' }}>{entry.antibioticName}</td>
              <td style={{ padding: '6px 12px' }}>
                <AwareTag category={entry.awareCategory} />
              </td>
              <td style={{ padding: '6px 12px' }}>{entry.indication}</td>
              <td style={{ padding: '6px 12px' }}>{entry.empiricOrCultureGuided ?? '--'}</td>
              <td style={{ padding: '6px 12px', color: entry.justificationNote ? undefined : '#c22a2a' }}>
                {entry.justificationNote ?? (entry.awareCategory === 'Watch' || entry.awareCategory === 'Reserve' ? 'Missing' : '--')}
              </td>
              <td style={{ padding: '6px 12px' }}>{entry.enteredBy ?? '--'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
