import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SurveillanceRecord } from '../types'

export function TrendChart({ records }: { records: SurveillanceRecord[] }) {
  const data = records.map((record) => ({
    period: record.period_label.replace(/^\d{4}-/, ''),
    cases: record.cases,
  }))

  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Epidemic curve</p>
          <h2>Weekly admitted dengue cases</h2>
        </div>
        <span className="source-label">DGHS aggregate surveillance</span>
      </div>
      <div className="chart-wrap" aria-label="Weekly dengue trend chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 18, left: -12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="4 5" vertical={false} stroke="#dce8e3" />
            <XAxis dataKey="period" tick={{ fill: '#60756d', fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#60756d', fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #dce8e3' }} />
            <Line type="monotone" dataKey="cases" stroke="#087f5b" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

