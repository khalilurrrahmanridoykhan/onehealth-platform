import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { EBSAssignmentDraft, EBSNotification, EBSOperationItem, EBSOperations } from '../types'
import { RiskBadge } from './RiskBadge'

const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const badgeRisk = (value: string | null) => value === 'CRITICAL' ? 'HIGH' : value as 'LOW' | 'MEDIUM' | 'HIGH' | null
const initialAssignment = (): EBSAssignmentDraft => ({ responsible_officer: '', due_date: '', recommended_actions: '', response_status: 'PLANNED' })
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

function DueStatus({ item }: { item: EBSOperationItem }) {
  const text = item.due_state === 'OVERDUE' ? `${Math.abs(item.days_remaining ?? 0)}d overdue`
    : item.due_state === 'DUE_TODAY' ? 'Due today'
    : item.due_state === 'DUE_SOON' ? `Due in ${item.days_remaining}d`
    : item.due_state === 'UNSCHEDULED' ? 'Not scheduled' : label(item.due_state)
  return <div><span className={`due-chip ${item.due_state.toLowerCase()}`}>{text}</span>{item.due_date && <small>{item.due_date}</small>}</div>
}

export function EBSOperationsQueue() {
  const [data, setData] = useState<EBSOperations>()
  const [notifications, setNotifications] = useState<EBSNotification[]>([])
  const [error, setError] = useState<string>()
  const [filter, setFilter] = useState('ALL')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<EBSOperationItem>()
  const [assignment, setAssignment] = useState<EBSAssignmentDraft>(initialAssignment())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>()

  const load = () => Promise.all([api.ebsOperations(), api.ebsNotifications()])
    .then(([operations, noticeData]) => { setData(operations); setNotifications(noticeData.notifications); setError(undefined) })
    .catch((reason: Error) => setError(reason.message))

  useEffect(() => {
    load()
    window.addEventListener('onehealth:registry-changed', load)
    return () => window.removeEventListener('onehealth:registry-changed', load)
  }, [])

  const visible = useMemo(() => (data?.signals ?? []).filter((item) => {
    const statusMatch = filter === 'ALL' || (filter === 'OPEN' && !item.closed) || (filter === 'OVERDUE' && item.overdue)
      || (filter === 'DUE_SOON' && ['DUE_TODAY', 'DUE_SOON'].includes(item.due_state))
      || (filter === 'HIGH_RISK' && !item.closed && ['HIGH', 'CRITICAL'].includes(item.risk_level ?? ''))
      || (filter === 'UNASSIGNED' && !item.closed && !item.responsible_officer) || (filter === 'CLOSED' && item.closed)
    const text = `${item.signal_id} ${item.title} ${item.responsible_officer ?? ''}`.toLowerCase()
    return statusMatch && text.includes(query.toLowerCase())
  }), [data, filter, query])

  const openAssignment = (item: EBSOperationItem) => {
    setSelected(item)
    setAssignment({
      responsible_officer: item.responsible_officer ?? '',
      due_date: item.due_date ?? '',
      recommended_actions: item.recommended_actions ?? '',
      response_status: (item.response_status as EBSAssignmentDraft['response_status']) ?? 'PLANNED',
    })
    setMessage(undefined)
  }

  const saveAssignment = async () => {
    if (!selected) return
    setSaving(true); setMessage(undefined)
    try {
      await api.assignOperation(selected.tracked_entity_uid, assignment)
      setMessage('Assignment saved to DHIS2.'); setSelected(undefined); await load()
      window.dispatchEvent(new Event('onehealth:registry-changed'))
    } catch (reason) { setMessage((reason as Error).message) } finally { setSaving(false) }
  }

  return <section className="panel operations-queue" id="operations-queue">
    <div className="panel-heading operations-heading"><div><p className="eyebrow">Response operations</p><h2>Operational alert queue</h2><p className="section-copy">Assign ownership, monitor deadlines and coordinate response from live DHIS2 Tracker records.</p></div><button className="export-button" type="button" disabled={!data} onClick={() => api.downloadSituationReport().catch((reason: Error) => setError(reason.message))}>Download situation report</button></div>
    {error ? <div className="registry-empty"><strong>Protected operations queue</strong><p>{error === 'Authentication required' ? 'Sign in with your DHIS2 account to manage assignments and deadlines.' : error}</p></div> : !data ? <p className="registry-message">Loading operational signals…</p> : <>
      <div className="queue-summary">
        {[['OPEN', data.summary.open], ['HIGH RISK', data.summary.high_risk], ['OVERDUE', data.summary.overdue], ['DUE SOON', data.summary.due_soon], ['UNASSIGNED', data.summary.unassigned], ['CLOSED', data.summary.closed]].map(([name, count]) => { const value = String(name).replace(' ', '_'); return <button key={name} className={`${Number(count) > 0 && ['OVERDUE', 'UNASSIGNED'].includes(String(name)) ? 'has-alert' : ''} ${filter === value ? 'active' : ''}`} type="button" onClick={() => setFilter(value)}><i aria-hidden="true" /><span>{name}</span><strong>{count}</strong><small>View queue</small></button> })}
      </div>
      <div className="operations-workspace">
        <div className="queue-main">
          <div className="queue-toolbar"><input aria-label="Search operational alerts" placeholder="Search signal, title or officer" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filter operational alerts" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ALL">All alerts</option><option value="OPEN">Open</option><option value="HIGH_RISK">High risk</option><option value="OVERDUE">Overdue</option><option value="DUE_SOON">Due soon</option><option value="UNASSIGNED">Unassigned</option><option value="CLOSED">Closed</option></select><span>{visible.length} shown</span></div>
          <div className="queue-list"><div className="queue-list-header"><span>Signal and event</span><span>Risk</span><span>Responsible officer</span><span>Deadline</span><span>Response</span></div>{visible.map((item) => <article key={item.tracked_entity_uid} className={`queue-row ${item.overdue ? 'overdue-row' : ''} ${item.closed ? 'closed-row' : ''}`}>
            <div className="signal-cell"><span className="stage-icon">{item.latest_stage === 'closure' ? '✓' : item.latest_stage === 'response' ? 'R' : item.latest_stage === 'investigation' ? 'I' : 'S'}</span><div><strong>{item.signal_id}</strong><p>{item.title}</p><small>{label(item.latest_stage)} · {item.source}</small></div></div>
            <div className="risk-cell"><RiskBadge level={badgeRisk(item.risk_level)} />{item.risk_level === 'CRITICAL' && <small>Critical</small>}</div>
            <div className="officer-cell">{item.responsible_officer ? <><span className="officer-avatar">{initials(item.responsible_officer)}</span><div><strong>{item.responsible_officer}</strong><small>Response owner</small></div></> : <><span className="officer-avatar unassigned">?</span><div><strong className="unassigned-text">Unassigned</strong><small>Needs ownership</small></div></>}</div>
            <div className="deadline-cell"><DueStatus item={item} /></div>
            <div className="response-cell"><span className={`queue-status ${item.closed ? 'closed' : ''}`}>{item.closed ? 'Closed' : item.response_status ? label(item.response_status) : 'Open'}</span><button className="row-action" type="button" disabled={item.closed} onClick={() => openAssignment(item)}>{item.responsible_officer ? 'Manage' : 'Assign owner'} <span>→</span></button></div>
          </article>)}{visible.length === 0 && <p className="empty-filter">No alerts match this view.</p>}</div>
        </div>
        <aside className="notification-centre"><div className="notification-title"><div><p className="eyebrow">Notifications</p><h3>Action required</h3></div><b>{notifications.length}</b></div>{notifications.length === 0 ? <p className="registry-message">No operational notifications.</p> : notifications.slice(0, 8).map((notice) => <button type="button" key={notice.id} className={`notification-item ${notice.severity.toLowerCase()}`} onClick={() => { const item = data.signals.find((row) => row.tracked_entity_uid === notice.tracked_entity_uid); if (item) openAssignment(item) }}><span>{notice.type === 'OVERDUE' ? '!' : notice.type === 'DUE_SOON' ? '⏱' : '○'}</span><div><strong>{notice.title}</strong><small>{notice.message}</small></div></button>)}</aside>
      </div>
    </>}
    {selected && <div className="modal-backdrop" role="presentation"><div className="assignment-modal" role="dialog" aria-modal="true" aria-labelledby="assignment-title"><div className="modal-heading"><div><p className="eyebrow">{selected.signal_id}</p><h3 id="assignment-title">Assign response ownership</h3></div><button type="button" aria-label="Close assignment" onClick={() => setSelected(undefined)}>×</button></div><label>Responsible officer<input value={assignment.responsible_officer} onChange={(event) => setAssignment({ ...assignment, responsible_officer: event.target.value })} placeholder="Officer name or team" /></label><div className="assignment-grid"><label>Due date<input type="date" value={assignment.due_date} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setAssignment({ ...assignment, due_date: event.target.value })} /></label><label>Response status<select value={assignment.response_status} onChange={(event) => setAssignment({ ...assignment, response_status: event.target.value as EBSAssignmentDraft['response_status'] })}><option value="PLANNED">Planned</option><option value="IN_PROGRESS">In progress</option><option value="ON_HOLD">On hold</option><option value="COMPLETED">Completed</option></select></label></div><label>Recommended actions<textarea value={assignment.recommended_actions} onChange={(event) => setAssignment({ ...assignment, recommended_actions: event.target.value })} placeholder="Document the actions this officer must coordinate." /></label>{message && <p className="form-message">{message}</p>}<div className="modal-actions"><button type="button" onClick={() => setSelected(undefined)}>Cancel</button><button type="button" disabled={saving || !assignment.responsible_officer || !assignment.due_date || !assignment.recommended_actions} onClick={saveAssignment}>{saving ? 'Saving…' : 'Save assignment to DHIS2'}</button></div></div></div>}
  </section>
}
