import type {
  Alert,
  EBSPreview,
  EBSConnectionStatus,
  EBSCommitResult,
  EBSOperations,
  EBSNotifications,
  EBSAssignmentDraft,
  EBSSavedSignal,
  EBSSignalDetail,
  EBSSignalDraft,
  EBSStage,
  EBSStageDraft,
  EBSStagePreview,
  Disease,
  Location,
  OverviewItem,
  SurveillanceRecord,
} from './types'

async function getJson<T>(path: string): Promise<T> {
  const token = localStorage.getItem('onehealth_session')
  const response = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(body?.detail ?? `Request failed with HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const token = localStorage.getItem('onehealth_session')
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(body?.detail ?? `Request failed with HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

export const api = {
  login: (username: string, password: string) => postJson<{ access_token: string; user: { username: string; role: string } }>('/api/v1/auth/login', { username, password }),
  me: () => getJson<{ username: string; role: string }>('/api/v1/auth/me'),
  diseases: () => getJson<Disease[]>('/api/v1/diseases'),
  locations: (diseaseCode: string) => getJson<Location[]>(`/api/v1/locations?disease_code=${encodeURIComponent(diseaseCode)}`),
  overview: (diseaseCode: string) => getJson<OverviewItem[]>(`/api/v1/overview/${encodeURIComponent(diseaseCode)}`),
  trend: (diseaseCode: string, locationCode: string) =>
    getJson<SurveillanceRecord[]>(
      `/api/v1/trends/${encodeURIComponent(diseaseCode)}?location_code=${encodeURIComponent(locationCode)}`,
    ),
  alert: (diseaseCode: string, locationCode: string) =>
    getJson<Alert>(
      `/api/v1/alerts/${encodeURIComponent(diseaseCode)}/latest?location_code=${encodeURIComponent(locationCode)}`,
    ),
  ebsSchema: () => getJson<{ stages: EBSStage[] }>('/api/v1/ebs/schema'),
  previewSignal: (signal: EBSSignalDraft) =>
    postJson<EBSPreview>('/api/v1/ebs/signals/preview', signal),
  previewStage: (stage: EBSStageDraft) =>
    postJson<EBSStagePreview>('/api/v1/ebs/stages/preview', stage),
  commitSignal: (signal: EBSSignalDraft) =>
    postJson<EBSCommitResult>('/api/v1/ebs/signals', signal),
  commitStage: (stage: EBSStageDraft) =>
    postJson<EBSCommitResult>('/api/v1/ebs/stages', stage),
  ebsStatus: () => getJson<EBSConnectionStatus>('/api/v1/ebs/status'),
  ebsOperations: () => getJson<EBSOperations>('/api/v1/ebs/operations'),
  ebsNotifications: () => getJson<EBSNotifications>('/api/v1/ebs/notifications'),
  assignOperation: (trackedEntityUid: string, assignment: EBSAssignmentDraft) =>
    postJson<{ mode: 'COMMITTED'; event_uid: string }>(`/api/v1/ebs/operations/${encodeURIComponent(trackedEntityUid)}/assignment`, assignment),
  downloadSituationReport: async () => {
    const token = localStorage.getItem('onehealth_session')
    const response = await fetch('/api/v1/ebs/reports/situation.csv', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (!response.ok) throw new Error(`Report download failed with HTTP ${response.status}`)
    const blob = await response.blob()
    const disposition = response.headers.get('Content-Disposition') ?? ''
    const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] ?? 'onehealth-ebs-situation.csv'
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url)
  },
  savedSignals: (query = '') =>
    getJson<{ signals: EBSSavedSignal[] }>(`/api/v1/ebs/signals?q=${encodeURIComponent(query)}`),
  savedSignal: (trackedEntityUid: string) =>
    getJson<EBSSignalDetail>(`/api/v1/ebs/signals/${encodeURIComponent(trackedEntityUid)}`),
}
