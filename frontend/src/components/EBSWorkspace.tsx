import { type FormEvent, useEffect, useState } from 'react'
import { api } from '../api'
import type { EBSPreview, EBSSignalDraft, EBSStage, Location } from '../types'

const INITIAL_SIGNAL: EBSSignalDraft = {
  signal_id: '',
  title: '',
  source: '',
  signal_type: 'CLUSTER',
  description: '',
  location_code: 'BD-DHA',
  detected_on: new Date().toISOString().slice(0, 10),
}

const stageLabel = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

export function EBSWorkspace({ locations }: { locations: Location[] }) {
  const [stages, setStages] = useState<EBSStage[]>([])
  const [signal, setSignal] = useState(INITIAL_SIGNAL)
  const [preview, setPreview] = useState<EBSPreview>()
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.ebsSchema().then((response) => setStages(response.stages)).catch((reason: Error) => setError(reason.message))
  }, [])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(undefined)
    api.previewSignal(signal)
      .then(setPreview)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setSubmitting(false))
  }

  const update = (field: keyof EBSSignalDraft, value: string) => {
    setSignal((current) => ({ ...current, [field]: value }))
    setPreview(undefined)
  }

  return (
    <section className="panel ebs-panel" id="ebs">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Event-based surveillance</p>
          <h2>Signal workflow</h2>
        </div>
        <span className="preview-badge">Preview mode</span>
      </div>
      <div className="workflow-steps" aria-label="EBS workflow stages">
        {stages.map((stage, index) => (
          <div className="workflow-step" key={stage.code}>
            <span>{index + 1}</span>
            <div><strong>{stageLabel(stage.code)}</strong><small>{stage.required_fields.length} required fields{stage.repeatable ? ' · repeatable' : ''}</small></div>
          </div>
        ))}
      </div>
      <form className="ebs-form" onSubmit={submit}>
        <label>Signal ID<input required minLength={3} value={signal.signal_id} onChange={(event) => update('signal_id', event.target.value)} placeholder="EBS-2026-0001" /></label>
        <label>Title<input required minLength={3} value={signal.title} onChange={(event) => update('title', event.target.value)} placeholder="Unusual fever cluster" /></label>
        <label>Source<input required minLength={2} value={signal.source} onChange={(event) => update('source', event.target.value)} placeholder="Community health worker" /></label>
        <label>Signal type<select value={signal.signal_type} onChange={(event) => update('signal_type', event.target.value)}><option value="CLUSTER">Disease cluster</option><option value="UNUSUAL_DEATH">Unusual death</option><option value="ANIMAL_EVENT">Animal health event</option><option value="ENVIRONMENTAL_EVENT">Environmental event</option></select></label>
        <label>Location<select value={signal.location_code} onChange={(event) => update('location_code', event.target.value)}>{locations.map((location) => <option key={location.code} value={location.code}>{location.name}</option>)}</select></label>
        <label>Detected on<input required type="date" value={signal.detected_on} onChange={(event) => update('detected_on', event.target.value)} /></label>
        <label className="full-width">Description<textarea required minLength={5} value={signal.description} onChange={(event) => update('description', event.target.value)} placeholder="Describe the unusual event without patient identifiers." /></label>
        <div className="form-actions full-width">
          <p>No data is written to DHIS2 in preview mode.</p>
          <button type="submit" disabled={submitting}>{submitting ? 'Building preview…' : 'Preview Tracker signal'}</button>
        </div>
      </form>
      {error && <div className="form-error" role="alert">{error}</div>}
      {preview && (
        <div className="preview-result" role="status">
          <strong>Tracker bundle ready</strong>
          <span>1 tracked entity · 1 enrollment · 1 completed detection event</span>
          <code>Org unit: {preview.bundle.events[0].orgUnit}</code>
        </div>
      )}
    </section>
  )
}

