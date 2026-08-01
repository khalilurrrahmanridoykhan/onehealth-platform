import type { Alert } from '../types'
import { RiskBadge } from './RiskBadge'

export function AlertPanel({ alert }: { alert?: Alert }) {
  return (
    <aside className="panel alert-panel">
      <div className="panel-heading alert-heading">
        <div>
          <p className="eyebrow">Early warning</p>
          <h2>Latest assessment</h2>
        </div>
        <RiskBadge level={alert?.risk_level ?? null} />
      </div>
      {alert ? (
        <>
          <div className="confidence-row">
            <span>Model confidence heuristic</span>
            <strong>{Math.round(alert.confidence * 100)}%</strong>
          </div>
          <div className="forecast-strip">
            <div><span>Next-week outlook</span><strong>{Math.round(alert.predicted_cases).toLocaleString()}</strong></div>
            <div><span>Four-week baseline</span><strong>{Math.round(alert.expected_cases).toLocaleString()}</strong></div>
          </div>
          <div>
            <h3>Why this status?</h3>
            <ul className="reason-list">
              {alert.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </div>
          <div>
            <h3>Recommended actions</h3>
            <ol className="action-list">
              {alert.recommended_actions.map((action) => <li key={action}>{action}</li>)}
            </ol>
          </div>
          <p className="disclaimer">Practice threshold only. Verify signals before operational action.</p>
          <a className="response-link" href="#ebs">Open response workflow →</a>
        </>
      ) : <p className="empty-state">No alert is available for this location.</p>}
    </aside>
  )
}
