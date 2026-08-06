# Data Trust and Operations

The Data Trust and Operations layer makes the meaning, coverage, age, provenance, and known limits of each programme visible without changing the underlying evidence. It also adds bounded read caching and a manual, checksum-bound gate between normalized data and DHIS2 synchronization.

This is implemented research infrastructure, not a certification that a dataset is clinically valid, complete, current enough for response, or approved by a public-health authority.

## Eight-programme evidence registry

[`data/evidence_registry.json`](../data/evidence_registry.json) is the versioned declaration of programme semantics. Case and outbreak values remain in normalized records; the registry contains only metadata used to interpret and test those records.

Packaged deployments can set `ONEHEALTH_EVIDENCE_REGISTRY_PATH`; the production container uses `/app/data/evidence_registry.json`.

| Code | Declared metric | Evidence and freshness mode | Declared operational use and main boundary |
|---|---|---|---|
| `DENGUE` | Admitted dengue cases | Observed surveillance; operational, 7-day cadence | Alerts supported; current snapshot is not a live DGHS feed and has no district data |
| `MEASLES` | Suspected measles cases | Observed surveillance; operational, 7-day cadence | Alerts supported; only five divisions currently have complete weekly source coverage |
| `HPAI` | Reported HPAI outbreaks | Observed outbreak reports; operational, 183-day cadence | No alerts; sparse semesters are missing rather than zero and use historical seven-division geography |
| `NIPAH` | Reported Nipah cases | Historical literature compilation | No alerts; national annual and division cumulative values have different temporal meanings |
| `JE` | Laboratory-confirmed sentinel cases | Historical sentinel surveillance | No alerts; four hospital sites do not represent population-wide division incidence and 2016 is partial |
| `AWD` | Estimated acute watery diarrhoea cases | Literature-derived ecological estimate | No alerts; division values use proxy weights and are not observed EWARS or facility counts |
| `RABIES` | Reported human rabies deaths | Official reported mortality; operational, 365-day cadence | No alerts; annual national data only, and the normalized `cases` slot represents deaths |
| `MALARIA` | Confirmed malaria cases | Official reported confirmed cases; operational, 365-day cadence | No alerts; annual national data only and separate synthetic training data are excluded |

Only Dengue and Measles declare alert support. All eight programmes currently declare forecast, automated source refresh, and district-data support as unavailable. These flags describe what the present evidence can support; they are not feature requests or inferred capabilities.

Each declaration also records expected locations, allowed `data_status` values, source licence and DOI fields where available, the repository URL, and programme-specific limitations. Historical programmes have no expected update interval and, when records are loaded, are reported as `HISTORICAL`, not `STALE`. A programme with no loaded records reports `UNKNOWN` freshness.

## Trust report contract

A programme report combines registry declarations with facts derived from the active normalized surveillance snapshot:

| Component | Source and meaning |
|---|---|
| Identity and metric | Disease name, metric label, unit, and evidence type from the registry |
| `coverage` | Earliest/latest dates, record and reporting-location counts, location levels, period types, and complete/partial counts derived from records |
| `freshness` | Latest period end and age; operational evidence is `CURRENT` within its cadence or `STALE` after it, retrospective evidence is `HISTORICAL`, and missing evidence is `UNKNOWN` |
| `provenance` | Deduplicated record-level source names and URLs plus declared licence, DOI, and repository metadata |
| `quality` | Individual checks, aggregate `PASS`/`WARNING`/`FAIL`, and issue count |
| `capabilities` | Explicit booleans for alerts, forecasts, automated refresh, and district data |
| `limitations` | Programme-specific statements that the UI and API must preserve |

Quality checks cover record presence, disease identity, valid period ranges, non-negative values and denominators, duplicate period-location records, record-level source provenance, allowed evidence semantics, partial periods, declared location coverage, and periods ending after the assessment date. A failed check makes the aggregate result `FAIL`; otherwise any warning makes it `WARNING`, and an all-pass report is `PASS`.

The quality report does not repair, impute, or reclassify data. Missing divisions remain missing, historical evidence remains historical, ecological estimates remain estimates, and national-only series do not acquire fabricated subnational coverage.

Each DHIS2 mapping also declares the programme's source name, source URL, and evidence status. When aggregate values are read back from DHIS2, those declarations restore the provenance that the DHIS2 data-value response itself does not carry; this prevents literature, sentinel, and estimated series from being flattened into a generic observed-data label. A mapping can also declare source-known partial periods and an exact end-date override. The JE mapping uses this for the January–July 2016 series, which remains visible but is never treated as a complete calendar year or used for alerts.

## Public API

The Data Trust read surface is intentionally public and read-only. Disease codes are case-insensitive; an unknown code returns `404`.

| Method | Endpoint | Response |
|---|---|---|
| `GET` | `/api/v1/data-trust` | Complete reports for all eight registered programmes |
| `GET` | `/api/v1/data-trust/{code}` | Complete report for one programme |
| `GET` | `/api/v1/data-trust/{code}/coverage` | Coverage component only |
| `GET` | `/api/v1/data-trust/{code}/freshness` | Freshness component only |
| `GET` | `/api/v1/data-trust/{code}/provenance` | Provenance component only |
| `GET` | `/api/v1/data-trust/{code}/quality` | Quality component only |
| `GET` | `/api/v1/data-trust/cache/status` | Non-secret process-local snapshot status |
| `POST` | `/api/v1/data-trust/cache/invalidate` | Clear this process's snapshots; Admin bearer token required |

Examples:

```bash
curl http://127.0.0.1:8000/api/v1/data-trust
curl http://127.0.0.1:8000/api/v1/data-trust/DENGUE/freshness
curl http://127.0.0.1:8000/api/v1/data-trust/cache/status

curl -X POST \
  -H "Authorization: Bearer <admin-token>" \
  http://127.0.0.1:8000/api/v1/data-trust/cache/invalidate
```

Catalog, detail, and component responses include:

- `X-OneHealth-Cache`: `MISS` after a successful load, `HIT` while fresh, or `STALE` when a refresh failed and the bounded fallback was used.
- `X-OneHealth-Data-Loaded-At`: the UTC time at which the delivered snapshot was successfully loaded.

The cache-status response reports `backend`, `cache_state`, `loaded_at`, `age_seconds`, configured windows, and `degraded`. Before any snapshot is loaded, its state is `EMPTY`. It does not reveal credentials or the underlying backend error.

## TTL and stale-on-error cache

The cache is in memory and local to one API process. It serializes loading so parallel dashboard requests do not all query every configured DHIS2 dataset.

| Environment variable | Default | Behavior |
|---|---:|---|
| `ONEHEALTH_CACHE_TTL_SECONDS` | `300` | A snapshot at or below this age is returned as a fresh `HIT` |
| `ONEHEALTH_CACHE_STALE_IF_ERROR_SECONDS` | `86400` | After a refresh failure, an older snapshot may be returned only at or below this age |

Both settings accept non-negative numeric seconds. Invalid or negative values are rejected. If the stale-on-error value is lower than the TTL, the cache uses the TTL as the minimum stale window.

After the TTL expires, the next read attempts to reload the configured CSV or DHIS2 backend. A successful load replaces the snapshot and returns `MISS`. If loading fails but the existing entry is still inside the stale-on-error window, the old value is returned as `STALE` and cache status sets `degraded: true`. If no eligible snapshot exists, the backend error is allowed to fail the request.

Delivery cache state and evidence freshness are independent:

- `X-OneHealth-Cache: STALE` means the backend refresh failed and a previous delivery snapshot was used.
- `freshness.status: STALE` means the programme's latest reporting period is older than its declared update cadence.

Invalidation clears only the current process. Deployments with multiple workers or replicas must invalidate each instance or restart them through deployment controls. Invalidation does not ingest data, alter records, or write to DHIS2; it only causes the next read to reload its configured backend.

## Staged ingestion approval gate

The ingestion gate is a filesystem workflow independent of the API and DHIS2. It accepts normalized aggregate CSV files and creates ignored runtime packages below `data/staging/`.

### 1. Stage and assess

```bash
PYTHONPATH=src python scripts/manage_ingestion.py stage \
  data/processed/dengue_weekly.csv
```

The new package contains:

| File | Purpose |
|---|---|
| `dataset.csv` | Byte-for-byte copy of the reviewed normalized input |
| `quality-report.json` | Structural, value, period, duplicate, provenance, and disclosure checks |
| `manifest.json` | Package ID, `awaiting_review` state, byte size, file names, and SHA-256 values |
| `approval.json` | Added after approval with reviewer, time, note, and reviewed digests |

The stage command prints the package path, complete dataset SHA-256, and findings. A failing dataset is retained in `awaiting_review` state for audit, but cannot be approved. Exact schema enforcement also rejects unexpected columns, reducing the risk of accidentally carrying identifiers or other undisclosed fields into the normalized package.

### 2. Review and approve the exact digest

After reviewing source authority, evidence semantics, provenance, geographic and temporal coverage, missingness, partial periods, and every quality finding:

```bash
PYTHONPATH=src python scripts/manage_ingestion.py approve \
  data/staging/<package-id> \
  --reviewer "Data Steward Name" \
  --checksum <64-character-sha256> \
  --note "Reviewed source and reporting coverage"
```

Approval fails if the reviewer identity is empty, the checksum is malformed or differs from the staged bytes, the quality report changed, or any quality error remains.

The reviewer field is operator-supplied; this first implementation does not authenticate it against an identity provider or cryptographically sign the receipt. Production use must restrict filesystem and command access to authorized data stewards and export approval records to an access-controlled, append-only audit system. The checksum chain detects accidental or uncoordinated post-approval changes, but a privileged filesystem operator could replace the whole package and recompute it.

### 3. Verify the approval chain

```bash
PYTHONPATH=src python scripts/manage_ingestion.py verify \
  data/staging/<package-id>
```

Verification recomputes the dataset, quality-report, and approval-receipt hashes and checks their manifest bindings, package ID, approved status, reviewer, and approval timestamp. Any modification after approval invalidates the package.

### 4. Preview, validate, and explicitly commit

Payload development can use an arbitrary normalized CSV only in local preview mode:

```bash
PYTHONPATH=src python scripts/sync_dhis2.py \
  --data data/processed/dengue_weekly.csv \
  --mapping dhis2/mappings/dengue.json \
  --preview
```

`--preview` prints payloads and never constructs a DHIS2 client. Network validation and commit both require the approved package:

```bash
PYTHONPATH=src python scripts/sync_dhis2.py \
  --staged-package data/staging/<package-id> \
  --mapping dhis2/mappings/dengue.json \
  --dry-run

PYTHONPATH=src python scripts/sync_dhis2.py \
  --staged-package data/staging/<package-id> \
  --mapping dhis2/mappings/dengue.json \
  --commit
```

`--dry-run` contacts DHIS2 for validation without committing. `--commit` is the only aggregate synchronization mode that writes and must be invoked explicitly by an authorized operator after reviewing the approved package and dry-run result. The Data Trust API, dashboard panel, snapshot refresh, cache-status endpoint, cache invalidation, stage, approve, and verify operations never write surveillance values to DHIS2.

There is no scheduled or automatic aggregate DHIS2 write path. Existing protected EBS Tracker actions are a separate workflow and remain subject to authentication and explicit write enablement. For the package contract and DHIS2 configuration, see the [ingestion approval guide](INGESTION_GATE.md) and [DHIS2 integration guide](DHIS2_INTEGRATION.md).

## Operational safeguards

- Keep staging packages out of version control; they may contain data without publication rights even when they contain no expected identifiers.
- Treat quality `PASS` as a mechanical prerequisite, not a substitute for human source and ethics review.
- Use `--preview` before any network action, then review `--dry-run` results before an authorized `--commit`.
- Monitor both evidence freshness and cache delivery state; one does not imply the other.
- Protect Admin credentials and invalidate every worker or replica when a deployment-wide reload is required.
- Do not present this research implementation as an official DGHS system, validated clinical tool, or production surveillance authority.
