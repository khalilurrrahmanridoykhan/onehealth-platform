import type { Alert, OverviewItem } from '../types'

interface Props {
  summary?: OverviewItem
  alert?: Alert
  metricLabel: string
  periodLabel: string
}

const number = new Intl.NumberFormat('en-US')

export function SummaryCards({ summary, alert, metricLabel, periodLabel }: Props) {
  const change = alert && alert.expected_cases
    ? ((alert.observed_cases - alert.expected_cases) / alert.expected_cases) * 100
    : null

  return (
    <section className="summary-grid" aria-label="Surveillance summary">
      <article className="metric-card metric-primary">
        <span>{periodLabel === 'week' ? `Latest weekly ${metricLabel}` : `Latest ${periodLabel} ${metricLabel}`}</span>
        <strong>{summary ? number.format(summary.latest_cases) : '—'}</strong>
        <small>{summary?.latest_period ?? 'No reporting period'}</small>
      </article>
      <article className="metric-card">
        <span>Expected {metricLabel}</span>
        <strong>{alert ? number.format(Math.round(alert.expected_cases)) : '—'}</strong>
        <small>Previous four-period mean</small>
      </article>
      <article className="metric-card">
        <span>Change from baseline</span>
        <strong className={change !== null && change > 0 ? 'text-alert' : 'text-stable'}>
          {change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}
        </strong>
        <small>Latest complete {periodLabel}</small>
      </article>
      <article className="metric-card">
        <span>Total observed {metricLabel}</span>
        <strong>{summary ? number.format(summary.total_cases) : '—'}</strong>
        <small>{summary ? `${summary.periods} complete periods` : 'No data'}</small>
      </article>
    </section>
  )
}
