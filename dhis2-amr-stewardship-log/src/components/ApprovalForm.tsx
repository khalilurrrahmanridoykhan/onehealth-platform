import { Button, InputField, NoticeBox, Radio, TextAreaField } from '@dhis2/ui'
import { useState } from 'react'
import { useSubmitApproval } from '../hooks/useSubmitApproval'
import { APPROVAL_STATUSES, type ApprovalCapableProgram, type ApprovalStatus, type PrescribingEntry } from '../types/stewardship'
import { AwareTag } from './StatusTag'

interface Props {
  entry: PrescribingEntry
  provisioned: ApprovalCapableProgram
  reviewerUsername: string
  onSubmitted: () => void
  onCancel: () => void
}

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10)
}

// Mirrors FollowUpForm.tsx's structure exactly so a reviewer sees a
// consistent form, not a bolted-on one-off.
export function ApprovalForm({ entry, provisioned, reviewerUsername, onSubmitted, onCancel }: Props) {
  const [status, setStatus] = useState<ApprovalStatus | null>(null)
  const [decisionDate, setDecisionDate] = useState(todayDateOnly())
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const { submitting, error, submitApproval } = useSubmitApproval()

  const prescribedDate = entry.occurredAt.slice(0, 10)

  function validate(): string | null {
    if (!status) return 'Select Approved or Rejected.'
    if (!decisionDate) return 'Enter the review date.'
    if (decisionDate < prescribedDate) return 'Review date cannot be before the prescribing date.'
    return null
  }

  async function handleSubmit() {
    const validationError = validate()
    if (validationError) {
      setFormError(validationError)
      return
    }
    setFormError(null)

    const ok = await submitApproval(provisioned, entry.eventId, {
      approvalStatus: status!,
      approvalReviewedBy: reviewerUsername,
      approvalDate: decisionDate,
      approvalNote: note.trim() || null,
    })

    if (ok) onSubmitted()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560, border: '1px solid #e0e0e0', borderRadius: 4, padding: 16 }}>
      <div>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>Review restricted-antibiotic prescription</div>
        <div style={{ fontSize: 13, color: '#6e7a89', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong>{entry.antibioticName}</strong>
          <AwareTag category={entry.awareCategory} />
          <span>{entry.indication}</span>
          <span>-- prescribed {prescribedDate}</span>
        </div>
        {entry.justificationNote && (
          <div style={{ fontSize: 13, color: '#6e7a89', marginTop: 4 }}>Justification: {entry.justificationNote}</div>
        )}
      </div>

      {formError && (
        <NoticeBox error title="Could not record this decision">
          {formError}
        </NoticeBox>
      )}
      {error && (
        <NoticeBox error title="DHIS2 rejected this decision">
          {error}
        </NoticeBox>
      )}

      <div>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>Decision</div>
        <div style={{ display: 'flex', gap: 24 }}>
          {APPROVAL_STATUSES.map((value) => (
            <Radio key={value} label={value} checked={status === value} onChange={() => setStatus(value)} />
          ))}
        </div>
      </div>

      <InputField
        label="Review date"
        type="date"
        required
        value={decisionDate}
        onChange={({ value }) => setDecisionDate(value ?? '')}
      />

      <TextAreaField label="Note" rows={3} value={note} onChange={({ value }) => setNote(value ?? '')} helpText="Optional." />

      <div style={{ display: 'flex', gap: 8 }}>
        <Button primary onClick={handleSubmit} loading={submitting}>
          Save decision
        </Button>
        <Button onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
