import { Button, ButtonStrip, Card, CircularLoader, NoticeBox } from '@dhis2/ui'
import type { ReactNode } from 'react'
import { useAuditReports } from '../context/AuditReportsContext'
import type { AuditConfig } from '../types/audit'
import { FreshnessTag, QualityTag } from './StatusTag'

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/^./, (letter: string) => letter.toUpperCase())
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e0e0e0' }}>
      <span style={{ color: '#6e7a89' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  )
}

export function AuditDetail({
  audit,
  canManage,
  onEdit,
  onDelete,
}: {
  audit: AuditConfig
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const { reportsByAuditId, refresh } = useAuditReports()
  const state = reportsByAuditId[audit.id]

  if (!state || state.loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <CircularLoader />
      </div>
    )
  }

  if (state.error || !state.report) {
    return (
      <NoticeBox error title="Could not load this audit's data">
        {state.error ?? 'No response was returned by this DHIS2 instance.'}
      </NoticeBox>
    )
  }

  const { coverage, freshness, provenance, quality } = state.report

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 4px' }}>{audit.name}</h2>
          <p style={{ margin: 0, color: '#6e7a89' }}>
            {audit.dataElementName} · {audit.dataSetName}
          </p>
        </div>
        <ButtonStrip>
          <Button small onClick={() => refresh(audit.id)}>
            Refresh
          </Button>
          {canManage && (
            <>
              <Button small onClick={onEdit}>
                Edit
              </Button>
              <Button small destructive onClick={onDelete}>
                Delete
              </Button>
            </>
          )}
        </ButtonStrip>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <QualityTag status={quality.status} />
        <FreshnessTag status={freshness.status} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <Card>
          <div style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Coverage</h3>
            <SummaryRow label="Date range" value={coverage.startDate ? `${coverage.startDate} – ${coverage.endDate}` : 'No data'} />
            <SummaryRow label="Data values" value={coverage.recordCount} />
            <SummaryRow label="Org units reporting" value={coverage.locationCount} />
            <SummaryRow label="Distinct periods" value={coverage.periodCount} />
          </div>
        </Card>

        <Card>
          <div style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Freshness</h3>
            <SummaryRow label="Status" value={humanize(freshness.status)} />
            <SummaryRow label="Latest period end" value={freshness.latestPeriodEnd ?? 'Unknown'} />
            <SummaryRow label="Age" value={freshness.ageDays === null ? 'Unknown' : `${freshness.ageDays} days`} />
            <SummaryRow
              label="Expected update cycle"
              value={freshness.expectedUpdateDays === null ? 'Not specified' : `Every ${freshness.expectedUpdateDays} days`}
            />
          </div>
        </Card>

        <Card>
          <div style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Provenance</h3>
            <SummaryRow
              label="Source"
              value={
                provenance.sourceUrl ? (
                  <a href={provenance.sourceUrl} target="_blank" rel="noreferrer">
                    {provenance.sourceName ?? provenance.sourceUrl}
                  </a>
                ) : (
                  provenance.sourceName ?? 'Not specified'
                )
              }
            />
            <SummaryRow label="License" value={provenance.license ?? 'Not specified'} />
            <SummaryRow label="DOI" value={provenance.doi ?? 'Not specified'} />
          </div>
        </Card>
      </div>

      <Card>
        <div style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>
            Quality checks <span style={{ fontWeight: 400, color: '#6e7a89' }}>({quality.issueCount} issues)</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {quality.checks.map((check) => (
              <div key={check.code} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <QualityTag status={check.status} />
                <span>
                  <strong>{humanize(check.code)}</strong>{' '}
                  <span style={{ color: '#6e7a89', fontSize: 12 }}>({check.dimension})</span>
                  <br />
                  <span style={{ color: '#6e7a89' }}>{check.message}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {audit.description && <NoticeBox title="Notes">{audit.description}</NoticeBox>}

      <p style={{ fontSize: 12, color: '#a0a7ae', margin: 0 }}>
        Values are summed across all category option combinations for this data element.
      </p>
    </div>
  )
}
