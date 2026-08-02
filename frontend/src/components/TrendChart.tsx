import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Alert, SurveillanceRecord } from '../types'

export function TrendChart({ records, alert, diseaseName }: { records: SurveillanceRecord[]; alert?: Alert; diseaseName: string }) {
  const data: Array<{ period: string; cases: number | null; forecast: number | null; baseline: number | null }> = records.map((record) => ({
    period: record.period_label.replace(/^\d{4}-/, ''),
    cases: record.cases,
    forecast: null as number | null,
    baseline: null as number | null,
  }))
  if (alert && data.length) {
    data[data.length - 1].forecast = alert.observed_cases
    data.push({
      period: 'Next',
      cases: null,
      forecast: alert.predicted_cases,
      baseline: alert.expected_cases,
    })
  }

  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Epidemic curve</p>
          <h2>Observed trend and next-week outlook</h2>
        </div>
        <span className="source-label">DGHS aggregate surveillance</span>
      </div>
      <div className="chart-wrap" aria-label={`Weekly ${diseaseName} trend chart`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 18, left: -12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="4 5" vertical={false} stroke="#dce8e3" />
            <XAxis dataKey="period" tick={{ fill: '#60756d', fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#60756d', fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #dce8e3' }} />
            <Line name="Observed cases" type="monotone" dataKey="cases" stroke="#087f5b" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
            <Line name="Heuristic forecast" type="monotone" dataKey="forecast" stroke="#d97706" strokeWidth={3} strokeDasharray="6 4" connectNulls={false} dot={{ r: 4 }} />
            <Line name="Four-week baseline" type="monotone" dataKey="baseline" stroke="#7c8f88" strokeWidth={2} strokeDasharray="3 4" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
