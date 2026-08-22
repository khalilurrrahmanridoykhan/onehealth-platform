import { useDataEngine } from '@dhis2/app-runtime'
import { Button, InputField, MultiSelectField, MultiSelectOption, NoticeBox, SingleSelectField, SingleSelectOption } from '@dhis2/ui'
import { useEffect, useMemo, useState } from 'react'
import { useOrgUnits } from '../hooks/useOrgUnits'
import { useProvisionProgram } from '../hooks/useProvisionProgram'
import { useUserGroups, type UserGroupSummary } from '../hooks/useUserGroups'
import { supportsApproval, supportsFollowUp, type StewardshipOrgUnit, type StewardshipSettings } from '../types/stewardship'
import { FormularyEditor } from './FormularyEditor'

interface Props {
  settings: StewardshipSettings
  onSave: (settings: StewardshipSettings) => Promise<void>
}

// The "Configure Stewardship" screen -- gated by canManage in App.tsx, same
// convention as every sibling app's admin-only entry point. Handles first-run
// provisioning (findOrCreateProgram) transparently: an admin who has never
// saved before triggers it on first Save. findOrCreateProgram() is called on
// *every* save, not just first-run -- it's idempotent (one GET) once a
// program is fully provisioned, and it's also the only thing that adopts
// data elements added by a later feature onto an already-provisioned
// install (see useProvisionProgram.ts's adopt-and-extend path).
export function SetupPanel({ settings, onSave }: Props) {
  const [formulary, setFormulary] = useState(settings.formulary)
  const [orgUnitSearchTerm, setOrgUnitSearchTerm] = useState('')
  const [orgUnitIds, setOrgUnitIds] = useState(settings.orgUnits.map((ou) => ou.id))
  const [reviewerGroupId, setReviewerGroupId] = useState<string | null>(settings.reviewerGroupId ?? null)
  const [reviewerGroupSearchTerm, setReviewerGroupSearchTerm] = useState('')
  const [resolvedReviewerGroup, setResolvedReviewerGroup] = useState<UserGroupSummary | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const engine = useDataEngine()
  const { orgUnits: searchResults, loading: searchLoading } = useOrgUnits(orgUnitSearchTerm)
  const { userGroups: groupSearchResults, loading: groupSearchLoading } = useUserGroups(reviewerGroupSearchTerm)
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

  // reviewerGroupId is stored as a bare id, with no cached name (unlike
  // orgUnits) -- resolve its display name once on mount so the current
  // selection is visible even before the admin types anything into the
  // search box.
  useEffect(() => {
    if (!settings.reviewerGroupId) return
    let cancelled = false
    engine
      .query({ group: { resource: 'userGroups', id: settings.reviewerGroupId, params: { fields: 'id,name' } } })
      .then((response) => {
        if (!cancelled) setResolvedReviewerGroup((response as unknown as { group: UserGroupSummary }).group)
      })
      .catch(() => {
        // Group may have been deleted since -- leave unresolved, the
        // SingleSelectField just shows nothing selected until re-picked.
      })
    return () => {
      cancelled = true
    }
  }, [engine, settings.reviewerGroupId])

  const reviewerGroupOptions = useMemo<UserGroupSummary[]>(() => {
    const byId = new Map<string, UserGroupSummary>()
    if (resolvedReviewerGroup) byId.set(resolvedReviewerGroup.id, resolvedReviewerGroup)
    for (const g of groupSearchResults) byId.set(g.id, g)
    return [...byId.values()]
  }, [resolvedReviewerGroup, groupSearchResults])

  async function handleSave() {
    setError(null)
    if (orgUnitIds.length === 0) {
      setError('Select at least one org unit for the checklist to be active on.')
      return
    }
    setSaving(true)
    try {
      const selectedOrgUnits = orgUnitOptions.filter((ou) => orgUnitIds.includes(ou.id))
      const provisioned = await findOrCreateProgram(orgUnitIds)
      await syncProgramOrgUnits(provisioned.programId, orgUnitIds)
      await onSave({ ...settings, provisioned, formulary, orgUnits: selectedOrgUnits, reviewerGroupId })
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

      {settings.provisioned && !supportsFollowUp(settings.provisioned) && (
        <NoticeBox title="De-escalation follow-up not yet enabled on this install">
          This install was provisioned before the follow-up feature existed. Saving now will add 3 new fields
          (de-escalation outcome, review date, note) to the existing program stage -- your existing entries and data
          are not affected.
        </NoticeBox>
      )}

      {settings.provisioned && !supportsApproval(settings.provisioned) && (
        <NoticeBox title="Restricted-antibiotic approval not yet enabled on this install">
          This install was provisioned before the approval feature existed. Saving now will add 4 new fields
          (approval status, reviewer, date, note) to the existing program stage -- your existing entries and data
          are not affected.
        </NoticeBox>
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
        <h3 style={{ margin: '0 0 8px' }}>Restricted-antibiotic reviewers</h3>
        <div style={{ fontSize: 13, color: '#6e7a89', marginBottom: 8 }}>
          Members of this DHIS2 user group may Approve/Reject a Reserve-category entry. This is a UI convenience only
          -- like "Configure Stewardship" itself, it does not change who can write data server-side. Leave unset to
          disable the Approve/Reject action for everyone (Reserve entries still log normally, just with no reviewer).
        </div>
        <InputField
          label="Search user groups"
          dense
          value={reviewerGroupSearchTerm}
          onChange={({ value }) => setReviewerGroupSearchTerm(value ?? '')}
        />
        <SingleSelectField
          label="Reviewer group"
          loading={groupSearchLoading}
          noMatchText="No user groups found."
          selected={reviewerGroupId ?? undefined}
          onChange={({ selected }) => setReviewerGroupId(selected || null)}
          clearable
          clearText="Clear"
        >
          {reviewerGroupOptions.map((g) => (
            <SingleSelectOption key={g.id} label={g.name} value={g.id} />
          ))}
        </SingleSelectField>
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
