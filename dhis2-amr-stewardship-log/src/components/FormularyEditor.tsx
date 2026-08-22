import { Button, IconDelete16, InputField, SimpleSingleSelectField, TextAreaField } from '@dhis2/ui'
import { AWARE_CATEGORIES, type FormularyEntry } from '../types/stewardship'

interface Props {
  formulary: FormularyEntry[]
  onChange: (formulary: FormularyEntry[]) => void
}

// A plain, admin-editable list -- no bundled antibiotic/AWaRe data ships
// with this app (see README for why). Every row is typed in by the admin
// configuring their own facility formulary.
export function FormularyEditor({ formulary, onChange }: Props) {
  function updateEntry(id: string, patch: Partial<FormularyEntry>) {
    onChange(formulary.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
  }

  function removeEntry(id: string) {
    onChange(formulary.filter((entry) => entry.id !== id))
  }

  function addEntry() {
    onChange([
      ...formulary,
      { id: crypto.randomUUID(), antibioticName: '', awareCategory: 'Not classified', note: null, typicalDurationDays: null },
    ])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {formulary.length === 0 && (
        <div style={{ fontSize: 13, color: '#6e7a89' }}>
          No formulary entries yet. Add each antibiotic your facility prescribes and its WHO AWaRe category (Access, Watch, or
          Reserve) -- entries left "Not classified" won't require a justification note, but will show up as their own slice in
          the compliance summary.
        </div>
      )}

      {formulary.map((entry) => (
        <div key={entry.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', borderBottom: '1px solid #e0e0e0', paddingBottom: 12 }}>
          <div style={{ flex: 2 }}>
            <InputField
              label="Antibiotic name"
              dense
              value={entry.antibioticName}
              onChange={({ value }) => updateEntry(entry.id, { antibioticName: value ?? '' })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <SimpleSingleSelectField
              name={`aware-${entry.id}`}
              label="AWaRe category"
              dense
              options={AWARE_CATEGORIES.map((c) => ({ label: c, value: c }))}
              value={entry.awareCategory}
              onChange={(value) => updateEntry(entry.id, { awareCategory: (value as FormularyEntry['awareCategory']) })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <InputField
              label="Typical duration (days)"
              type="number"
              dense
              value={entry.typicalDurationDays != null ? String(entry.typicalDurationDays) : ''}
              onChange={({ value }) => {
                const parsed = value ? Number(value) : NaN
                updateEntry(entry.id, { typicalDurationDays: Number.isFinite(parsed) ? parsed : null })
              }}
              helpText="Optional."
            />
          </div>
          <div style={{ flex: 2 }}>
            <TextAreaField
              label="Note (optional)"
              dense
              rows={1}
              value={entry.note ?? ''}
              onChange={({ value }) => updateEntry(entry.id, { note: value ? value : null })}
            />
          </div>
          <div style={{ paddingTop: 28 }}>
            <Button small icon={<IconDelete16 />} onClick={() => removeEntry(entry.id)}>
              Remove
            </Button>
          </div>
        </div>
      ))}

      <div>
        <Button small onClick={addEntry}>
          Add antibiotic
        </Button>
      </div>
    </div>
  )
}
