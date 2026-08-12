# FHIR Immunization Bridge

A narrow, real DHIS2 ↔ FHIR interoperability tool: syncs `Immunization` resources from a FHIR R4 server into a DHIS2 Tracker program.

**This is not a DHIS2 App.** Every other app in this monorepo (`dhis2-app`, `dhis2-data-quality-auditor`, `dhis2-data-share-hub`, `dhis2-amr-stewardship-log`, `dhis2-otss-supervision-log`) runs entirely in-browser, inside DHIS2's own web shell, talking only to that one instance's API. A real interoperability bridge can't work that way -- it needs to fetch from an *external* FHIR server, transform, and push into DHIS2, which is a background job, not a browser tab. So this is a standalone **Node.js/TypeScript CLI tool**, no `d2.config.js`, no browser bundle, no App Hub install path.

## Why this exists, and what it isn't

Real prior art confirms the shape: DHIS2's own team built [`dhis2-fhir-adapter`](https://github.com/dhis2/dhis2-fhir-adapter) (now community-maintained forks at [ITINordic](https://github.com/ITINordic/dhis2-fhir-adapter) and [OpenSRP](https://github.com/opensrp/dhis2-fhir-adapter)) as exactly this kind of standalone middleware service, used for real health information exchange work -- the Rwanda Biomedical Center, with CDC support, built a FHIR-based exchange for routine HIV case-based surveillance on this same pattern; PAHO used FHIR interoperability for post-vaccination safety monitoring.

**This is a deliberately narrow, honest version of that idea -- one resource type, one direction, not a competing "full interoperability engine."** It syncs `Immunization` resources from FHIR into DHIS2. It does not sync anything else, does not go the other direction (DHIS2 → FHIR), and does not attempt subscriptions, terminology services, or any of the other real scope of a production adapter.

## What it actually does

1. Fetches `Immunization` resources from a FHIR R4 server (default: the public [HAPI FHIR test server](https://hapi.fhir.org/baseR4), a genuine, live, shared community sandbox -- not a mock. Its data is arbitrary test content written by many different users worldwide, not curated clinical data; the point of using it is a real FHIR server and a real transformation pipeline, not realistic clinical content).
2. Maps each resource to a DHIS2 Tracker event (`src/mapping.ts`) -- see the mapping table below.
3. Skips, and reports, anything it can't map (no `occurrenceDateTime` -- the Tracker API requires an event date, so this is never guessed at).
4. Filters out anything already synced in a previous run (`src/dedupe.ts`).
5. Pushes new events into a DHIS2 Tracker program, auto-provisioned on first run.
6. Prints a summary: fetched / mapped / skipped / already-synced / created / errors.

## The mapping

Built directly from real data pulled live from the public FHIR server during development, not an idealized reading of the FHIR spec. Most `Immunization` resources there carry only `vaccineCode.text` (free text) with no `coding` array; a minority carry a proper SNOMED `coding[]`.

| DHIS2 data element | Source | Fallback |
|---|---|---|
| `antigenName` | `vaccineCode.coding[0].display` | `vaccineCode.text`, then `"Unknown"` |
| `vaccineCodingJson` | the full `vaccineCode` object, as JSON | full fidelity kept even when the readable field falls back to text |
| `status` | `status` | always present (FHIR-required) |
| `sourcePatientRef` | `patient.reference` | opaque source-system linkage key -- **not** a name, DOB, or any importable identity. This bridge never calls the FHIR `Patient` endpoint, so it structurally cannot pull in identity beyond an already-opaque reference string. |
| `fhirImmunizationId` | `id` | the dedupe key |
| `lotNumber` | `lotNumber` | omitted entirely when absent, never sent as an empty string |
| Event `occurredAt` | `occurrenceDateTime` | **required** -- a resource missing it is skipped and reported, never defaulted to "now" |

## Idempotency (`src/dedupe.ts`)

Re-running a sync must never create duplicate DHIS2 events for the same FHIR resource -- the classic interoperability bug. Two approaches were weighed:

1. Query DHIS2 Tracker events with a data-value filter to check whether a `fhirImmunizationId` already exists.
2. Track synced FHIR ids in this bridge's own `dataStore` blob, read at the start of a run and updated at the end.

**Chose option 2.** Option 1's filter-by-data-value query syntax on `GET /api/tracker/events` has never been exercised anywhere in this project -- every prior use only filtered by `program`/`orgUnit`. Option 2 reuses the exact, already-proven `dataStore` read-modify-write pattern every sibling app depends on: lower risk, same "reuse a confirmed mechanic over an unverified one" call this whole project has made every time it's come up.

## Reused DHIS2 mechanics (not re-verified here, already confirmed live)

Payload shapes are reused unchanged from `dhis2-otss-supervision-log/src/lib/provisioning.ts`, which confirmed them live against play.dhis2.org (stable-2-43-1):

1. `POST /api/programs` does **not** accept a nested `programStages` array -- the Program and its ProgramStage are created as two separate calls.
2. A Program's sharing access string uses the same 4-part convention as datasets/dashboards (`r-rw----` = metadata read-only, data read+write). DHIS2's own org-unit capture-scope check remains the real security boundary on who can actually write events, regardless of this sharing grant.

Only the HTTP-calling layer is new here: `src/dhis2Client.ts` is a plain `fetch` + Basic Auth wrapper, since this tool never runs inside DHIS2's web shell and can't use `@dhis2/app-runtime`.

## Running it

```bash
npm install
npm run typecheck
npm test

DHIS2_BASE_URL=https://play.im.dhis2.org/stable-2-43-1 \
DHIS2_USERNAME=admin \
DHIS2_PASSWORD=district \
DHIS2_ORG_UNIT_ID=<an org unit id> \
npm run sync
```

Optional environment variables: `FHIR_BASE_URL` (default the public HAPI server above), `FHIR_PAGE_COUNT` (resources per page, default 20), `FHIR_MAX_PAGES` (default 5).

**Credentials are never hardcoded** -- same discipline as every sibling app's own install script: passed as environment variables only, at run time.

## v1 scope

**Buildable now, shipped:** one-directional FHIR → DHIS2 sync for the `Immunization` resource type, auto-provisioning, real dedupe via `dataStore`, defensive mapping against real observed data variability (coded vs. text-only vaccine codes, missing optional fields), a clear CLI summary report.

**Explicitly deferred:** the reverse direction (DHIS2 aggregate data exposed as FHIR `Measure`/`MeasureReport` resources for a national HIE to consume) -- a real v1.1 candidate, not attempted now; any other FHIR resource type (`Patient`, `Encounter`, `Observation`, ...); FHIR Subscriptions (push-based sync instead of poll-based); running against a second FHIR server to confirm the mapping isn't overfit to this one sandbox's particular data quirks; scheduling/automation (this is a script you run, not a deployed service with its own uptime).

## Relationship to sibling apps

| Project | Shape | What it's for |
|---|---|---|
| OneHealth Data Trust | Browser DHIS2 App | Evidence/quality reporting for 8 fixed disease programmes |
| Data Quality Auditor | Browser DHIS2 App | Admin-configurable RDQA-style quality checks, any dataset |
| Data Share Hub | Browser DHIS2 App | Guided external data sharing -- CSV export or scoped API account |
| AMR Stewardship Log | Browser DHIS2 App | Point-of-care antibiotic prescribing checklist |
| OTSS Supervision Log | Browser DHIS2 App | Supportive-supervision checklist, grounded in a published OTSS evaluation |
| **FHIR Immunization Bridge** | **Standalone Node CLI** | **Real interoperability: pulls external FHIR data into DHIS2** |
