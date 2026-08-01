import type { Alert, OverviewItem } from '../types'

interface Props {
  summary?: OverviewItem
  alert?: Alert
}

const number = new Intl.NumberFormat('en-US')

export function SummaryCards({ summary, alert }: Props) {
  const change = alert && alert.expected_cases
    ? ((alert.observed_cases - alert.expected_cases) / alert.expected_cases) * 100
    : null

  return (
    <section className="summary-grid" aria-label="Surveillance summary">
      <article className="metric-card metric-primary">
        <span>Latest weekly cases</span>
        <strong>{summary ? number.format(summary.latest_cases) : '—'}</strong>
        <small>{summary?.latest_period ?? 'No reporting period'}</small>
      </article>
      <article className="metric-card">
        <span>Expected cases</span>
        <strong>{alert ? number.format(Math.round(alert.expected_cases)) : '—'}</strong>
        <small>Previous four-week mean</small>
      </article>
      <article className="metric-card">
        <span>Change from baseline</span>
        <strong className={change !== null && change > 0 ? 'text-alert' : 'text-stable'}>
          {change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}
        </strong>
        <small>Latest complete week</small>
      </article>
      <article className="metric-card">
        <span>Total observed cases</span>
        <strong>{summary ? number.format(summary.total_cases) : '—'}</strong>
        <small>{summary ? `${summary.periods} complete weeks` : 'No data'}</small>
      </article>
    </section>
  )
}

