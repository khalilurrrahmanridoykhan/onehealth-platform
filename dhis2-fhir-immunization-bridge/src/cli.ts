#!/usr/bin/env node
import { runSync } from './sync'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing required environment variable: ${name}`)
    process.exit(1)
  }
  return value
}

async function main() {
  const dhis2 = {
    baseUrl: requireEnv('DHIS2_BASE_URL'),
    username: requireEnv('DHIS2_USERNAME'),
    password: requireEnv('DHIS2_PASSWORD'),
  }
  const orgUnitId = requireEnv('DHIS2_ORG_UNIT_ID')
  const fhirBaseUrl = process.env.FHIR_BASE_URL
  const count = process.env.FHIR_PAGE_COUNT ? Number(process.env.FHIR_PAGE_COUNT) : undefined
  const maxPages = process.env.FHIR_MAX_PAGES ? Number(process.env.FHIR_MAX_PAGES) : undefined

  console.log(`Fetching Immunization resources from ${fhirBaseUrl ?? 'https://hapi.fhir.org/baseR4'} ...`)
  const report = await runSync({ dhis2, orgUnitId, fhirBaseUrl, count, maxPages })

  console.log('')
  console.log('FHIR Immunization Bridge -- sync report')
  console.log('----------------------------------------')
  console.log(`Fetched from FHIR server:   ${report.fetched}`)
  console.log(`Mapped successfully:        ${report.mappedOk}`)
  console.log(`Skipped (unmappable):       ${report.skippedMapping.length}`)
  console.log(`Already synced (skipped):   ${report.alreadySynced}`)
  console.log(`Created in DHIS2:           ${report.created}`)
  console.log(`Errors:                     ${report.errors.length}`)

  if (report.skippedMapping.length > 0) {
    console.log('')
    console.log('Skipped (unmappable):')
    for (const s of report.skippedMapping) console.log(`  - ${s.fhirImmunizationId}: ${s.reason}`)
  }

  if (report.errors.length > 0) {
    console.log('')
    console.log('Errors:')
    for (const e of report.errors) console.log(`  - ${e.fhirImmunizationId}: ${e.message}`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('Sync failed:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
