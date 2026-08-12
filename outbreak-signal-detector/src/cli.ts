import { detectAll, type DetectOptions, DEFAULT_DETECT_OPTIONS } from './algorithm'
import { fetchWeeklyCounts } from './dataClient'
import type { Alert } from './types'

function formatAlert(country: string, alert: Alert): string {
  const marker = alert.isAlarm ? 'ALARM' : alert.guardBlocked ? 'guard-blocked' : 'normal'
  return (
    `[${marker}] ${country} week of ${alert.weekStart}: observed=${alert.observed}, ` +
    `expected=${alert.expected.toFixed(1)}, upperBound=${alert.upperBound.toFixed(1)}, ` +
    `ratio=${alert.ratio === Infinity ? '∞' : alert.ratio.toFixed(2)}x, ` +
    `recent4wk=${alert.recentFourWeekTotal}`
  )
}

async function main() {
  const countries = (process.env.COUNTRIES ?? 'United Kingdom')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
  const showAll = process.env.SHOW_ALL === 'true'
  const options: DetectOptions = {
    ...DEFAULT_DETECT_OPTIONS,
    baselineWeeks: process.env.BASELINE_WEEKS ? Number(process.env.BASELINE_WEEKS) : DEFAULT_DETECT_OPTIONS.baselineWeeks,
    alpha: process.env.ALPHA ? Number(process.env.ALPHA) : DEFAULT_DETECT_OPTIONS.alpha,
  }

  for (const country of countries) {
    console.log(`\nFetching real weekly case data for "${country}" from Our World in Data ...`)
    const series = await fetchWeeklyCounts(country)
    console.log(`Fetched ${series.length} weekly data points (${series[0].weekStart} to ${series[series.length - 1].weekStart}).`)

    const alerts = detectAll(series, options)
    const alarms = alerts.filter((a) => a.isAlarm)

    console.log(`\nEvaluated ${alerts.length} weeks -- ${alarms.length} alarm(s) raised.`)
    for (const alert of showAll ? alerts : alarms) {
      console.log(formatAlert(country, alert))
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
