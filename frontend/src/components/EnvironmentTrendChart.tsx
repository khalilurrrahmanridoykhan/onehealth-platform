import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { EnvironmentMonthlyRecord } from '../types'

interface Props {
  records: EnvironmentMonthlyRecord[]
  districtName: string
}

export function EnvironmentTrendChart({ records, districtName }: Props) {
  const data = records.map((record) => ({
    period: record.period_label,
    temp: record.mean_temp_c,
    maxTemp: record.mean_max_temp_c,
    precip: record.total_precip_mm,
  }))

  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Climate trend</p>
          <h2>Monthly temperature and precipitation</h2>
        </div>
        <span className="source-label">NASA POWER reanalysis</span>
      </div>
      <div className="chart-wrap" aria-label={`${districtName} monthly climate trend chart`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 18, left: -12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="4 5" vertical={false} stroke="#dce8e3" />
            <XAxis dataKey="period" tick={{ fill: '#60756d', fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#60756d', fontSize: 12 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #dce8e3' }} />
            <Line name="Mean temperature (°C)" type="monotone" dataKey="temp" stroke="#b42318" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
            <Line name="Mean max temperature (°C)" type="monotone" dataKey="maxTemp" stroke="#d97706" strokeWidth={2} strokeDasharray="6 4" dot={false} />
            <Line name="Total precipitation (mm)" type="monotone" dataKey="precip" stroke="#1d4ed8" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
