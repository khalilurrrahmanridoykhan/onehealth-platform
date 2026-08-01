import type { Alert, Location, OverviewItem, SurveillanceRecord } from './types'

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
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
}

