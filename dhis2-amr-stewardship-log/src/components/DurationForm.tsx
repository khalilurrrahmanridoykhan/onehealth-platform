import { Button, InputField, NoticeBox, TextAreaField } from '@dhis2/ui'
import { useState } from 'react'
import { useSubmitDuration } from '../hooks/useSubmitDuration'
import { resolveTypicalDurationDays } from '../lib/awareRules'
import type { DurationCapableProgram, FormularyEntry, PrescribingEntry } from '../types/stewardship'
import { AwareTag } from './StatusTag'

interface Props {
  entry: PrescribingEntry
  provisioned: DurationCapableProgram
  formulary: FormularyEntry[]
  onSubmitted: () => void
  onCancel: () => void
}

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10)
}

// Lighter than FollowUpForm.tsx/ApprovalForm.tsx -- no enum Radio group,
// just a date and an optional note. Rendered ungated (no canReview-style
// check anywhere): recording when a course ended is a factual clinical
// observation available to anyone.
export function DurationForm({ entry, provisioned, formulary, onSubmitted, onCancel }: Props) {
  const [stopDate, setStopDate] = useState(todayDateOnly())
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const { submitting, error, submitDuration } = useSubmitDuration()

  const prescribedDate = entry.occurredAt.slice(0, 10)
  const typicalDurationDays = resolveTypicalDurationDays(formulary, entry.antibioticName)

  function validate(): string | null {
    if (!stopDate) return 'Enter the stop date.'
    if (stopDate < prescribedDate) return 'Stop date cannot be before the prescribing date.'
    return null
  }

  async function handleSubmit() {
    const validationError = validate()
    if (validationError) {
      setFormError(validationError)
      return
    }
    setFormError(null)

    const ok = await submitDuration(provisioned, entry.eventId, {
      actualStopDate: stopDate,
      actualStopNote: note.trim() || null,
    })

    if (ok) onSubmitted()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560, border: '1px solid #e0e0e0', borderRadius: 4, padding: 16 }}>
      <div>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>Record when this course ended</div>
        <div style={{ fontSize: 13, color: '#6e7a89', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>{entry.antibioticName}</strong>
          <AwareTag category={entry.awareCategory} />
          <span>{entry.indication}</span>
          <span>-- prescribed {prescribedDate}</span>
        </div>
        {typicalDurationDays !== null && (
          <div style={{ fontSize: 13, color: '#6e7a89', marginTop: 4 }}>Typical duration for this antibiotic: {typicalDurationDays} days</div>
        )}
      </div>

      {formError && (
        <NoticeBox error title="Could not record this stop date">
          {formError}
        </NoticeBox>
      )}
      {error && (
        <NoticeBox error title="DHIS2 rejected this update">
          {error}
        </NoticeBox>
      )}

      <InputField
        label="Actual stop date"
        type="date"
        required
        value={stopDate}
        onChange={({ value }) => setStopDate(value ?? '')}
      />

      <TextAreaField label="Note" rows={3} value={note} onChange={({ value }) => setNote(value ?? '')} helpText="Optional." />

      <div style={{ display: 'flex', gap: 8 }}>
        <Button primary onClick={handleSubmit} loading={submitting}>
          Save stop date
        </Button>
        <Button onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
