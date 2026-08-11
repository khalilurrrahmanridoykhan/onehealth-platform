import { Button, InputField, MultiSelectField, MultiSelectOption, NoticeBox } from '@dhis2/ui'
import { useMemo, useState } from 'react'
import { useOrgUnits } from '../hooks/useOrgUnits'
import { useProvisionProgram } from '../hooks/useProvisionProgram'
import type { OtssSettings } from '../types/otss'
import { ChecklistEditor } from './ChecklistEditor'

interface Props {
  settings: OtssSettings
  onSave: (settings: OtssSettings) => Promise<void>
}

type OrgUnitOption = { id: string; name: string }

export function SetupPanel({ settings, onSave }: Props) {
  const [checklist, setChecklist] = useState(settings.checklist)
  const [requiredSample, setRequiredSample] = useState(settings.registerReviewRequiredSample)
  const [orgUnitSearchTerm, setOrgUnitSearchTerm] = useState('')
  const [orgUnitIds, setOrgUnitIds] = useState(settings.orgUnits.map((ou) => ou.id))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { orgUnits: searchResults, loading: searchLoading } = useOrgUnits(orgUnitSearchTerm)
  const { findOrCreateProgram, syncProgramOrgUnits } = useProvisionProgram()

  const orgUnitOptions = useMemo<OrgUnitOption[]>(() => {
    const byId = new Map<string, OrgUnitOption>()
    for (const ou of settings.orgUnits) byId.set(ou.id, ou)
    for (const ou of searchResults) byId.set(ou.id, ou)
    return [...byId.values()]
  }, [settings.orgUnits, searchResults])

  async function handleSave() {
    setError(null)
    if (orgUnitIds.length === 0) {
      setError('Select at least one org unit for the checklist to be active on.')
      return
    }
    setSaving(true)
    try {
      const selectedOrgUnits: OrgUnitOption[] = orgUnitOptions.filter((ou) => orgUnitIds.includes(ou.id))
      let provisioned = settings.provisioned
      if (provisioned) {
        await syncProgramOrgUnits(provisioned.programId, orgUnitIds)
      } else {
        provisioned = await findOrCreateProgram(orgUnitIds)
      }
      await onSave({ ...settings, provisioned, checklist, registerReviewRequiredSample: requiredSample, orgUnits: selectedOrgUnits })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760 }}>
      {error && (
        <NoticeBox error title="Could not save configuration">
          {error}
        </NoticeBox>
      )}

      {settings.provisioned && (
        <div style={{ fontSize: 13, color: '#6e7a89' }}>
          DHIS2 program provisioned: <code>{settings.provisioned.programId}</code>. Visits are logged as real DHIS2 Tracker
          events under this program -- see README for exactly what was created and why.
        </div>
      )}

      <div>
        <h3 style={{ margin: '0 0 8px' }}>Org units</h3>
        <InputField
          label="Search org units"
          dense
          value={orgUnitSearchTerm}
          onChange={({ value }) => setOrgUnitSearchTerm(value ?? '')}
        />
        <MultiSelectField
          label="Org units the checklist is active for"
          loading={searchLoading}
          noMatchText="No org units found."
          selected={orgUnitIds}
          onChange={({ selected }) => setOrgUnitIds(selected)}
        >
          {orgUnitOptions.map((ou) => (
            <MultiSelectOption key={ou.id} label={ou.name} value={ou.id} />
          ))}
        </MultiSelectField>
      </div>

      <div>
        <h3 style={{ margin: '0 0 8px' }}>Checklist</h3>
        <ChecklistEditor
          checklist={checklist}
          onChange={setChecklist}
          registerReviewRequiredSample={requiredSample}
          onChangeRequiredSample={setRequiredSample}
        />
      </div>

      <div>
        <Button primary onClick={handleSave} loading={saving}>
          Save configuration
        </Button>
      </div>
    </div>
  )
}
