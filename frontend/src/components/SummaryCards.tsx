import type { Alert, OverviewItem } from '../types'

interface Props {
  summary?: OverviewItem
  alert?: Alert
  metricLabel: string
  periodLabel: string
  diseaseCode: string
}

const number = new Intl.NumberFormat('en-US')

export function SummaryCards({ summary, alert, metricLabel, periodLabel, diseaseCode }: Props) {
  const change = alert && alert.expected_cases
    ? ((alert.observed_cases - alert.expected_cases) / alert.expected_cases) * 100
    : null
  const isNipah = diseaseCode === 'NIPAH'
  const cfr = summary?.total_cases && summary.total_deaths
    ? (summary.total_deaths / summary.total_cases) * 100
    : null

  return (
    <section className="summary-grid" aria-label="Surveillance summary">
      <article className="metric-card metric-primary">
        <span>{periodLabel === 'week' ? `Latest weekly ${metricLabel}` : `Latest ${periodLabel} ${metricLabel}`}</span>
        <strong>{summary ? number.format(summary.latest_cases) : '—'}</strong>
        <small>{summary?.latest_period ?? 'No reporting period'}</small>
      </article>
      <article className="metric-card">
        <span>{isNipah ? 'Latest reported deaths' : `Expected ${metricLabel}`}</span>
        <strong>{isNipah ? number.format(summary?.latest_deaths ?? 0) : alert ? number.format(Math.round(alert.expected_cases)) : '—'}</strong>
        <small>{isNipah ? summary?.latest_period : 'Previous four-period mean'}</small>
      </article>
      <article className="metric-card">
        <span>{isNipah ? 'Cumulative case fatality' : 'Change from baseline'}</span>
        <strong className={change !== null && change > 0 ? 'text-alert' : 'text-stable'}>
          {isNipah ? cfr === null ? '—' : `${cfr.toFixed(1)}%` : change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}
        </strong>
        <small>{isNipah ? `${number.format(summary?.total_deaths ?? 0)} deaths` : `Latest complete ${periodLabel}`}</small>
      </article>
      <article className="metric-card">
        <span>Total observed {metricLabel}</span>
        <strong>{summary ? number.format(summary.total_cases) : '—'}</strong>
        <small>{summary ? `${summary.periods} complete periods` : 'No data'}</small>
      </article>
    </section>
  )
}
