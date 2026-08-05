import type { SurveillanceRecord } from '../types'

const number = new Intl.NumberFormat('en-US')

export function NationalEvidencePanel({ records, diseaseName, metricLabel }: { records: SurveillanceRecord[]; diseaseName: string; metricLabel: string }) {
  const first = records[0]
  const latest = records[records.length - 1]
  const peak = records.reduce((best, record) => record.cases > best.cases ? record : best, first)
  return <section className="panel national-evidence" id="geography">
    <div className="panel-heading"><div><p className="eyebrow">National evidence coverage</p><h2>Bangladesh annual reporting series</h2></div><span className="source-label">WHO Global Health Observatory</span></div>
    <div className="national-evidence-grid">
      <div className="national-emblem" aria-hidden="true"><span>BD</span></div>
      <div><span>Geographic resolution</span><strong>National only</strong><small>No public division or district series is inferred</small></div>
      <div><span>Coverage period</span><strong>{first?.period_label}–{latest?.period_label}</strong><small>{records.length} annual observations</small></div>
      <div><span>Peak reported burden</span><strong>{peak ? number.format(peak.cases) : '—'}</strong><small>{peak?.period_label} · {metricLabel}</small></div>
      <div><span>Evidence use</span><strong>Historical monitoring</strong><small>{diseaseName} · no automated outbreak alert</small></div>
    </div>
  </section>
}
