import { Button, InputField, NoticeBox, SegmentedControl, SimpleSingleSelectField, TextAreaField } from '@dhis2/ui'
import { useMemo, useState } from 'react'
import { useSubmitVisit } from '../hooks/useSubmitVisit'
import { computeCompleteness, computeCompetency } from '../lib/scoring'
import { MODULE_LABELS, MODULE_TYPES, type ChecklistItemStatus, type ChecklistResponse, type ModuleType, type OtssSettings } from '../types/otss'

const STATUS_OPTIONS: { label: string; value: ChecklistItemStatus }[] = [
  { label: 'Yes', value: 'Yes' },
  { label: 'Partial', value: 'Partial' },
  { label: 'No', value: 'No' },
  { label: 'N/A', value: 'N/A' },
]

interface Props {
  settings: OtssSettings
  onSubmitted: () => void
}

function todayIso(): string {
  return new Date().toISOString()
}

// The point-of-care checklist itself, structured as 5 fixed OTSS module
// sections (see ChecklistEditor.tsx for why). Ungated in this app's UI --
// same "DHIS2's own org-unit capture scope is the real boundary" stance as
// every sibling app.
export function VisitForm({ settings, onSubmitted }: Props) {
  const [orgUnitId, setOrgUnitId] = useState<string | null>(settings.orgUnits[0]?.id ?? null)
  const [cadreObserved, setCadreObserved] = useState('')
  const [statuses, setStatuses] = useState<Record<string, ChecklistItemStatus>>({})
  const [recordsReviewed, setRecordsReviewed] = useState('')
  const [gapsIdentified, setGapsIdentified] = useState('')
  const [actionPlan, setActionPlan] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const { submitting, error, submitVisit } = useSubmitVisit()

  const itemsByModule = useMemo(() => {
    const map = new Map<ModuleType, typeof settings.checklist>()
    for (const mt of MODULE_TYPES) map.set(mt, settings.checklist.filter((item) => item.moduleType === mt))
    return map
  }, [settings.checklist])

  const responses: ChecklistResponse[] = useMemo(
    () =>
      settings.checklist.map((item) => ({
        itemId: item.id,
        moduleType: item.moduleType,
        status: statuses[item.id] ?? 'N/A',
        note: null,
      })),
    [settings.checklist, statuses],
  )

  const checklistData = useMemo(
    () => ({ responses, registerReviewRecordsReviewed: recordsReviewed ? Number(recordsReviewed) : null }),
    [responses, recordsReviewed],
  )

  const completenessPercent = useMemo(
    () => computeCompleteness(settings.checklist, checklistData, settings.registerReviewRequiredSample),
    [settings.checklist, checklistData, settings.registerReviewRequiredSample],
  )
  const competencyPercent = useMemo(
    () => computeCompetency(settings.checklist, checklistData, settings.registerReviewRequiredSample),
    [settings.checklist, checklistData, settings.registerReviewRequiredSample],
  )

  function validate(): string | null {
    if (!orgUnitId) return 'Select an org unit.'
    if (!cadreObserved.trim()) return 'Enter the cadre observed.'
    return null
  }

  async function handleSubmit() {
    const validationError = validate()
    if (validationError) {
      setFormError(validationError)
      return
    }
    setFormError(null)
    setSuccess(false)

    if (!settings.provisioned) {
      setFormError('This checklist has not been configured yet. Ask an admin to open "Configure" first.')
      return
    }

    const eventId = await submitVisit(settings.provisioned, orgUnitId!, todayIso(), {
      cadreObserved: cadreObserved.trim(),
      checklist: checklistData,
      completenessPercent,
      competencyPercent,
      gapsIdentified: gapsIdentified.trim() || null,
      actionPlan: actionPlan.trim() || null,
      followUpDate: followUpDate || null,
    })

    if (eventId) {
      setSuccess(true)
      setCadreObserved('')
      setStatuses({})
      setRecordsReviewed('')
      setGapsIdentified('')
      setActionPlan('')
      setFollowUpDate('')
      onSubmitted()
    }
  }

  if (!settings.provisioned || settings.orgUnits.length === 0) {
    return (
      <NoticeBox title="Not configured yet">
        An admin needs to open "Configure" and save a checklist and at least one org unit before visits can be logged.
      </NoticeBox>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
      {formError && (
        <NoticeBox error title="Could not log this visit">
          {formError}
        </NoticeBox>
      )}
      {error && (
        <NoticeBox error title="DHIS2 rejected this visit">
          {error}
        </NoticeBox>
      )}
      {success && <NoticeBox valid title="Visit logged" />}

      <SimpleSingleSelectField
        name="orgUnit"
        label="Org unit (facility)"
        required
        options={settings.orgUnits.map((ou) => ({ label: ou.name, value: ou.id }))}
        value={orgUnitId ?? ''}
        onChange={(value) => setOrgUnitId(value)}
      />

      <InputField label="Cadre observed" required placeholder="e.g. Nurse, Community Health Worker" value={cadreObserved} onChange={({ value }) => setCadreObserved(value ?? '')} />

      {MODULE_TYPES.map((moduleType) => {
        const items = itemsByModule.get(moduleType) ?? []
        if (items.length === 0) return null
        return (
          <div key={moduleType} style={{ borderTop: '1px solid #e0e0e0', paddingTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>{MODULE_LABELS[moduleType]}</div>

            {moduleType === 'RegisterReview' && (
              <div style={{ marginBottom: 14, maxWidth: 280 }}>
                <InputField
                  label="Records reviewed this visit"
                  type="number"
                  dense
                  value={recordsReviewed}
                  onChange={({ value }) => setRecordsReviewed(value ?? '')}
                  helpText={`Needs at least ${settings.registerReviewRequiredSample} to count as complete.`}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {items.map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 14 }}>{item.label}</div>
                  <SegmentedControl
                    options={STATUS_OPTIONS}
                    selected={statuses[item.id] ?? 'N/A'}
                    onChange={({ value }) => setStatuses((prev) => ({ ...prev, [item.id]: value as ChecklistItemStatus }))}
                  />
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 16, fontSize: 13, color: '#6e7a89' }}>
        Completeness: <strong>{completenessPercent === null ? '--' : `${completenessPercent}%`}</strong> &nbsp;&middot;&nbsp; Competency: <strong>{competencyPercent === null ? '--' : `${competencyPercent}%`}</strong>
      </div>

      <TextAreaField label="Gaps identified" rows={2} value={gapsIdentified} onChange={({ value }) => setGapsIdentified(value ?? '')} />
      <TextAreaField label="Action plan" rows={2} value={actionPlan} onChange={({ value }) => setActionPlan(value ?? '')} />
      <InputField label="Follow-up date" type="date" value={followUpDate} onChange={({ value }) => setFollowUpDate(value ?? '')} />

      <div>
        <Button primary onClick={handleSubmit} loading={submitting}>
          Log visit
        </Button>
      </div>
    </div>
  )
}
