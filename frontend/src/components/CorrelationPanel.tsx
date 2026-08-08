import { useEffect, useId, useState } from 'react'
import { api } from '../api'
import type { AwdCorrelationReport, AwdCorrelationVariable } from '../types'

function formatR(value: number): string {
  return (value >= 0 ? '+' : '') + value.toFixed(2)
}

function formatP(value: number): string {
  return value < 0.001 ? '<0.001' : value.toFixed(3)
}

function strengthLabel(r: number): string {
  const abs = Math.abs(r)
  if (abs >= 0.5) return 'strong'
  if (abs >= 0.3) return 'moderate'
  return 'weak'
}

function SignificanceBadge({ p }: { p: number }) {
  return p < 0.05
    ? <span className="trust-check trust-check-info">p&lt;0.05</span>
    : <span className="trust-check trust-check-pass">not significant</span>
}

function VariableCard({ name, variable }: { name: string; variable: AwdCorrelationVariable }) {
  const rows = [
    { label: 'Pooled — Pearson', r: variable.pooled.pearson_r, p: variable.pooled.pearson_p },
    { label: 'Pooled — Spearman', r: variable.pooled.spearman_rho, p: variable.pooled.spearman_p },
    { label: 'Within-division — Pearson', r: variable.within_division.pearson_r, p: variable.within_division.pearson_p },
  ]
  return (
    <article className="data-trust-card" key={name}>
      <h3>{variable.label} <small>{variable.unit}</small></h3>
      <dl className="data-trust-details">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>r = {formatR(row.r)} ({strengthLabel(row.r)}) · p = {formatP(row.p)} <SignificanceBadge p={row.p} /></dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

function CorrelationContent({ report }: { report: AwdCorrelationReport }) {
  const headingId = useId()
  return <section className="panel data-trust-panel" aria-labelledby={headingId} id="awd-correlation">
    <div className="panel-heading data-trust-heading">
      <div>
        <p className="eyebrow">Exploratory analysis</p>
        <h2 id={headingId}>AWD &amp; climate correlation</h2>
        <p className="data-trust-intro">{report.disclaimer}</p>
      </div>
    </div>

    <dl className="data-trust-summary" aria-label="Analysis identity">
      <div><dt>Unit of analysis</dt><dd>{report.method.unit_of_analysis}</dd></div>
      <div><dt>Years</dt><dd>{report.years[0]}–{report.years[report.years.length - 1]}</dd></div>
      <div><dt>Divisions</dt><dd>{report.divisions.length}</dd></div>
      <div><dt>Significance test</dt><dd>{report.method.significance_test}</dd></div>
    </dl>

    <div className="data-trust-grid">
      {Object.entries(report.variables).map(([name, variable]) => (
        <VariableCard key={name} name={name} variable={variable} />
      ))}
    </div>

    <div className="data-trust-assurance-grid">
      <article className="data-trust-quality">
        <div className="data-trust-subheading"><h3>Method notes</h3></div>
        <ul>
          <li><strong>Aggregation</strong><small>{report.method.aggregation}</small></li>
          <li><strong>Pooled vs. within-division</strong><small>{report.method.pooled_vs_within_division}</small></li>
          <li><strong>Interpretation guidance</strong><small>{report.interpretation_guidance}</small></li>
        </ul>
      </article>

      <aside className="data-trust-limitations" aria-labelledby={`${headingId}-limitations`}>
        <h3 id={`${headingId}-limitations`}>Limitations</h3>
        <ul>{report.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
      </aside>
    </div>
  </section>
}

export function CorrelationPanel() {
  const [report, setReport] = useState<AwdCorrelationReport>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError('')
    api.awdCorrelation()
      .then(setReport)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load the AWD-climate correlation analysis.'))
      .finally(() => setLoading(false))
  }, [attempt])

  if (loading) return <section className="panel data-trust-panel data-trust-loading" aria-busy="true" aria-live="polite"><p>Loading AWD-climate correlation analysis…</p></section>
  if (error) return <section className="panel data-trust-panel data-trust-error" role="alert">
    <h2>AWD-climate correlation analysis is unavailable</h2>
    <p>{error}</p>
    <button type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
  </section>
  return report ? <CorrelationContent report={report} /> : null
}
