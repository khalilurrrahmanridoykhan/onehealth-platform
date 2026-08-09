# OneHealth Data Trust — a native DHIS2 App

A real, installable [DHIS2 App](https://developers.dhis2.org/docs/app-platform/introduction/), built with the DHIS2 Application Platform (`@dhis2/cli-app-scripts`, `@dhis2/app-runtime`, `@dhis2/ui`) — not the separate FastAPI + React dashboard that lives in the rest of this repository.

## Why this exists as a separate app

The main `onehealth-platform` dashboard is DHIS2-*connected*: it reads and writes DHIS2 data, but it is its own standalone service with its own auth, its own backend, and its own hosting. It cannot be installed into someone else's DHIS2 instance — a DHIS2 admin browsing the App Hub can't "install" a separately-hosted FastAPI service.

This app is DHIS2-*native*: it runs inside the DHIS2 web shell, authenticates as whichever DHIS2 user is already logged in (no separate login, no separate role model), and computes everything from data it queries live from that instance's own API. It has no backend of its own and depends on nothing outside DHIS2.

## What it does

Evidence, coverage, freshness, and quality reporting for the eight public-health surveillance programmes (Dengue, Measles, HPAI, Nipah, JE, AWD, Rabies, Malaria) already modeled in this DHIS2 instance — the DHIS2-native counterpart to the main dashboard's Data Trust panel, computed independently rather than proxied from the FastAPI service.

## Deliberate differences from the Python `services/data_trust.py` this is ported from

Raw DHIS2 data values carry no per-value "disease identity" or "data status" field — those are CSV-only concepts from the other app's ingestion pipeline. So:

- **Not ported**: the `disease_identity` and `evidence_semantics` quality checks (no DHIS2-native equivalent).
- **Provenance is static, not per-record**: source name/URL, license, and DOI come from this app's bundled `src/config/programmes.ts` (a port of `data/evidence_registry.json` + `dhis2/mappings/*.json`), not from live data values, since DHIS2 doesn't carry that metadata per value.
- **Coverage/freshness/quality checks that ARE portable** (records present, non-negative values, duplicate period-location pairs, declared-location coverage, future periods) run against live `dataValueSets` pulled from this DHIS2 instance at request time.

If the underlying DHIS2 instance's org units or data elements change, only `src/config/programmes.ts` needs updating — it mirrors `dhis2/mappings/*.json` from the repo root and should be kept in sync with it by hand (there's no automated sync between the two; they're maintained independently on purpose, since this app must build without access to the Python backend).

## Development

```bash
yarn install
yarn start   # requires a running DHIS2 instance; configure via .env, see below
yarn test
yarn build   # produces build/bundle/onehealth-data-trust-<version>.zip
```

`yarn start` needs to know which DHIS2 instance to proxy to. Create a `.env` file (not committed) with:

```
REACT_APP_DHIS2_BASE_URL=https://dhis2.krrkhan.com
```

## Installing the built app

`yarn build` produces an installable zip at `build/bundle/`. In DHIS2: **Apps → App Management → Install app → Upload a zip file**, or via the API: `POST /api/apps` (multipart, field name `file`) as a user with the `M_dhis-web-app-management` authority.

This has been built and tested locally (24 unit tests covering ISO-week/six-monthly/yearly period parsing and every quality check, cross-checked against Python's own `date.fromisocalendar` for the period math) but has **not** been installed on the production DHIS2 instance — that's a separate, deliberate step.
