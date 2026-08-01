import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { EBSPreview, EBSSignalDraft, EBSStage, EBSStagePreview, Location } from '../types'

const today = () => new Date().toISOString().slice(0, 10)
const INITIAL_SIGNAL: EBSSignalDraft = {
  signal_id: '', title: '', source: '', signal_type: 'CLUSTER', description: '',
  location_code: 'BD-DHA', detected_on: today(),
}

const FIELD_OPTIONS: Record<string, string[]> = {
  verification_status: ['VERIFIED', 'DISCARDED', 'PENDING'],
  likelihood_score: ['1', '2', '3', '4', '5'],
  impact_score: ['1', '2', '3', '4', '5'],
  risk_level: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  investigation_status: ['PLANNED', 'IN_PROGRESS', 'COMPLETED'],
  samples_collected: ['NO', 'YES'],
  response_status: ['PLANNED', 'IN_PROGRESS', 'COMPLETED'],
}

const stageLabel = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const fieldLabel = (value: string) => stageLabel(value)

export function EBSWorkspace({ locations }: { locations: Location[] }) {
  const [stages, setStages] = useState<EBSStage[]>([])
  const [signal, setSignal] = useState(INITIAL_SIGNAL)
  const [signalPreview, setSignalPreview] = useState<EBSPreview>()
  const [activeStage, setActiveStage] = useState('detection')
  const [stageValues, setStageValues] = useState<Record<string, string>>({})
  const [stagePreview, setStagePreview] = useState<EBSStagePreview>()
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.ebsSchema().then((response) => setStages(response.stages)).catch((reason: Error) => setError(reason.message))
  }, [])

  const selectedStage = useMemo(() => stages.find((stage) => stage.code === activeStage), [stages, activeStage])

  const previewSignal = (event: FormEvent) => {
    event.preventDefault(); setSubmitting(true); setError(undefined)
    api.previewSignal(signal).then((result) => {
      setSignalPreview(result); setStagePreview(undefined)
    }).catch((reason: Error) => setError(reason.message)).finally(() => setSubmitting(false))
  }

  const previewStage = (event: FormEvent) => {
    event.preventDefault()
    if (!signalPreview || !selectedStage) return
    setSubmitting(true); setError(undefined)
    const values = Object.fromEntries(Object.entries(stageValues).filter(([, value]) => value !== ''))
    api.previewStage({
      stage: selectedStage.code,
      enrollment_uid: signalPreview.bundle.enrollments[0].enrollment,
      location_code: signal.location_code,
      occurred_on: today(),
      values,
    }).then(setStagePreview).catch((reason: Error) => setError(reason.message)).finally(() => setSubmitting(false))
  }

  const updateSignal = (field: keyof EBSSignalDraft, value: string) => {
    setSignal((current) => ({ ...current, [field]: value })); setSignalPreview(undefined); setStagePreview(undefined); setActiveStage('detection')
  }

  const chooseStage = (code: string) => {
    if (code !== 'detection' && !signalPreview) return
    setActiveStage(code); setStageValues({}); setStagePreview(undefined); setError(undefined)
  }

  return (
    <section className="panel ebs-panel" id="ebs">
      <div className="panel-heading"><div><p className="eyebrow">Event-based surveillance</p><h2>Signal workflow</h2></div><span className="preview-badge">Preview mode</span></div>
      <div className="workflow-steps" aria-label="EBS workflow stages">
        {stages.map((stage, index) => (
          <button type="button" className={`workflow-step ${activeStage === stage.code ? 'active' : ''}`} key={stage.code} onClick={() => chooseStage(stage.code)} disabled={stage.code !== 'detection' && !signalPreview}>
            <span>{index + 1}</span><div><strong>{stageLabel(stage.code)}</strong><small>{stage.required_fields.length} required fields{stage.repeatable ? ' · repeatable' : ''}</small></div>
          </button>
        ))}
      </div>
      {activeStage === 'detection' ? (
        <form className="ebs-form" onSubmit={previewSignal}>
          <label>Signal ID<input required minLength={3} value={signal.signal_id} onChange={(event) => updateSignal('signal_id', event.target.value)} placeholder="EBS-2026-0001" /></label>
          <label>Title<input required minLength={3} value={signal.title} onChange={(event) => updateSignal('title', event.target.value)} placeholder="Unusual fever cluster" /></label>
          <label>Source<input required minLength={2} value={signal.source} onChange={(event) => updateSignal('source', event.target.value)} placeholder="Community health worker" /></label>
          <label>Signal type<select value={signal.signal_type} onChange={(event) => updateSignal('signal_type', event.target.value)}><option value="CLUSTER">Disease cluster</option><option value="UNUSUAL_DEATH">Unusual death</option><option value="ANIMAL_EVENT">Animal health event</option><option value="ENVIRONMENTAL_EVENT">Environmental event</option></select></label>
          <label>Location<select value={signal.location_code} onChange={(event) => updateSignal('location_code', event.target.value)}>{locations.map((location) => <option key={location.code} value={location.code}>{location.name}</option>)}</select></label>
          <label>Detected on<input required type="date" value={signal.detected_on} onChange={(event) => updateSignal('detected_on', event.target.value)} /></label>
          <label className="full-width">Description<textarea required minLength={5} value={signal.description} onChange={(event) => updateSignal('description', event.target.value)} placeholder="Describe the unusual event without patient identifiers." /></label>
          <div className="form-actions full-width"><p>No data is written to DHIS2 in preview mode.</p><button type="submit" disabled={submitting}>{submitting ? 'Building preview…' : 'Preview Tracker signal'}</button></div>
        </form>
      ) : selectedStage && signalPreview ? (
        <form className="ebs-form stage-form" onSubmit={previewStage}>
          <div className="stage-context full-width"><strong>{stageLabel(selectedStage.code)}</strong><span>Enrollment {signalPreview.bundle.enrollments[0].enrollment} · {signal.signal_id}</span></div>
          {selectedStage.fields.map((field) => (
            <label className={['verification_notes', 'findings', 'recommended_actions', 'outcome', 'lessons_learned'].includes(field) ? 'full-width' : ''} key={field}>
              {fieldLabel(field)}{selectedStage.required_fields.includes(field) ? ' *' : ''}
              {FIELD_OPTIONS[field] ? (
                <select required={selectedStage.required_fields.includes(field)} value={stageValues[field] ?? ''} onChange={(event) => setStageValues((current) => ({ ...current, [field]: event.target.value }))}>
                  <option value="">Select…</option>{FIELD_OPTIONS[field].map((option) => <option key={option} value={option}>{stageLabel(option.toLowerCase())}</option>)}
                </select>
              ) : field.endsWith('_date') || field === 'due_date' ? (
                <input type="date" required={selectedStage.required_fields.includes(field)} value={stageValues[field] ?? ''} onChange={(event) => setStageValues((current) => ({ ...current, [field]: event.target.value }))} />
              ) : (
                <textarea required={selectedStage.required_fields.includes(field)} value={stageValues[field] ?? ''} onChange={(event) => setStageValues((current) => ({ ...current, [field]: event.target.value }))} />
              )}
            </label>
          ))}
          <div className="form-actions full-width"><p>Preview only · no DHIS2 write</p><button type="submit" disabled={submitting}>{submitting ? 'Building preview…' : `Preview ${stageLabel(selectedStage.code)}`}</button></div>
        </form>
      ) : null}
      {error && <div className="form-error" role="alert">{error}</div>}
      {signalPreview && activeStage === 'detection' && <div className="preview-result" role="status"><strong>Tracker bundle ready</strong><span>1 tracked entity · 1 enrollment · 1 completed detection event</span><code>Enrollment: {signalPreview.bundle.enrollments[0].enrollment}</code></div>}
      {stagePreview && <div className="preview-result" role="status"><strong>{stageLabel(stagePreview.stage)} event ready</strong><span>{stagePreview.bundle.events[0].dataValues.length} field values · completed event</span><code>Event: {stagePreview.bundle.events[0].event}</code></div>}
    </section>
  )
}
