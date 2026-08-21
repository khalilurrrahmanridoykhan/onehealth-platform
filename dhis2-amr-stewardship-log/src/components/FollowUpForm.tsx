import { Button, InputField, NoticeBox, Radio, TextAreaField } from '@dhis2/ui'
import { useState } from 'react'
import { useSubmitFollowUp } from '../hooks/useSubmitFollowUp'
import { DE_ESCALATION_OUTCOMES, type DeEscalationOutcome, type FollowUpCapableProgram, type PrescribingEntry } from '../types/stewardship'
import { AwareTag } from './StatusTag'

interface Props {
  entry: PrescribingEntry
  provisioned: FollowUpCapableProgram
  onSubmitted: () => void
  onCancel: () => void
}

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10)
}

// Reuses PrescribingForm.tsx's exact vocabulary and structure (Radio group,
// InputField/TextAreaField, validate()/handleSubmit(), NoticeBox + loading
// Button) so a reviewer sees a consistent form, not a bolted-on one-off.
export function FollowUpForm({ entry, provisioned, onSubmitted, onCancel }: Props) {
  const [outcome, setOutcome] = useState<DeEscalationOutcome | null>(null)
  const [reviewDate, setReviewDate] = useState(todayDateOnly())
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const { submitting, error, submitFollowUp } = useSubmitFollowUp()

  const prescribedDate = entry.occurredAt.slice(0, 10)

  function validate(): string | null {
    if (!outcome) return 'Select what happened after culture results came back.'
    if (!reviewDate) return 'Enter the review date.'
    if (reviewDate < prescribedDate) return 'Review date cannot be before the prescribing date.'
    return null
  }

  async function handleSubmit() {
    const validationError = validate()
    if (validationError) {
      setFormError(validationError)
      return
    }
    setFormError(null)

    const ok = await submitFollowUp(provisioned, entry.eventId, {
      deEscalationOutcome: outcome!,
      deEscalationDate: reviewDate,
      deEscalationNote: note.trim() || null,
    })

    if (ok) onSubmitted()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560, border: '1px solid #e0e0e0', borderRadius: 4, padding: 16 }}>
      <div>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>Record follow-up</div>
        <div style={{ fontSize: 13, color: '#6e7a89', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>{entry.antibioticName}</strong>
          <AwareTag category={entry.awareCategory} />
          <span>{entry.indication}</span>
          <span>-- prescribed {prescribedDate}</span>
        </div>
      </div>

      {formError && (
        <NoticeBox error title="Could not record this follow-up">
          {formError}
        </NoticeBox>
      )}
      {error && (
        <NoticeBox error title="DHIS2 rejected this follow-up">
          {error}
        </NoticeBox>
      )}

      <div>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>What happened once culture results were known?</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DE_ESCALATION_OUTCOMES.map((value) => (
            <Radio key={value} label={value} checked={outcome === value} onChange={() => setOutcome(value)} />
          ))}
        </div>
      </div>

      <InputField
        label="Review date"
        type="date"
        required
        value={reviewDate}
        onChange={({ value }) => setReviewDate(value ?? '')}
      />

      <TextAreaField label="Note" rows={3} value={note} onChange={({ value }) => setNote(value ?? '')} helpText="Optional." />

      <div style={{ display: 'flex', gap: 8 }}>
        <Button primary onClick={handleSubmit} loading={submitting}>
          Save follow-up
        </Button>
        <Button onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
