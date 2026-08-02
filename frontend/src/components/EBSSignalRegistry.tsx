import { type FormEvent, useEffect, useState } from 'react'
import { api } from '../api'
import type { EBSConnectionStatus, EBSSavedSignal, EBSSignalDetail } from '../types'

const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const displayDate = (value: string | null) => value ? value.slice(0, 10) : 'Not recorded'

export function EBSSignalRegistry() {
  const [status, setStatus] = useState<EBSConnectionStatus>()
  const [signals, setSignals] = useState<EBSSavedSignal[]>([])
  const [selected, setSelected] = useState<EBSSignalDetail>()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const loadSignals = (search = '') => {
    setLoading(true); setError(undefined)
    api.savedSignals(search).then((response) => setSignals(response.signals)).catch((reason: Error) => setError(reason.message)).finally(() => setLoading(false))
  }

  useEffect(() => {
    api.ebsStatus().then((result) => {
      setStatus(result)
      if (result.dhis2_configured && result.reads_enabled) loadSignals()
      else setLoading(false)
    }).catch((reason: Error) => { setError(reason.message); setLoading(false) })
  }, [])

  useEffect(() => {
    const refresh = () => { if (status?.dhis2_configured && status.reads_enabled) loadSignals(query) }
    window.addEventListener('onehealth:registry-changed', refresh)
    return () => window.removeEventListener('onehealth:registry-changed', refresh)
  }, [status, query])

  const search = (event: FormEvent) => { event.preventDefault(); loadSignals(query) }
  const openSignal = (uid: string) => {
    setError(undefined)
    api.savedSignal(uid).then(setSelected).catch((reason: Error) => setError(reason.message))
  }

  return (
    <section className="panel registry-panel" id="ebs-registry">
      <div className="panel-heading">
        <div><p className="eyebrow">DHIS2 Tracker registry</p><h2>Saved EBS signals</h2></div>
        <span className={`connection-badge ${status?.dhis2_configured && status.reads_enabled ? 'connected' : ''}`}>{status?.dhis2_configured && status.reads_enabled ? 'Read access enabled' : 'Read access disabled'}</span>
      </div>
      {(!status?.dhis2_configured || !status.reads_enabled) && !loading ? (
        <div className="registry-empty"><strong>Protected DHIS2 registry</strong><p>Configure DHIS2 and explicitly enable registry reads only behind appropriate access control. The dashboard does not include demonstration signals or expose credentials.</p></div>
      ) : (
        <div className="registry-layout">
          <div className="signal-list">
            <form className="registry-search" onSubmit={search}><label htmlFor="signal-search">Search signal ID, title, or source</label><div><input id="signal-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved signals" /><button type="submit">Search</button></div></form>
            <div className="signal-scroll">{loading ? <p className="registry-message">Loading saved Tracker signals…</p> : signals.length === 0 ? <p className="registry-message">No matching signals found.</p> : signals.map((signal) => (
              <button type="button" className={`signal-row ${selected?.tracked_entity_uid === signal.tracked_entity_uid ? 'selected' : ''}`} key={signal.tracked_entity_uid} onClick={() => openSignal(signal.tracked_entity_uid)}>
                <span><strong>{signal.signal_id}</strong><small>{signal.title}</small></span><time>{displayDate(signal.updated_at)}</time>
              </button>
            ))}</div>
          </div>
          <div className="signal-detail">
            {selected ? <><div className="signal-detail-heading"><div><span>{selected.signal_id}</span><h3>{selected.title}</h3><p>{selected.source}</p></div><code>{selected.tracked_entity_uid}</code></div><ol className="event-timeline">{selected.events.map((event) => <li key={event.event_uid}><span /><div><strong>{label(event.stage)}</strong><small>{displayDate(event.occurred_at)} · {event.status}</small>{Object.entries(event.values).map(([key, value]) => <p key={key}><b>{label(key)}:</b> {String(value)}</p>)}</div></li>)}</ol></> : <div className="registry-empty"><strong>Select a saved signal</strong><p>Its enrollment stages and audit history will appear here.</p></div>}
          </div>
        </div>
      )}
      {error && <div className="form-error" role="alert">{error}</div>}
    </section>
  )
}
