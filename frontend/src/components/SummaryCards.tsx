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
  const isRabies = diseaseCode === 'RABIES'
  const isNationalWHO = isRabies || diseaseCode === 'MALARIA'
  const cfr = summary?.total_cases && summary.total_deaths
    ? (summary.total_deaths / summary.total_cases) * 100
    : null

  return (
    <section className="summary-grid" aria-label="Surveillance summary">
      <article className="metric-card metric-primary">
        <span>{periodLabel === 'week' ? `Latest weekly ${metricLabel}` : `Latest ${periodLabel} ${metricLabel}`}</span>
        <strong>{summary ? number.format(summary.latest_cases) : '—'}</strong>
        <small>{diseaseCode === 'JE' && summary?.latest_period === '2016' ? '2016 · January–July partial' : summary?.latest_period ?? 'No reporting period'}</small>
      </article>
      <article className="metric-card">
        <span>{isNipah ? 'Latest reported deaths' : isNationalWHO ? 'Geographic resolution' : `Expected ${metricLabel}`}</span>
        <strong>{isNipah ? number.format(summary?.latest_deaths ?? 0) : isNationalWHO ? 'National' : alert ? number.format(Math.round(alert.expected_cases)) : '—'}</strong>
        <small>{isNipah ? summary?.latest_period : isRabies ? 'WHO GHO NTD_RAB2' : diseaseCode === 'MALARIA' ? 'WHO GHO confirmed cases' : 'Previous four-period mean'}</small>
      </article>
      <article className="metric-card">
        <span>{isNipah ? 'Cumulative case fatality' : isNationalWHO ? 'Observed annual series' : 'Change from baseline'}</span>
        <strong className={change !== null && change > 0 ? 'text-alert' : 'text-stable'}>
          {isNipah ? cfr === null ? '—' : `${cfr.toFixed(1)}%` : isNationalWHO ? `${summary?.periods ?? 0} years` : change === null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}
        </strong>
        <small>{isNipah ? `${number.format(summary?.total_deaths ?? 0)} deaths` : isNationalWHO ? '2015–2024 historical reporting' : `Latest complete ${periodLabel}`}</small>
      </article>
      <article className="metric-card">
        <span>Total observed {metricLabel}</span>
        <strong>{summary ? number.format(summary.total_cases) : '—'}</strong>
        <small>{summary ? diseaseCode === 'JE' ? `${summary.periods} reported periods · hospital sentinel data` : `${summary.periods} complete periods` : 'No data'}</small>
      </article>
    </section>
  )
}
