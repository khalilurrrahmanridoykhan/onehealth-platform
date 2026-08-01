import type {
  Alert,
  EBSPreview,
  EBSConnectionStatus,
  EBSSavedSignal,
  EBSSignalDetail,
  EBSSignalDraft,
  EBSStage,
  EBSStageDraft,
  EBSStagePreview,
  Location,
  OverviewItem,
  SurveillanceRecord,
} from './types'

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(body?.detail ?? `Request failed with HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(body?.detail ?? `Request failed with HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

export const api = {
  locations: () => getJson<Location[]>('/api/v1/locations?disease_code=DENGUE'),
  overview: () => getJson<OverviewItem[]>('/api/v1/overview/DENGUE'),
  trend: (locationCode: string) =>
    getJson<SurveillanceRecord[]>(
      `/api/v1/trends/DENGUE?location_code=${encodeURIComponent(locationCode)}`,
    ),
  alert: (locationCode: string) =>
    getJson<Alert>(
      `/api/v1/alerts/DENGUE/latest?location_code=${encodeURIComponent(locationCode)}`,
    ),
  ebsSchema: () => getJson<{ stages: EBSStage[] }>('/api/v1/ebs/schema'),
  previewSignal: (signal: EBSSignalDraft) =>
    postJson<EBSPreview>('/api/v1/ebs/signals/preview', signal),
  previewStage: (stage: EBSStageDraft) =>
    postJson<EBSStagePreview>('/api/v1/ebs/stages/preview', stage),
  ebsStatus: () => getJson<EBSConnectionStatus>('/api/v1/ebs/status'),
  savedSignals: (query = '') =>
    getJson<{ signals: EBSSavedSignal[] }>(`/api/v1/ebs/signals?q=${encodeURIComponent(query)}`),
  savedSignal: (trackedEntityUid: string) =>
    getJson<EBSSignalDetail>(`/api/v1/ebs/signals/${encodeURIComponent(trackedEntityUid)}`),
}
