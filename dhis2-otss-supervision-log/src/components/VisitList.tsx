import type { SupervisionVisit } from '../types/otss'

interface Props {
  visits: SupervisionVisit[]
}

export function VisitList({ visits }: Props) {
  if (visits.length === 0) {
    return <div style={{ fontSize: 13, color: '#6e7a89' }}>No visits yet.</div>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e0e0e0' }}>
            <th style={{ padding: '6px 12px 6px 0' }}>Date</th>
            <th style={{ padding: '6px 12px' }}>Facility</th>
            <th style={{ padding: '6px 12px' }}>Cadre</th>
            <th style={{ padding: '6px 12px' }}>Completeness</th>
            <th style={{ padding: '6px 12px' }}>Competency</th>
            <th style={{ padding: '6px 12px' }}>Follow-up</th>
            <th style={{ padding: '6px 12px' }}>Entered by</th>
          </tr>
        </thead>
        <tbody>
          {visits.map((visit) => (
            <tr key={visit.eventId} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '6px 12px 6px 0' }}>{visit.occurredAt.slice(0, 10)}</td>
              <td style={{ padding: '6px 12px' }}>{visit.orgUnitName}</td>
              <td style={{ padding: '6px 12px' }}>{visit.cadreObserved}</td>
              <td style={{ padding: '6px 12px' }}>{visit.completenessPercent === null ? '--' : `${visit.completenessPercent}%`}</td>
              <td style={{ padding: '6px 12px' }}>{visit.competencyPercent === null ? '--' : `${visit.competencyPercent}%`}</td>
              <td style={{ padding: '6px 12px' }}>{visit.followUpDate ?? '--'}</td>
              <td style={{ padding: '6px 12px' }}>{visit.enteredBy ?? '--'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
