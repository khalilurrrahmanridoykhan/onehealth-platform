import { useEffect, useState } from 'react'
import { api } from '../api'
import type { EBSOperations } from '../types'
import { RiskBadge } from './RiskBadge'

const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
const badgeRisk = (value: string | null) => value === 'CRITICAL' ? 'HIGH' : value as 'LOW' | 'MEDIUM' | 'HIGH' | null

export function EBSOperationsQueue() {
  const [data, setData] = useState<EBSOperations>()
  const [error, setError] = useState<string>()
  const load = () => api.ebsOperations().then(setData).catch((reason: Error) => setError(reason.message))

  useEffect(() => {
    load()
    window.addEventListener('onehealth:registry-changed', load)
    return () => window.removeEventListener('onehealth:registry-changed', load)
  }, [])

  const exportCsv = () => {
    if (!data) return
    const headers = ['Signal ID', 'Title', 'Stage', 'Risk', 'Officer', 'Due date', 'Response status', 'Overdue', 'Closed']
    const rows = data.signals.map((item) => [item.signal_id, item.title, label(item.latest_stage), item.risk_level, item.responsible_officer, item.due_date, item.response_status, item.overdue, item.closed])
    const blob = new Blob([[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a')
    link.href = url; link.download = `onehealth-ebs-situation-${data.generated_at}.csv`; link.click(); URL.revokeObjectURL(url)
  }

  return <section className="panel operations-queue" id="operations-queue">
    <div className="panel-heading"><div><p className="eyebrow">Response operations</p><h2>EBS signal command queue</h2></div>{data && <button className="export-button" type="button" onClick={exportCsv}>Export situation report</button>}</div>
    {error ? <div className="registry-empty"><strong>Protected operations queue</strong><p>{error === 'Authentication required' ? 'Sign in with your DHIS2 account to view assignments, deadlines, and signal status.' : error}</p></div> : !data ? <p className="registry-message">Loading operational signals…</p> : <>
      <div className="queue-summary"><div><span>Open</span><strong>{data.summary.open}</strong></div><div><span>High risk</span><strong>{data.summary.high_risk}</strong></div><div className={data.summary.overdue ? 'has-alert' : ''}><span>Overdue</span><strong>{data.summary.overdue}</strong></div><div><span>Closed</span><strong>{data.summary.closed}</strong></div></div>
      <div className="table-scroll"><table><thead><tr><th>Signal</th><th>Stage</th><th>Risk</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead><tbody>{data.signals.map((item) => <tr key={item.tracked_entity_uid} className={item.overdue ? 'overdue-row' : ''}><td><strong>{item.signal_id}</strong><small>{item.title}</small></td><td>{label(item.latest_stage)}</td><td><RiskBadge level={badgeRisk(item.risk_level)} /></td><td>{item.responsible_officer ?? 'Unassigned'}</td><td>{item.due_date ?? '—'}{item.overdue && <b className="overdue-label">Overdue</b>}</td><td><span className={`queue-status ${item.closed ? 'closed' : ''}`}>{item.closed ? 'Closed' : item.response_status ? label(item.response_status) : 'Open'}</span></td></tr>)}</tbody></table></div>
    </>}
  </section>
}
