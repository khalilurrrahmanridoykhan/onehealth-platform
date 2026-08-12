import type { FhirBundle, FhirImmunization } from './types'

// Confirmed live: https://hapi.fhir.org/baseR4 is a real, public, shared
// community FHIR R4 sandbox (FHIR version 4.0.1) -- not a mock. Its data is
// arbitrary test data written by many different users worldwide, not
// curated clinical data; the point of using it is a genuine FHIR server and
// a genuine transformation pipeline, not realistic clinical content.
export const DEFAULT_FHIR_BASE_URL = 'https://hapi.fhir.org/baseR4'

export interface FetchImmunizationsOptions {
  baseUrl?: string
  count?: number
  maxPages?: number
}

// Follows the Bundle's own "next" link rather than hand-building paging
// params, since that's what the FHIR spec actually guarantees is correct --
// confirmed live that hapi.fhir.org returns a "next" link shaped exactly
// like the spec describes.
export async function fetchImmunizations(options: FetchImmunizationsOptions = {}): Promise<FhirImmunization[]> {
  const baseUrl = options.baseUrl ?? DEFAULT_FHIR_BASE_URL
  const count = options.count ?? 20
  const maxPages = options.maxPages ?? 5

  const resources: FhirImmunization[] = []
  let url: string | null = `${baseUrl}/Immunization?_count=${count}`
  let pages = 0

  while (url && pages < maxPages) {
    const response = await fetch(url, { headers: { Accept: 'application/fhir+json' } })
    if (!response.ok) {
      throw new Error(`FHIR server returned ${response.status} ${response.statusText} for ${url}`)
    }
    const bundle = (await response.json()) as FhirBundle
    for (const entry of bundle.entry ?? []) {
      if (entry.resource) resources.push(entry.resource)
    }
    const next = (bundle.link ?? []).find((l) => l.relation === 'next')
    url = next?.url ?? null
    pages++
  }

  return resources
}
