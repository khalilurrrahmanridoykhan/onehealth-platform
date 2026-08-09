import {
  Button,
  ButtonStrip,
  CheckboxField,
  InputField,
  Modal,
  ModalActions,
  ModalContent,
  ModalTitle,
  MultiSelectField,
  MultiSelectOption,
  NoticeBox,
  Radio,
  SimpleSingleSelectField,
} from '@dhis2/ui'
import { useEffect, useMemo, useState } from 'react'
import { useDataSetDetail, isNumericValueType } from '../hooks/useDataSetDetail'
import { useDataSets } from '../hooks/useDataSets'
import { SUPPORTED_PERIOD_TYPES, newAuditDefaults, type AuditConfig, type FreshnessMode, type PeriodType } from '../types/audit'

// This app's first-ever form UI -- OneHealth Data Trust uses zero @dhis2/ui
// form components today. The whole point of this form is the metadata-picker
// flow: dataset search -> one dataset-detail call feeds both the data-element
// and org-unit pickers (see useDataSetDetail), rather than three separate
// round trips.

function todayIso(): string {
  return new Date().toISOString()
}

interface Props {
  audit: AuditConfig | null // null = creating a new audit
  currentUsername: string
  onClose: () => void
  onSave: (audit: AuditConfig) => Promise<void>
}

export function AuditForm({ audit, currentUsername, onClose, onSave }: Props) {
  const isEditing = audit !== null

  const [name, setName] = useState(audit?.name ?? '')
  const [description, setDescription] = useState(audit?.description ?? '')

  const [datasetSearchTerm, setDatasetSearchTerm] = useState('')
  const [dataSetId, setDataSetId] = useState<string | null>(audit?.dataSetId ?? null)
  const [dataSetName, setDataSetName] = useState(audit?.dataSetName ?? '')

  const [dataElementId, setDataElementId] = useState<string | null>(audit?.dataElementId ?? null)
  const [dataElementName, setDataElementName] = useState(audit?.dataElementName ?? '')

  const [orgUnitIds, setOrgUnitIds] = useState<string[]>(audit?.orgUnits.map((ou) => ou.id) ?? [])
  const [requireAllOrgUnits, setRequireAllOrgUnits] = useState(
    audit ? audit.expectedOrgUnitIds.length === audit.orgUnits.length : true,
  )
  const [expectedOrgUnitIds, setExpectedOrgUnitIds] = useState<string[]>(audit?.expectedOrgUnitIds ?? [])

  const [freshnessMode, setFreshnessMode] = useState<FreshnessMode>(audit?.freshnessMode ?? 'operational')
  const [expectedUpdateDays, setExpectedUpdateDays] = useState(
    audit?.expectedUpdateDays !== null && audit?.expectedUpdateDays !== undefined ? String(audit.expectedUpdateDays) : '',
  )

  const [sourceName, setSourceName] = useState(audit?.sourceName ?? '')
  const [sourceUrl, setSourceUrl] = useState(audit?.sourceUrl ?? '')
  const [license, setLicense] = useState(audit?.license ?? '')
  const [doi, setDoi] = useState(audit?.doi ?? '')

  const defaults = newAuditDefaults()
  const [outlierDetectionEnabled, setOutlierDetectionEnabled] = useState(
    audit?.outlierDetectionEnabled ?? defaults.outlierDetectionEnabled,
  )
  const [trendChangeThresholdPercent, setTrendChangeThresholdPercent] = useState(
    audit?.trendChangeThresholdPercent !== null && audit?.trendChangeThresholdPercent !== undefined
      ? String(audit.trendChangeThresholdPercent)
      : '',
  )
  const [comparisonDataElementId, setComparisonDataElementId] = useState<string | null>(
    audit?.comparisonDataElementId ?? defaults.comparisonDataElementId,
  )
  const [comparisonDataElementName, setComparisonDataElementName] = useState(
    audit?.comparisonDataElementName ?? '',
  )
  const [comparisonLabel, setComparisonLabel] = useState(audit?.comparisonLabel ?? '')
  const [expectedRatioMin, setExpectedRatioMin] = useState(
    audit?.expectedRatioMin !== null && audit?.expectedRatioMin !== undefined ? String(audit.expectedRatioMin) : '',
  )
  const [expectedRatioMax, setExpectedRatioMax] = useState(
    audit?.expectedRatioMax !== null && audit?.expectedRatioMax !== undefined ? String(audit.expectedRatioMax) : '',
  )

  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const { dataSets, loading: dataSetsLoading } = useDataSets(datasetSearchTerm)
  const { detail, loading: detailLoading } = useDataSetDetail(dataSetId)

  // Reset picks that depend on the dataset whenever it changes.
  useEffect(() => {
    if (!isEditing) {
      setDataElementId(null)
      setDataElementName('')
      setOrgUnitIds([])
      setExpectedOrgUnitIds([])
      setComparisonDataElementId(null)
      setComparisonDataElementName('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSetId])

  const numericDataElements = useMemo(
    () => (detail?.dataElements ?? []).filter((de) => isNumericValueType(de.valueType)),
    [detail],
  )

  const periodType = (detail?.periodType ?? audit?.periodType ?? null) as PeriodType | null
  const periodTypeSupported = periodType !== null && SUPPORTED_PERIOD_TYPES.includes(periodType)

  const orgUnitOptions = detail?.organisationUnits ?? audit?.orgUnits ?? []
  const selectedOrgUnits = orgUnitOptions.filter((ou) => orgUnitIds.includes(ou.id))

  function handleSelectOrgUnits(selected: string[]) {
    setOrgUnitIds(selected)
    if (requireAllOrgUnits) setExpectedOrgUnitIds(selected)
    else setExpectedOrgUnitIds((prev) => prev.filter((id) => selected.includes(id)))
  }

  function handleToggleRequireAll(checked: boolean) {
    setRequireAllOrgUnits(checked)
    if (checked) setExpectedOrgUnitIds(orgUnitIds)
  }

  function validate(): string | null {
    if (!name.trim()) return 'Name is required.'
    if (!dataSetId) return 'Select a dataset.'
    if (!dataElementId) return 'Select a data element.'
    if (orgUnitIds.length === 0) return 'Select at least one org unit.'
    if (!periodTypeSupported) {
      return `This dataset's period type (${detail?.periodType ?? 'unknown'}) is not supported yet. Supported types: ${SUPPORTED_PERIOD_TYPES.join(', ')}.`
    }
    if (freshnessMode === 'operational' && expectedUpdateDays && Number.isNaN(Number(expectedUpdateDays))) {
      return 'Expected update cycle must be a number.'
    }
    return null
  }

  async function handleSave() {
    const validationError = validate()
    if (validationError) {
      setFormError(validationError)
      return
    }
    setFormError(null)
    setSaving(true)

    const next: AuditConfig = {
      id: audit?.id ?? crypto.randomUUID(),
      name: name.trim(),
      description: description.trim() || null,
      dataSetId: dataSetId!,
      dataSetName,
      periodType: periodType!,
      dataElementId: dataElementId!,
      dataElementName,
      orgUnits: selectedOrgUnits,
      expectedOrgUnitIds: requireAllOrgUnits ? orgUnitIds : expectedOrgUnitIds,
      freshnessMode,
      expectedUpdateDays: freshnessMode === 'operational' && expectedUpdateDays ? Number(expectedUpdateDays) : null,
      sourceName: sourceName.trim() || null,
      sourceUrl: sourceUrl.trim() || null,
      license: license.trim() || null,
      doi: doi.trim() || null,
      outlierDetectionEnabled,
      trendChangeThresholdPercent: trendChangeThresholdPercent ? Number(trendChangeThresholdPercent) : null,
      comparisonDataElementId,
      comparisonDataElementName: comparisonDataElementId ? comparisonDataElementName : null,
      comparisonLabel: comparisonDataElementId ? comparisonLabel.trim() || null : null,
      expectedRatioMin: comparisonDataElementId && expectedRatioMin ? Number(expectedRatioMin) : null,
      expectedRatioMax: comparisonDataElementId && expectedRatioMax ? Number(expectedRatioMax) : null,
      createdAt: audit?.createdAt ?? todayIso(),
      updatedAt: todayIso(),
      createdBy: audit?.createdBy ?? currentUsername,
    }

    try {
      await onSave(next)
      onClose()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  const comparisonOptions = numericDataElements.filter((de) => de.id !== dataElementId)

  return (
    <Modal onClose={onClose} large>
      <ModalTitle>{isEditing ? 'Edit audit' : 'Add audit'}</ModalTitle>
      <ModalContent>
        {formError && (
          <div style={{ marginBottom: 16 }}>
            <NoticeBox error title="Could not save this audit">
              {formError}
            </NoticeBox>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <InputField
            label="Name"
            required
            value={name}
            onChange={({ value }) => setName(value ?? '')}
            placeholder="e.g. Malaria confirmed cases, Northern region"
          />

          <SimpleSingleSelectField
            name="dataset"
            label="Dataset"
            required
            filterable
            filterPlaceholder="Search datasets by name..."
            filterValue={datasetSearchTerm}
            onFilterChange={setDatasetSearchTerm}
            loading={dataSetsLoading}
            noMatchText="No datasets match this search."
            options={dataSets.map((ds) => ({ label: `${ds.name} (${ds.periodType})`, value: ds.id }))}
            value={dataSetId ?? ''}
            valueLabel={dataSetName || undefined}
            onChange={(value) => {
              const chosen = dataSets.find((ds) => ds.id === value)
              setDataSetId(value)
              setDataSetName(chosen?.name ?? dataSetName)
            }}
          />

          {dataSetId && (
            <>
              <SimpleSingleSelectField
                name="dataElement"
                label="Data element"
                required
                loading={detailLoading}
                filterable
                filterPlaceholder="Filter data elements..."
                noMatchText="No numeric data elements found in this dataset."
                empty="This dataset has no numeric data elements to audit."
                options={numericDataElements.map((de) => ({ label: de.name, value: de.id }))}
                value={dataElementId ?? ''}
                valueLabel={dataElementName || undefined}
                onChange={(value) => {
                  const chosen = numericDataElements.find((de) => de.id === value)
                  setDataElementId(value)
                  setDataElementName(chosen?.name ?? dataElementName)
                }}
              />

              {detail && (
                <div style={{ fontSize: 13, color: '#6e7a89' }}>
                  Period type: <strong>{detail.periodType}</strong>
                  {!periodTypeSupported && (
                    <span style={{ color: '#c22a2a' }}>
                      {' '}
                      -- not supported yet. Supported: {SUPPORTED_PERIOD_TYPES.join(', ')}.
                    </span>
                  )}
                </div>
              )}

              <MultiSelectField
                label="Org units to query"
                required
                loading={detailLoading}
                filterable
                filterPlaceholder="Filter org units..."
                noMatchText="No org units found."
                selected={orgUnitIds}
                onChange={({ selected }) => handleSelectOrgUnits(selected)}
              >
                {orgUnitOptions.map((ou) => (
                  <MultiSelectOption key={ou.id} label={ou.name} value={ou.id} />
                ))}
              </MultiSelectField>

              <CheckboxField
                label="Require all selected org units to report (recommended)"
                checked={requireAllOrgUnits}
                onChange={({ checked }) => handleToggleRequireAll(checked)}
                helpText="Unchecked lets you narrow which org units are actually expected to have data -- feeds the coverage check."
              />

              {!requireAllOrgUnits && orgUnitIds.length > 0 && (
                <MultiSelectField
                  label="Org units actually expected to report"
                  selected={expectedOrgUnitIds}
                  onChange={({ selected }) => setExpectedOrgUnitIds(selected)}
                >
                  {selectedOrgUnits.map((ou) => (
                    <MultiSelectOption key={ou.id} label={ou.name} value={ou.id} />
                  ))}
                </MultiSelectField>
              )}
            </>
          )}

          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Freshness</div>
            <div style={{ display: 'flex', gap: 24 }}>
              <Radio
                label="Operational (should update regularly)"
                checked={freshnessMode === 'operational'}
                onChange={() => setFreshnessMode('operational')}
              />
              <Radio
                label="Historical (a fixed, closed dataset)"
                checked={freshnessMode === 'historical'}
                onChange={() => setFreshnessMode('historical')}
              />
            </div>
          </div>

          {freshnessMode === 'operational' && (
            <InputField
              label="Expected update cycle (days)"
              type="number"
              value={expectedUpdateDays}
              onChange={({ value }) => setExpectedUpdateDays(value ?? '')}
              helpText="How many days can pass before this audit is considered stale."
            />
          )}

          <InputField label="Description / notes (optional)" value={description} onChange={({ value }) => setDescription(value ?? '')} />
          <InputField label="Source name (optional)" value={sourceName} onChange={({ value }) => setSourceName(value ?? '')} />
          <InputField label="Source URL (optional)" value={sourceUrl} onChange={({ value }) => setSourceUrl(value ?? '')} />
          <InputField label="License (optional)" value={license} onChange={({ value }) => setLicense(value ?? '')} />
          <InputField label="DOI (optional)" value={doi} onChange={({ value }) => setDoi(value ?? '')} />

          <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 16, marginTop: 8 }}>
            <h4 style={{ margin: '0 0 12px' }}>Advanced (public-health-grade checks)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CheckboxField
                label="Enable outlier detection"
                checked={outlierDetectionEnabled}
                onChange={({ checked }) => setOutlierDetectionEnabled(checked)}
                helpText="Uses this instance's native outlier-detection analysis where available, otherwise an interquartile-range check."
              />

              <InputField
                label="Flag period-over-period changes larger than (%)"
                type="number"
                value={trendChangeThresholdPercent}
                onChange={({ value }) => setTrendChangeThresholdPercent(value ?? '')}
                helpText="Leave blank to disable trend/spike-drop detection."
              />

              {dataSetId && (
                <SimpleSingleSelectField
                  name="comparisonDataElement"
                  label="Compare against a second data element (optional)"
                  clearable
                  clearText="None"
                  loading={detailLoading}
                  filterable
                  filterPlaceholder="Filter data elements..."
                  noMatchText="No other numeric data elements found."
                  options={comparisonOptions.map((de) => ({ label: de.name, value: de.id }))}
                  value={comparisonDataElementId ?? ''}
                  valueLabel={comparisonDataElementName || undefined}
                  onChange={(value) => {
                    if (!value) {
                      setComparisonDataElementId(null)
                      setComparisonDataElementName('')
                      return
                    }
                    const chosen = comparisonOptions.find((de) => de.id === value)
                    setComparisonDataElementId(value)
                    setComparisonDataElementName(chosen?.name ?? comparisonDataElementName)
                  }}
                />
              )}

              {comparisonDataElementId && (
                <>
                  <InputField
                    label="Ratio label"
                    value={comparisonLabel}
                    onChange={({ value }) => setComparisonLabel(value ?? '')}
                    placeholder="e.g. positivity rate"
                  />
                  <div style={{ display: 'flex', gap: 16 }}>
                    <InputField
                      label="Expected ratio minimum"
                      type="number"
                      value={expectedRatioMin}
                      onChange={({ value }) => setExpectedRatioMin(value ?? '')}
                    />
                    <InputField
                      label="Expected ratio maximum"
                      type="number"
                      value={expectedRatioMax}
                      onChange={({ value }) => setExpectedRatioMax(value ?? '')}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </ModalContent>
      <ModalActions>
        <ButtonStrip end>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button primary onClick={handleSave} loading={saving}>
            {isEditing ? 'Save changes' : 'Add audit'}
          </Button>
        </ButtonStrip>
      </ModalActions>
    </Modal>
  )
}
