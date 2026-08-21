import { Button, Checkbox } from '@dhis2/ui'
import { useMemo, useState } from 'react'
import { isAwaitingFollowUp } from '../lib/awareRules'
import { supportsFollowUp, type PrescribingEntry, type ProvisionedProgram } from '../types/stewardship'
import { AwareTag, OutcomeTag } from './StatusTag'

interface Props {
  entries: PrescribingEntry[]
  provisioned: ProvisionedProgram | null
  selectedEventId: string | null
  onSelectEntry: (eventId: string) => void
}

export function EntryList({ entries, provisioned, selectedEventId, onSelectEntry }: Props) {
  const [awaitingOnly, setAwaitingOnly] = useState(false)
  const now = useMemo(() => new Date(), [entries])
  const showFollowUpColumn = provisioned !== null && supportsFollowUp(provisioned)

  const visibleEntries = useMemo(() => {
    if (!awaitingOnly) return entries
    return entries.filter((entry) => isAwaitingFollowUp(entry, now))
  }, [entries, awaitingOnly, now])

  if (entries.length === 0) {
    return <div style={{ fontSize: 13, color: '#6e7a89' }}>No entries yet.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {showFollowUpColumn && (
        <Checkbox
          label="Awaiting follow-up only"
          checked={awaitingOnly}
          onChange={({ checked }) => setAwaitingOnly(checked)}
        />
      )}
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
              {showFollowUpColumn && <th style={{ padding: '6px 12px' }}>Follow-up</th>}
              <th style={{ padding: '6px 12px' }}>Entered by</th>
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry) => {
              const awaiting = isAwaitingFollowUp(entry, now)
              return (
                <tr
                  key={entry.eventId}
                  style={{ borderBottom: '1px solid #f0f0f0', background: entry.eventId === selectedEventId ? '#f0f9ff' : undefined }}
                >
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
                  {showFollowUpColumn && (
                    <td style={{ padding: '6px 12px', color: awaiting ? '#c22a2a' : undefined }}>
                      {entry.empiricOrCultureGuided !== 'Empiric' ? (
                        '--'
                      ) : entry.deEscalationOutcome ? (
                        <OutcomeTag outcome={entry.deEscalationOutcome} />
                      ) : (
                        <Button small secondary={!awaiting} destructive={awaiting} onClick={() => onSelectEntry(entry.eventId)}>
                          {awaiting ? 'Awaiting follow-up' : 'Record follow-up'}
                        </Button>
                      )}
                    </td>
                  )}
                  <td style={{ padding: '6px 12px' }}>{entry.enteredBy ?? '--'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
