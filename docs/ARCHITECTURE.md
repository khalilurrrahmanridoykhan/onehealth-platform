# Architecture

## Current data path

```text
Public aggregate and research sources
                  │
                  ▼
       Source-specific import adapters
                  │
                  ▼
       Normalized aggregate CSV records ──────────────┐
                  │                                    │ CSV read backend
                  ▼                                    │
   Quality report + staged review package              │
                  │                                    │
                  ▼                                    │
    Explicit data-steward approval                     │
                  │                                    │
                  ▼                                    │
       Approved DHIS2 dry-run / explicit commit        │
                  │                                    │
                  ▼                                    │
       DHIS2 aggregate data backend ───────────────────┤ DHIS2 read backend
                                                       ▼
                                      Process-local snapshot cache
                                      (TTL + stale-on-error state)
                                                       │
                                    ┌──────────────────┴──────────────────┐
                                    ▼                                     ▼
                         Data Trust derivation                 Trends, alerts, summaries
                   (registry + runtime records)                           │
                                    └──────────────────┬──────────────────┘
                                                       ▼
                                              Public FastAPI reads
                                                       │
                                                       ▼
                                      Customized React dashboard
                                  (Data Trust, maps, alerts, operations)
```

The CSV backend is the default demonstration read path. A configured deployment can instead read aggregate values from DHIS2. Both paths feed the same bounded snapshot and normalized domain model, so evidence semantics and quality reporting do not depend on the delivery backend.

The downward DHIS2 write path is separate from the read path. A data steward must stage and approve the exact normalized dataset, and an authorized operator must explicitly invoke synchronization. Cache refreshes, Data Trust requests, and dashboard rendering never write to DHIS2.

## Current milestone

The repository implements source-specific ingestion, a normalized aggregate surveillance model, an eight-programme evidence registry, deterministic Data Trust reports, explainable alerts, FastAPI, the DHIS2 integration boundary, and a customized React dashboard. The dashboard renders programme evidence, coverage, freshness, provenance, quality checks, capabilities, and limitations alongside surveillance views and EBS workflows.

The operations layer now includes a process-local snapshot cache and a filesystem-backed manual ingestion gate. The cache reduces repeated backend reads and can serve a bounded stale snapshot when refresh fails. The gate blocks DHIS2 dry-run and commit modes unless the package passed structural quality checks, was approved against its SHA-256 with a reviewer-supplied name, and still passes the full checksum chain immediately before synchronization.

FastAPI is an integration, trust-reporting, and prediction layer. It does not replace DHIS2 as the target health-data backend, and the new layer has not completed formal operational validation.

## Data Trust and Operations layer

### Evidence registry

[`data/evidence_registry.json`](../data/evidence_registry.json) declares the semantics for Dengue, Measles, HPAI, Nipah, Japanese encephalitis, acute watery diarrhoea, human rabies, and malaria. Each entry defines the metric and unit, evidence type, freshness mode and expected cadence, expected locations, allowed record statuses, provenance metadata, supported capabilities, and known limitations.

The registry is not a second case-data store. Coverage, latest period, record sources, and quality findings are computed from the normalized records loaded at request time. This keeps declared meaning separate from observed facts and prevents historical, estimated, or national-only evidence from being presented as real-time, observed, or district-level surveillance.

### Snapshot delivery

All surveillance reads share a process-local snapshot keyed by the configured CSV paths or DHIS2 connection/mapping/date-range settings. `ONEHEALTH_CACHE_TTL_SECONDS` controls the fresh lifetime and defaults to 300 seconds. `ONEHEALTH_CACHE_STALE_IF_ERROR_SECONDS` controls the maximum age of a snapshot that may be returned after a refresh error and defaults to 86,400 seconds. Values must be non-negative numbers; the stale window is never shorter than the TTL.

Data Trust responses expose `X-OneHealth-Cache` (`MISS`, `HIT`, or `STALE`) and `X-OneHealth-Data-Loaded-At`. `GET /api/v1/data-trust/cache/status` reports non-secret cache health, including an initial `EMPTY` state and whether delivery is degraded. It deliberately omits backend credentials and the underlying refresh error. `POST /api/v1/data-trust/cache/invalidate` requires the application Admin role, clears only the current process, and makes the next read reload its backend.

### Trust derivation and delivery

The public read API provides a catalog at `/api/v1/data-trust`, a complete programme report at `/api/v1/data-trust/{code}`, and focused coverage, freshness, provenance, and quality resources below the same programme path. Operational evidence with records becomes `CURRENT` or `STALE` against its declared update cadence; retrospective evidence with records remains explicitly `HISTORICAL` instead of being mislabelled as a delayed live feed. A declaration with no loaded records reports `UNKNOWN` freshness and a failing records-present quality check.

Quality status is derived from checks for records, disease identity, period ranges, non-negative values, duplicates, record-level source provenance, allowed evidence semantics, partial periods, declared location coverage, and future periods. Any failed check produces `FAIL`; otherwise warnings produce `WARNING`, and a clean report produces `PASS`. These reports describe the evidence available to the application; they are not clinical validation or official public-health approval.

### Approval and write boundary

The staged ingestion gate creates a package containing the byte-for-byte normalized CSV, a machine-generated quality report, and a manifest with file digests. A quality-passing package can be approved only when a named reviewer supplies the complete SHA-256 printed at staging. Approval adds a checksum-bound receipt containing the reviewer, timestamp, note, dataset digest, and quality-report digest.

`scripts/sync_dhis2.py --dry-run` and `--commit` both require an approved staging package. Immediately before a DHIS2 client is created, the command verifies the dataset, quality report, approval receipt, package ID, reviewer audit fields, and all bound checksums. Raw `--data` input is restricted to `--preview`, which never contacts DHIS2. There is no scheduler or automatic aggregate-data write path; `--commit` is always an explicit operator action. See the [ingestion approval guide](INGESTION_GATE.md) and [Data Trust and Operations guide](DATA_TRUST.md).

## Implementation status

| Component | Status | Boundary |
|---|---|---|
| Eight-programme evidence registry | Implemented | Declarations only; no duplicated case values |
| Coverage, freshness, provenance, and quality engine | Implemented | Derives facts from the active normalized snapshot |
| Data Trust catalog, detail, and component APIs | Implemented | Public, read-only endpoints |
| Cache health endpoint | Implemented | Public and non-secret |
| Snapshot invalidation | Implemented | Admin-only and process-local |
| React Data Trust panel | Implemented | Renders the selected programme report |
| Staged ingestion and manual approval gate | Implemented | Required for DHIS2 dry-run and commit |
| Automatic DHIS2 aggregate synchronization | Not implemented | Explicit approved `--commit` only |
| Formal operational and clinical validation | Not started | Required before real-world decision use |

## DHIS2 system boundary

DHIS2 is responsible in the target deployment for organisation units, aggregate surveillance values, EBS signals and verification state, investigations, response actions where appropriate, user permissions, and auditable programme history. The OneHealth application is responsible for source-specific normalization, evidence and quality reporting, guarded synchronization, cached API delivery, prediction and explainable alerts, and the customized dashboard experience.

EBS Tracker writes remain a separate protected workflow. They require authenticated responder or administrator actions and explicit configuration; they are not triggered by Data Trust reads, cache invalidation, or the aggregate ingestion gate.

## Design principles

1. Preserve source provenance for every observation and expose missing provenance as a failure.
2. Separate observed, estimated, modelled, synthetic, and retrospective evidence.
3. Derive coverage and quality from loaded records rather than declaring results in metadata.
4. Make stale delivery visible and bound its age instead of silently presenting it as fresh.
5. Exclude incomplete periods from automated alert decisions by default.
6. Require human approval and checksum verification before any aggregate DHIS2 write.
7. Avoid storing patient identifiers in the research prototype and reject unexpected normalized columns.
8. Keep prediction explanations alongside predictions and treat thresholds as configurable and subject to validation.
