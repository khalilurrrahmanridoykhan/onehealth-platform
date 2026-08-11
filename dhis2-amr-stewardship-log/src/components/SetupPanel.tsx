import { Button, InputField, MultiSelectField, MultiSelectOption, NoticeBox } from '@dhis2/ui'
import { useMemo, useState } from 'react'
import { useOrgUnits } from '../hooks/useOrgUnits'
import { useProvisionProgram } from '../hooks/useProvisionProgram'
import type { StewardshipOrgUnit, StewardshipSettings } from '../types/stewardship'
import { FormularyEditor } from './FormularyEditor'

interface Props {
  settings: StewardshipSettings
  onSave: (settings: StewardshipSettings) => Promise<void>
}

// The "Configure Stewardship" screen -- gated by canManage in App.tsx, same
// convention as every sibling app's admin-only entry point. Handles first-run
// provisioning (findOrCreateProgram) transparently: an admin who has never
// saved before triggers it on first Save, an admin editing an already-
// provisioned install just keeps the org-unit assignment in sync.
export function SetupPanel({ settings, onSave }: Props) {
  const [formulary, setFormulary] = useState(settings.formulary)
  const [orgUnitSearchTerm, setOrgUnitSearchTerm] = useState('')
  const [orgUnitIds, setOrgUnitIds] = useState(settings.orgUnits.map((ou) => ou.id))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { orgUnits: searchResults, loading: searchLoading } = useOrgUnits(orgUnitSearchTerm)
  const { findOrCreateProgram, syncProgramOrgUnits } = useProvisionProgram()

  // Keeps already-selected org units visible (with their names) even when
  // they've scrolled out of the current search results -- same merge
  // pattern AuditForm.tsx uses for its own org-unit picker.
  const orgUnitOptions = useMemo<StewardshipOrgUnit[]>(() => {
    const byId = new Map<string, StewardshipOrgUnit>()
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
      const selectedOrgUnits = orgUnitOptions.filter((ou) => orgUnitIds.includes(ou.id))
      let provisioned = settings.provisioned
      if (provisioned) {
        await syncProgramOrgUnits(provisioned.programId, orgUnitIds)
      } else {
        provisioned = await findOrCreateProgram(orgUnitIds)
      }
      await onSave({ ...settings, provisioned, formulary, orgUnits: selectedOrgUnits })
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
          DHIS2 program provisioned: <code>{settings.provisioned.programId}</code>. Entries are logged as real DHIS2 Tracker
          events under this program -- see README for exactly what was created and why.
        </div>
      )}

      <div>
        <h3 style={{ margin: '0 0 8px' }}>Org units</h3>
        {/* MultiSelectField's own `filterable` only filters client-side
            across already-loaded options, so the server-side debounced
            search (useOrgUnits) needs its own input driving the query,
            separate from selection itself. */}
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
        <h3 style={{ margin: '0 0 8px' }}>Formulary</h3>
        <FormularyEditor formulary={formulary} onChange={setFormulary} />
      </div>

      <div>
        <Button primary onClick={handleSave} loading={saving}>
          Save configuration
        </Button>
      </div>
    </div>
  )
}
