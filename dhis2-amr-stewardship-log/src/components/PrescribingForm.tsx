import { Button, InputField, NoticeBox, Radio, SimpleSingleSelectField, TextAreaField } from '@dhis2/ui'
import { useMemo, useState } from 'react'
import { requiresJustification, resolveAwareCategory } from '../lib/awareRules'
import { useSubmitEntry } from '../hooks/useSubmitEntry'
import type { EmpiricOrCultureGuided, StewardshipSettings } from '../types/stewardship'

const OTHER_ANTIBIOTIC = '__other__'

interface Props {
  settings: StewardshipSettings
  onSubmitted: () => void
}

function todayIso(): string {
  return new Date().toISOString()
}

// The point-of-care checklist. Deliberately ungated in this app's own UI --
// DHIS2's own org-unit capture-scope check on POST /api/tracker is the real,
// server-enforced boundary on who can log an entry for which facility (see
// README). Any authenticated user sees this form; the server decides.
export function PrescribingForm({ settings, onSubmitted }: Props) {
  const [orgUnitId, setOrgUnitId] = useState<string | null>(settings.orgUnits[0]?.id ?? null)
  const [antibioticChoice, setAntibioticChoice] = useState<string>('')
  const [otherAntibiotic, setOtherAntibiotic] = useState('')
  const [indication, setIndication] = useState('')
  const [mode, setMode] = useState<EmpiricOrCultureGuided>('Empiric')
  const [justificationNote, setJustificationNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const { submitting, error, submitEntry } = useSubmitEntry()

  const antibioticName = antibioticChoice === OTHER_ANTIBIOTIC ? otherAntibiotic.trim() : antibioticChoice
  const awareCategory = useMemo(
    () => resolveAwareCategory(settings.formulary, antibioticName),
    [settings.formulary, antibioticName],
  )
  const needsJustification = requiresJustification(awareCategory)

  const antibioticOptions = [
    ...settings.formulary.map((entry) => ({ label: `${entry.antibioticName} (${entry.awareCategory})`, value: entry.antibioticName })),
    { label: 'Other (type below)', value: OTHER_ANTIBIOTIC },
  ]

  function validate(): string | null {
    if (!orgUnitId) return 'Select an org unit.'
    if (!antibioticName) return 'Enter or select an antibiotic.'
    if (!indication.trim()) return 'Enter an indication.'
    if (needsJustification && !justificationNote.trim()) {
      return `This is a ${awareCategory}-category antibiotic -- a justification note is required.`
    }
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
      setFormError('This checklist has not been configured yet. Ask an admin to open "Configure Stewardship" first.')
      return
    }

    const eventId = await submitEntry(settings.provisioned, orgUnitId!, todayIso(), {
      antibiotic: antibioticName,
      indication: indication.trim(),
      empiricOrCultureGuided: mode,
      awareCategory,
      justificationNote: justificationNote.trim() || null,
    })

    if (eventId) {
      setSuccess(true)
      setAntibioticChoice('')
      setOtherAntibiotic('')
      setIndication('')
      setJustificationNote('')
      setMode('Empiric')
      onSubmitted()
    }
  }

  if (!settings.provisioned || settings.orgUnits.length === 0) {
    return (
      <NoticeBox title="Not configured yet">
        An admin needs to open "Configure Stewardship" and save at least one org unit before entries can be logged.
      </NoticeBox>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
      {formError && (
        <NoticeBox error title="Could not log this entry">
          {formError}
        </NoticeBox>
      )}
      {error && (
        <NoticeBox error title="DHIS2 rejected this entry">
          {error}
        </NoticeBox>
      )}
      {success && <NoticeBox valid title="Entry logged" />}

      <SimpleSingleSelectField
        name="orgUnit"
        label="Org unit"
        required
        options={settings.orgUnits.map((ou) => ({ label: ou.name, value: ou.id }))}
        value={orgUnitId ?? ''}
        onChange={(value) => setOrgUnitId(value)}
      />

      <SimpleSingleSelectField
        name="antibiotic"
        label="Antibiotic"
        required
        options={antibioticOptions}
        value={antibioticChoice}
        onChange={(value) => setAntibioticChoice(value)}
      />

      {antibioticChoice === OTHER_ANTIBIOTIC && (
        <InputField label="Antibiotic name" required value={otherAntibiotic} onChange={({ value }) => setOtherAntibiotic(value ?? '')} />
      )}

      {antibioticName && (
        <div style={{ fontSize: 13, color: '#6e7a89' }}>
          AWaRe category: <strong>{awareCategory}</strong>
          {needsJustification && ' -- a justification note is required below.'}
        </div>
      )}

      <InputField
        label="Indication"
        required
        placeholder="e.g. suspected UTI"
        value={indication}
        onChange={({ value }) => setIndication(value ?? '')}
      />

      <div>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>Empiric or culture-guided</div>
        <div style={{ display: 'flex', gap: 24 }}>
          <Radio label="Empiric" checked={mode === 'Empiric'} onChange={() => setMode('Empiric')} />
          <Radio label="Culture-guided" checked={mode === 'Culture-guided'} onChange={() => setMode('Culture-guided')} />
        </div>
      </div>

      <TextAreaField
        label="Justification note"
        required={needsJustification}
        rows={3}
        value={justificationNote}
        onChange={({ value }) => setJustificationNote(value ?? '')}
        helpText={needsJustification ? 'Required for Watch/Reserve antibiotics.' : 'Optional.'}
      />

      <div>
        <Button primary onClick={handleSubmit} loading={submitting}>
          Log entry
        </Button>
      </div>
    </div>
  )
}
