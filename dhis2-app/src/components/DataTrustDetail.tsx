import { Card, CircularLoader, NoticeBox, Tag } from '@dhis2/ui'
import type { ReactNode } from 'react'
import type { ProgrammeConfig } from '../config/programmes'
import { useProgrammeDataTrust } from '../hooks/useProgrammeDataTrust'
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

export function DataTrustDetail({ programme }: { programme: ProgrammeConfig }) {
  const { loading, error, report } = useProgrammeDataTrust(programme)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <CircularLoader />
      </div>
    )
  }

  if (error || !report) {
    return (
      <NoticeBox error title="Could not load this programme's data">
        {error ?? 'No response was returned by this DHIS2 instance.'}
      </NoticeBox>
    )
  }

  const { coverage, freshness, provenance, quality } = report

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ margin: '0 0 4px' }}>{programme.name}</h2>
        <p style={{ margin: 0, color: '#6e7a89' }}>
          {programme.metricLabel} · {humanize(programme.evidenceType)}
        </p>
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
            <SummaryRow label="Locations reporting" value={coverage.locationCount} />
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
                <a href={provenance.sourceUrl} target="_blank" rel="noreferrer">
                  {provenance.sourceName}
                </a>
              }
            />
            <SummaryRow label="License" value={provenance.license ?? 'Not specified'} />
            <SummaryRow label="DOI" value={provenance.doi ?? 'Not specified'} />
          </div>
        </Card>

        <Card>
          <div style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Capabilities</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <Tag positive={programme.capabilities.alerts} neutral={!programme.capabilities.alerts}>
                Alerts
              </Tag>
              <Tag positive={programme.capabilities.forecast} neutral={!programme.capabilities.forecast}>
                Forecast
              </Tag>
              <Tag positive={programme.capabilities.automatedRefresh} neutral={!programme.capabilities.automatedRefresh}>
                Automated refresh
              </Tag>
              <Tag positive={programme.capabilities.districtData} neutral={!programme.capabilities.districtData}>
                District data
              </Tag>
            </div>
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
                  <strong>{humanize(check.code)}</strong>
                  <br />
                  <span style={{ color: '#6e7a89' }}>{check.message}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <NoticeBox title="Known limitations" warning>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {programme.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </NoticeBox>
    </div>
  )
}
