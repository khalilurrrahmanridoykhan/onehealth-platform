import { useEffect, useId, useState } from 'react'
import {
  fetchDataTrustReport,
  type DataTrustCapabilities,
  type DataTrustReport,
} from '../dataTrust'

interface DataTrustPanelProps {
  diseaseCode: string
  report?: DataTrustReport
}

const number = new Intl.NumberFormat('en-US')
const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function formatDate(value: string | null): string {
  if (!value) return 'Not reported'
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00Z` : value)
  return Number.isNaN(parsed.valueOf()) ? value : date.format(parsed)
}

function humanize(value: string): string {
  return value.replaceAll('_', ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase())
}

function statusClass(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function ExternalLink({ href, children }: { href: string; children: string }) {
  return <a href={href} target="_blank" rel="noreferrer" aria-label={`${children} (opens in a new tab)`}>{children}</a>
}

function CapabilityList({ capabilities }: { capabilities: DataTrustCapabilities }) {
  const rows: Array<[string, boolean]> = [
    ['Automated alerts', capabilities.alerts],
    ['Forecasting', capabilities.forecast],
    ['Automated refresh', capabilities.automated_refresh],
    ['District-level data', capabilities.district_data],
  ]
  return <dl className="data-trust-capabilities">
    {rows.map(([label, enabled]) => <div key={label}>
      <dt>{label}</dt>
      <dd className={`trust-availability trust-availability-${enabled ? 'yes' : 'no'}`}>
        <span aria-hidden="true">{enabled ? '✓' : '—'}</span> {enabled ? 'Available' : 'Not available'}
      </dd>
    </div>)}
  </dl>
}

function DataTrustContent({ report }: { report: DataTrustReport }) {
  const headingId = useId()
  const doiUrl = report.provenance.doi
    ? report.provenance.doi.startsWith('http') ? report.provenance.doi : `https://doi.org/${report.provenance.doi}`
    : null
  const periodIntegrity = report.coverage.partial_periods
    ? `${number.format(report.coverage.complete_periods)} complete · ${number.format(report.coverage.partial_periods)} partial`
    : `${number.format(report.coverage.complete_periods)} complete`

  return <section className="panel data-trust-panel" aria-labelledby={headingId} id="data-trust">
    <div className="panel-heading data-trust-heading">
      <div>
        <p className="eyebrow">Data trust &amp; operations</p>
        <h2 id={headingId}>Evidence, freshness and provenance</h2>
        <p className="data-trust-intro">What this {report.disease_name} dataset can support—and where it must not be over-interpreted.</p>
      </div>
      <div className="data-trust-statuses" aria-label="Dataset status">
        <span className={`trust-status trust-status-${statusClass(report.quality.status)}`}>Quality {humanize(report.quality.status)}</span>
        <span className={`trust-status trust-status-${statusClass(report.freshness.status)}`}>{humanize(report.freshness.status)}</span>
      </div>
    </div>

    <dl className="data-trust-summary" aria-label="Dataset identity">
      <div><dt>Evidence type</dt><dd>{humanize(report.evidence_type)}</dd></div>
      <div><dt>Metric</dt><dd>{report.metric.label}<small>{report.metric.unit}</small></dd></div>
      <div><dt>Latest period end</dt><dd>{formatDate(report.freshness.latest_period_end)}</dd></div>
      <div><dt>Geographic detail</dt><dd>{report.coverage.location_levels.length ? report.coverage.location_levels.map(humanize).join(', ') : 'Not specified'}</dd></div>
    </dl>

    <div className="data-trust-grid">
      <article className="data-trust-card">
        <h3>Coverage</h3>
        <dl className="data-trust-details">
          <div><dt>Date range</dt><dd>{formatDate(report.coverage.start_date)} – {formatDate(report.coverage.end_date)}</dd></div>
          <div><dt>Records</dt><dd>{number.format(report.coverage.record_count)}</dd></div>
          <div><dt>Reporting locations</dt><dd>{number.format(report.coverage.location_count)}</dd></div>
          <div><dt>Period integrity</dt><dd>{periodIntegrity}</dd></div>
          <div><dt>Period types</dt><dd>{report.coverage.period_types.length ? report.coverage.period_types.map(humanize).join(', ') : 'Not specified'}</dd></div>
        </dl>
      </article>

      <article className="data-trust-card">
        <h3>Freshness</h3>
        <dl className="data-trust-details">
          <div><dt>Status</dt><dd>{humanize(report.freshness.status)}</dd></div>
          <div><dt>Age</dt><dd>{report.freshness.age_days === null ? 'Unknown' : `${number.format(report.freshness.age_days)} days`}</dd></div>
          <div><dt>Expected update cycle</dt><dd>{report.freshness.expected_update_days === null ? 'Not specified' : `Every ${number.format(report.freshness.expected_update_days)} days`}</dd></div>
          <div><dt>Assessed as of</dt><dd>{formatDate(report.freshness.as_of)}</dd></div>
        </dl>
      </article>

      <article className="data-trust-card">
        <h3>Provenance</h3>
        {report.provenance.sources.length ? <ul className="data-trust-sources">
          {report.provenance.sources.map((source, index) => <li key={`${source.name}-${index}`}>
            {source.url ? <ExternalLink href={source.url}>{source.name}</ExternalLink> : source.name}
          </li>)}
        </ul> : <p className="data-trust-empty">No source link was supplied.</p>}
        <dl className="data-trust-details">
          <div><dt>Licence</dt><dd>{report.provenance.license ?? 'Not specified'}</dd></div>
          {doiUrl && <div><dt>DOI</dt><dd><ExternalLink href={doiUrl}>{report.provenance.doi ?? doiUrl}</ExternalLink></dd></div>}
          {report.provenance.repository_url && <div><dt>Repository</dt><dd><ExternalLink href={report.provenance.repository_url}>Open repository</ExternalLink></dd></div>}
        </dl>
      </article>

      <article className="data-trust-card">
        <h3>Permitted capabilities</h3>
        <CapabilityList capabilities={report.capabilities} />
      </article>
    </div>

    <div className="data-trust-assurance-grid">
      <article className="data-trust-quality">
        <div className="data-trust-subheading"><h3>Quality checks</h3><span>{number.format(report.quality.issue_count)} issues</span></div>
        {report.quality.checks.length ? <ul>
          {report.quality.checks.map((check) => <li key={check.code}>
            <span className={`trust-check trust-check-${statusClass(check.status)}`}>{humanize(check.status)}</span>
            <span><strong>{humanize(check.code)}</strong><small>{check.message}</small></span>
          </li>)}
        </ul> : <p className="data-trust-empty">No individual checks were reported.</p>}
      </article>

      <aside className="data-trust-limitations" aria-labelledby={`${headingId}-limitations`}>
        <h3 id={`${headingId}-limitations`}>Known limitations</h3>
        {report.limitations.length ? <ul>{report.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
          : <p>No additional limitations were documented. Standard surveillance-data caveats still apply.</p>}
      </aside>
    </div>
  </section>
}

export function DataTrustPanel({ diseaseCode, report: suppliedReport }: DataTrustPanelProps) {
  const [report, setReport] = useState<DataTrustReport | undefined>(suppliedReport)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!suppliedReport)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (suppliedReport) {
      setReport(suppliedReport)
      setError('')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError('')
    fetchDataTrustReport(diseaseCode, controller.signal)
      .then(setReport)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load data-trust metadata.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [attempt, diseaseCode, suppliedReport])

  if (loading) return <section className="panel data-trust-panel data-trust-loading" aria-busy="true" aria-live="polite"><p>Loading data-trust evidence…</p></section>
  if (error) return <section className="panel data-trust-panel data-trust-error" role="alert">
    <h2>Data-trust evidence is unavailable</h2>
    <p>{error}</p>
    <button type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
  </section>
  return report ? <DataTrustContent report={report} /> : null
}
