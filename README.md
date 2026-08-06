# OneHealth Intelligence Platform

[![CI](https://github.com/khalilurrrahmanridoykhan/onehealth-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/khalilurrrahmanridoykhan/onehealth-platform/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Project status: early development](https://img.shields.io/badge/status-early%20development-orange)](#project-status)

An open-source disease-surveillance, early-warning, and response platform for Bangladesh. The project is being developed incrementally from reproducible dengue, measles, highly pathogenic avian influenza (HPAI), Nipah, Japanese encephalitis (JE), acute watery diarrhoea, human rabies, and malaria research workflows.

Created and maintained by **Khalilur Rahman Ridoy Khan** ([khalilurrrahmanridoykhan](https://github.com/khalilurrrahmanridoykhan)).

> [!IMPORTANT]
> This repository is an early practice and research implementation. It is not a validated clinical tool, an official outbreak-definition system, or a production DHIS2 deployment.

## Vision

The target platform combines a customized public-health dashboard with DHIS2 as the health-data backend and independent services for ingestion, prediction, explainable alerts, and response recommendations.

### Technical workflow

```mermaid
flowchart TD
    A["<b>Research datasets and surveillance sources</b><br/>DGHS reports · CSV/PDF extracts · DHIS2 aggregate data<br/>Community and EBS signal reports"]
    B["<b>Validation and guarded ingestion</b><br/>Python 3.11 · reproducible import scripts<br/>Aggregate approval gate · protected EBS actions"]
    C["<b>DHIS2 health-data backend</b><br/>DHIS2 Core 2.42 · Web API · Aggregate Analytics · Tracker<br/>PostgreSQL 16 + PostGIS · metadata · users · audit history"]
    D["<b>Integration, trust, and prediction services</b><br/>FastAPI · snapshot cache · evidence registry<br/>Coverage · freshness · provenance · quality · alerts"]
    E["<b>Customized dashboard, alerts, and actions</b><br/>React 19 · TypeScript · Vite<br/>Data Trust panel · maps · EBS workflows · situation reports"]
    F["<b>Secure deployment</b><br/>Docker Compose · Nginx · Caddy<br/>HTTPS · role-based access · protected DHIS2 writes"]

    A -->|raw observations and event signals| B
    B -->|validated aggregate values and Tracker payloads| C
    C -->|authenticated DHIS2 Web API| D
    D -->|trends, predictions, alerts and recommendations| E
    E -->|verified assignments, response events and closure| C
    F -. hosts and protects .-> C
    F -. hosts and protects .-> D
    F -. hosts and protects .-> E

    classDef source fill:#eff6ff,stroke:#2563eb,color:#172554,stroke-width:2px;
    classDef process fill:#ecfdf5,stroke:#059669,color:#022c22,stroke-width:2px;
    classDef backend fill:#fff7ed,stroke:#ea580c,color:#431407,stroke-width:2px;
    classDef delivery fill:#f5f3ff,stroke:#7c3aed,color:#2e1065,stroke-width:2px;
    classDef infrastructure fill:#f8fafc,stroke:#475569,color:#0f172a,stroke-width:2px,stroke-dasharray:5 3;

    class A source;
    class B,D process;
    class C backend;
    class E delivery;
    class F infrastructure;
```

The primary path can move validated surveillance data into DHIS2 only through an explicit staged approval and synchronization command. Independent services read normalized CSV or configured DHIS2 data, cache a bounded snapshot, derive trust and decision-support reports, and present the results through the customized application. Operational updates can flow back to DHIS2 Tracker through separately protected actions so that assignments, response events, closure, permissions, and audit history remain in the health-data system of record. Nothing in the Data Trust layer schedules or performs automatic DHIS2 writes.

The DHIS2 integration foundation, customized frontend, and test-instance deployment are implemented. Formal operational validation remains on the roadmap.

## DHIS2-backed architecture in practice

This project follows an established DHIS2 implementation pattern: DHIS2 acts as the health-data backend and system of record, while a purpose-built web application provides a more flexible user experience and additional decision-support functions.

```text
DHIS2 aggregate data and Tracker records
                    ↓ Web API
       OneHealth integration services
                    ↓
 Customized maps, predictions, alerts,
 comparisons, EBS workflow, and response tools
```

In this architecture, DHIS2 manages organisation units, aggregate surveillance data, Tracker enrollments and events, metadata, users, permissions, and audit history. The customized OneHealth application adds Bangladesh boundary maps, prediction and risk models, explainable alerts, geographic and period comparisons, signal triage, response queues, recommended actions, and a role-specific interface. DHIS2 supports this model through its open Web API and custom application platform; see the official [DHIS2 architecture](https://dhis2.org/architecture/) and [application platform](https://dhis2.org/applications/) documentation.

### Similar implementations

| Country/organisation | Programme | How it relates to your project |
|---|---|---|
| Indonesia | National One Health and e-Zoonosis | Uses a customized DHIS2 mobile application for zoonotic case reporting, investigation and logistics planning. |
| Tanzania | Electronic Event-Based Surveillance | Community and government sectors report unusual events, investigate signals and coordinate responses across health, livestock and environmental sectors. |
| Zanzibar | Animal-health and One Health EBS | Community workers, veterinarians and district staff report and verify unusual health events using DHIS2 mobile workflows. |
| Sri Lanka | COVID-19 surveillance | Used DHIS2 Tracker for suspected cases, laboratory results, contact tracing and outcomes. |
| Africa CDC | Event-Based Surveillance | Customized DHIS2 for regional event detection and management, including integration possibilities with WHO EIOS. |
| Burkina Faso | One Health platform | Uses DHIS2 for cross-sector One Health surveillance. |

These examples are described in the official [DHIS2 One Health](https://dhis2.org/one-health/), [disease surveillance](https://dhis2.org/disease-surveillance/), and [COVID-19 surveillance](https://dhis2.org/covid-surveillance/) resources. DHIS2 also documents Tracker and Event use across more than 75 countries for programmes including malaria, tuberculosis, HIV, disease surveillance, and maternal and child health; see [DHIS2 Tracker](https://dhis2.org/tracker/). A detailed reference design for integrated animal and human event-based surveillance is available in the [DHIS2 Animal Health EBS design guide](https://docs.dhis2.org/en/implement/health/animal-health/event-based-surveillance/design.html).

> [!NOTE]
> This repository is an independent demonstration and research implementation for Bangladesh. It must not be represented as an official DGHS or Government of Bangladesh system unless it is formally reviewed, approved, and adopted by the responsible authorities.

## Current capabilities

- Validates an existing daily dengue CSV export
- Aggregates observations into ISO epidemiological weeks
- Produces a normalized surveillance dataset with source provenance
- Declares the evidence semantics, supported uses, and limitations of all eight programmes in a versioned evidence registry
- Derives programme-specific coverage, freshness, provenance, and quality reports from normalized records
- Exposes public Data Trust catalog, detail, component, and cache-status endpoints
- Uses a configurable process-local snapshot cache with explicit stale-on-error reporting and admin-only invalidation
- Requires a quality-passing, checksum-bound, manually approved staging package before aggregate-data DHIS2 validation or commit
- Includes national and eight-division dengue surveillance
- Includes national and quality-controlled division weekly measles suspected-case surveillance
- Includes national and seven-division HPAI reported-outbreak surveillance across 19 source-reported semesters (2007–2025)
- Includes literature-compiled annual Nipah cases and deaths (2001–2024) and seven-division cumulative hotspot burden (2001–2021)
- Lets users switch disease programmes without leaving the customized dashboard
- Detects partial reporting weeks and excludes them from alert calculations
- Generates explainable alerts using a four-week historical baseline
- Exposes FastAPI endpoints for diseases, trends, and latest alerts
- Previews, validates, submits, and reads DHIS2 aggregate surveillance payloads
- Displays an interactive Bangladesh division risk map
- Includes native DHIS2 Dengue, Measles, HPAI, Nipah, Japanese encephalitis, AWD, human rabies, and malaria analytical dashboards
- Previews EBS signal enrollment payloads while DHIS2 writes remain disabled by default
- Renders programme evidence, freshness, quality, supported uses, and limitations in the customized dashboard
- Includes automated tests and continuous integration
- Adds a read-only district-level climate overlay (temperature, precipitation, extreme-heat days) sourced from NASA POWER via the companion climate-disease-synthesis project, with its own evidence report kept separate from the eight-programme disease registry

## Project status

| Capability | Status |
|---|---|
| Dengue CSV ingestion | Implemented |
| Weekly surveillance data model | Implemented |
| Explainable baseline alerts | Implemented |
| FastAPI service | Implemented |
| Eight-programme evidence registry and Data Trust reports | Implemented for Dengue, Measles, HPAI, Nipah, JE, AWD, human rabies, and malaria |
| Public Data Trust read API | Implemented for catalog, programme detail, coverage, freshness, provenance, quality, and cache status |
| Snapshot cache | Implemented as a process-local TTL cache with bounded stale-on-error delivery and admin-only invalidation |
| Data Trust dashboard panel | Implemented with evidence semantics, coverage, freshness, provenance, quality checks, capabilities, and limitations |
| Manual ingestion approval gate | Implemented; aggregate-data DHIS2 dry-run and commit require a verified, approved staging package |
| Automatic DHIS2 aggregate writes | Deliberately absent; writes require an explicit approved `--commit` invocation |
| DHIS2 API client and mapping foundation | Implemented |
| DHIS2 metadata and data-value dry-run synchronization | Implemented |
| Division-level dengue surveillance | Implemented |
| Live DHIS2 instance validation | Implemented on the project test instance |
| Customized React surveillance dashboard | Implemented with division map, Data Trust panel, and EBS preview workspace |
| EBS Tracker metadata and payload workflow | Implemented; live validation pending |
| Measles integration | Implemented nationally and for five divisions with complete weekly source coverage |
| Native DHIS2 Measles dashboard | Implemented with KPIs, trends, division comparisons, table, and thematic map |
| HPAI / WAHIS integration | Implemented with sparse national and division semester records; reporting gaps remain missing, not zero |
| Native DHIS2 HPAI dashboard | Implemented with outbreak KPIs, trend, comparison, table, and thematic map |
| Japanese encephalitis sentinel surveillance | Implemented from Paul et al. (2020): 548 confirmed cases across four hospital sentinel sites, 2007–2016; 2016 is partial through July |
| Native DHIS2 JE dashboard | Implemented with historical KPIs, annual trend, sentinel-site comparison, cumulative burden, and table; no district choropleth is claimed |
| AWD ecological-estimate integration | Implemented for 2014–2024 with national sums and all eight divisions; values are literature-derived estimates, not authenticated live EWARS observations |
| Native DHIS2 AWD dashboard | Implemented with estimated-case KPIs, annual trend, division comparison, table, and explicitly labelled thematic map |
| Human rabies mortality integration | Implemented from WHO GHO indicator NTD_RAB2 with ten national annual reported-death records, 2015–2024 |
| Native DHIS2 rabies dashboard | Implemented with mortality KPIs, full trend, post-2020 view, and annual table; no subnational map is fabricated |
| Malaria confirmed-case integration | Implemented from official WHO GHO annual confirmed-case records for Bangladesh, 2015–2024 |
| Native DHIS2 malaria dashboard | Implemented with confirmed-case KPIs, full and recent trends, and annual table; the synthetic training dataset is not presented as observed data |
| Nipah literature integration | Implemented with national annual cases/deaths and division cumulative burden |
| Native DHIS2 Nipah dashboard | Implemented with cases/deaths KPIs, historical trend, hotspot comparison, table, and map |
| District-level environment (climate) data overlay | Implemented for 64 districts, monthly aggregates 2017–2025; visualization only, no disease-correlation statistics |
| AWD–environment statistical correlation analysis | Planned; deferred until after the read-only overlay ships |
| Operational validation | Not started |

See the [roadmap](#roadmap) and [architecture documentation](docs/ARCHITECTURE.md) for the intended progression.

## Quick start

### Requirements

- Python 3.11 or newer
- Git

### Installation

```bash
git clone https://github.com/khalilurrrahmanridoykhan/onehealth-platform.git
cd onehealth-platform
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
```

On Windows PowerShell, activate the environment with `.venv\Scripts\Activate.ps1`.

### Import dengue data

```bash
python scripts/import_dengue.py /path/to/dengue_daily_2026.csv
```

The importer expects:

```csv
date,dengue_cases_daily
2026-01-01,76
2026-01-02,63
```

Normalized output is written to `data/processed/dengue_weekly.csv`. Boundary weeks are retained for transparency, while incomplete weeks are excluded from alerts.

### Import measles data

```bash
python scripts/import_measles.py /path/to/measles_national_summary.csv \
  --division-source /path/to/measles_division_breakdown.csv
```

The importer reads aggregate DGHS daily suspected-case fields, groups them into Monday–Sunday ISO weeks, and writes `data/processed/measles_weekly.csv`. It rejects PDF-parser contamination when a purported division value exceeds its corresponding national daily total. Partial weeks remain visible for audit but are excluded from DHIS2 synchronization and alert calculations. The current source provides complete weekly coverage for Dhaka, Chattogram, Khulna, Rajshahi, and Rangpur; unavailable divisions remain explicitly unreported rather than being estimated.

### Import HPAI data

```bash
python scripts/import_hpai.py /path/to/hpai_modeling_dataset.csv
```

The importer converts the public WOAH WAHIS division-semester quantitative export into `data/processed/hpai_semester.csv`, combines poultry/wildlife rows for the same place and semester, maps the Narayanganj Sadar record to Dhaka Division, and adds an auditable national sum. Semesters absent from the WAHIS export remain **missing**, not zero. The source uses the historical seven-division geography, where Mymensingh is included within Dhaka; the platform therefore leaves Mymensingh unreported instead of inventing a separate value. The normalized field named `cases` is a common internal measure slot; in the HPAI interface it is correctly presented as **reported outbreaks**.

### Import Japanese encephalitis data

```bash
PYTHONPATH=src python scripts/import_je.py \
  /path/to/je_cases_by_site_year.csv
python scripts/build_je_dashboard.py
```

The JE integration uses the exact year-by-site table transcribed from Paul et al. (2020). It creates a national annual series and four sentinel-hospital series mapped to Rangpur, Rajshahi, Chattogram, and Khulna divisions. These are **sentinel-site counts**, not population-wide division incidence. Blank site-years remain missing. The 2016 value covers January through July only and is labelled partial in the normalized source data and native dashboard. No district map, mortality series, real-time forecast, or alert is inferred from unavailable data.

### Import acute watery diarrhoea estimates

```bash
PYTHONPATH=src python scripts/import_awd.py /path/to/awd_annual_paper_sourced.csv
python scripts/build_awd_dashboard.py
```

The AWD importer preserves the eight annual division estimates and computes an auditable national sum for each year. These values are derived from published national totals and proxy division weights described by the source research project. They must not be presented as direct division-level DHIS2/EWARS observations. The platform therefore labels the metric as **estimated AWD cases** and disables operational prediction alerts.

### Import human rabies mortality

```bash
PYTHONPATH=src python scripts/import_rabies.py /path/to/rabies_deaths_rate_bgd.csv
python scripts/build_rabies_dashboard.py
```

The rabies programme stores WHO GHO indicator NTD_RAB2 as annual **reported human rabies deaths**. Public data provide national resolution only, so the custom dashboard substitutes a national evidence-coverage panel for the division map, and the native dashboard does not claim a subnational visualization. Automated outbreak alerts are disabled for this retrospective annual series.

### Import confirmed malaria cases

```bash
PYTHONPATH=src python scripts/import_malaria.py data/raw/malaria_confirmed_who_gho.csv
python scripts/build_malaria_dashboard.py
```

The malaria integration uses WHO GHO indicator `MALARIA_CONF_CASES`, defined as cases confirmed by microscopy or rapid diagnostic testing and compiled from national malaria control programme reporting. The public series is national annual data, so no division map is fabricated and automated outbreak alerts are disabled. The separate synthetic monthly malaria case-study repository remains a training resource and is not loaded as observed surveillance.

### Import Nipah data

```bash
python scripts/import_nipah.py /path/to/nipah_national_annual.csv \
  /path/to/nipah_division_summary.csv
```

The Nipah integration is explicitly a **historical literature compilation**, not a live surveillance feed. National annual cases and deaths for 2001–2024 are stored separately in DHIS2; division values are cumulative affected-district totals for 2001–2021 and are stored at period 2021 for analytical mapping. The custom application disables rolling alerts and predictions for this programme because applying a real-time warning model to retrospective annual literature data would be misleading. Cite Satter et al. (2023), [PLOS Neglected Tropical Diseases](https://doi.org/10.1371/journal.pntd.0011617), and Bhowmik et al. (2024), *Science in One Health*, when reusing the underlying values.

### Import environment (climate) data

Manual, local step — not part of `make reproduce` or CI, since it reads from the sibling `bangladesh-climate-disease-synthesis` repository:

```bash
python scripts/import_environment.py \
  --climate-daily ../bangladesh-climate-disease-synthesis/data/processed/climate_daily_by_district_2017_2025.csv \
  --climate-summary ../bangladesh-climate-disease-synthesis/data/processed/district_climate_summary.csv

python scripts/build_environment_map.py \
  --source-geojson ../bangladesh-climate-disease-synthesis/data/external/bgd_adm2_geoboundaries.geojson
```

This is a read-only overlay, not disease surveillance data — it never goes through the ingestion gate or DHIS2. See [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) for the district identifier scheme, data-quality caveats, and API details.

### Reproduce the current output

Install the project, regenerate the normalized dengue dataset from the committed aggregate source snapshot, and run all tests with one command:

```bash
make reproduce
```

### Review and approve data before DHIS2

The aggregate synchronization command's DHIS2 validation and commit modes do not accept an arbitrary CSV. Stage the normalized file, inspect the generated quality report, approve the exact SHA-256 with a reviewer-supplied name, and verify the package:

```bash
PYTHONPATH=src python scripts/manage_ingestion.py stage \
  data/processed/dengue_weekly.csv

PYTHONPATH=src python scripts/manage_ingestion.py approve \
  data/staging/<package-id> \
  --reviewer "Data Steward Name" \
  --checksum <64-character-sha256> \
  --note "Reviewed source and reporting coverage"

PYTHONPATH=src python scripts/manage_ingestion.py verify \
  data/staging/<package-id>

PYTHONPATH=src python scripts/sync_dhis2.py \
  --staged-package data/staging/<package-id> \
  --mapping dhis2/mappings/dengue.json \
  --dry-run
```

Only an authorized operator should replace `--dry-run` with `--commit`. The command rechecks the dataset, quality-report, and approval-receipt checksums before constructing the DHIS2 client; any post-approval change blocks synchronization. Raw `--data` input is accepted only with `--preview`, which does not contact DHIS2. See the [ingestion approval guide](docs/INGESTION_GATE.md) for the package contract and safeguards.

### Start the API

```bash
uvicorn onehealth.api:app --reload
```

- API: <http://127.0.0.1:8000>
- Interactive documentation: <http://127.0.0.1:8000/docs>
- OpenAPI schema: <http://127.0.0.1:8000/openapi.json>

The default backend is the committed CSV demonstration. To read from a configured DHIS2 instance, follow the [DHIS2 integration guide](docs/DHIS2_INTEGRATION.md) and set `ONEHEALTH_BACKEND=dhis2`.

The API reuses a process-local surveillance snapshot for both analytical and Data Trust requests. Configure its fresh TTL and bounded stale-on-error window in seconds:

```bash
export ONEHEALTH_CACHE_TTL_SECONDS=300
export ONEHEALTH_CACHE_STALE_IF_ERROR_SECONDS=86400
```

After the TTL expires, the next request attempts a refresh. If that read fails and the previous snapshot remains inside the stale-on-error window, the API serves it with `X-OneHealth-Cache: STALE`; trust responses also include `X-OneHealth-Data-Loaded-At`. Cache status is public, but invalidation requires an Admin bearer token and affects only the current API process. See the [Data Trust and Operations guide](docs/DATA_TRUST.md) for the eight-programme registry, endpoint contract, cache states, and safety boundaries.

The six-stage Event-Based Surveillance program is documented in the [EBS Tracker guide](docs/EBS_TRACKER.md).

### Start the customized dashboard

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. The Vite development server proxies API requests to FastAPI on port `8000`.

The current dashboard includes:

- Bangladesh and division location selection
- Latest, expected, percentage-change, and cumulative summary cards
- Weekly dengue epidemic curve
- Explainable risk status and recommended actions
- National and division comparison table
- Interactive division risk map linked to location selection
- Programme-specific Data Trust panel for evidence type, coverage, freshness, provenance, quality checks, supported uses, and limitations
- Read-only district climate overlay (temperature, precipitation, extreme-heat days) with its own evidence panel
- Six-stage EBS workflow with safe detection and follow-up event previews
- Protected DHIS2 signal registry with search, detail, and event history
- Operational alert queue with officer assignment written to DHIS2 Tracker
- Due-date monitoring with due-soon, due-today, overdue, and unassigned states
- In-application operational notifications and downloadable CSV situation reports
- Idempotent, non-identifiable EBS demonstration scenarios covering every queue state
- Signed application sessions and Viewer/Analyst/Responder/Admin roles
- Non-root container deployment baseline with automatic HTTPS
- Responsive desktop and mobile layouts

### Available endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Service health and version |
| `GET` | `/api/v1/diseases` | Available diseases |
| `GET` | `/api/v1/data-trust` | Data Trust reports for all eight declared programmes |
| `GET` | `/api/v1/data-trust/{code}` | Complete Data Trust report for one programme |
| `GET` | `/api/v1/data-trust/{code}/coverage` | Record, date, period, and geographic coverage |
| `GET` | `/api/v1/data-trust/{code}/freshness` | Latest-period age and current, stale, historical, or unknown status |
| `GET` | `/api/v1/data-trust/{code}/provenance` | Record sources and declared licence, DOI, and repository |
| `GET` | `/api/v1/data-trust/{code}/quality` | Deterministic quality checks and aggregate status |
| `GET` | `/api/v1/data-trust/cache/status` | Non-secret snapshot health and degraded-delivery state |
| `POST` | `/api/v1/data-trust/cache/invalidate` | Admin-only process-local snapshot invalidation |
| `GET` | `/api/v1/locations?disease_code=DENGUE` | Available national and division locations |
| `GET` | `/api/v1/trends/DENGUE` | Complete weekly dengue records |
| `GET` | `/api/v1/trends/MEASLES?location_code=BD` | Complete national weekly measles records |
| `GET` | `/api/v1/trends/HPAI?location_code=BD` | National six-monthly HPAI outbreak records |
| `GET` | `/api/v1/trends/NIPAH?location_code=BD` | National annual Nipah cases and deaths |
| `GET` | `/api/v1/trends/JE?location_code=BD` | Historical national annual JE confirmed cases |
| `GET` | `/api/v1/trends/AWD?location_code=BD` | National annual literature-derived AWD estimates |
| `GET` | `/api/v1/trends/RABIES?location_code=BD` | WHO GHO national annual reported human rabies deaths |
| `GET` | `/api/v1/trends/MALARIA?location_code=BD` | WHO GHO national annual confirmed malaria cases |
| `GET` | `/api/v1/trends/DENGUE?location_code=BD-DHA` | Dhaka Division weekly trend |
| `GET` | `/api/v1/trends/DENGUE?complete_only=false&limit=10` | Include partial weeks and limit results |
| `GET` | `/api/v1/alerts/DENGUE/latest` | Latest explainable dengue alert |
| `GET` | `/api/v1/alerts/DENGUE/latest?location_code=BD-DHA` | Latest Dhaka Division alert |
| `GET` | `/api/v1/summary/DENGUE?location_code=BD-DHA` | Summary metrics for a location |
| `GET` | `/api/v1/environment/districts` | Climate summary for all 64 districts |
| `GET` | `/api/v1/environment/districts/{location_code}` | Climate summary for one district |
| `GET` | `/api/v1/environment/districts/{location_code}/monthly` | Monthly temperature and precipitation for one district |
| `GET` | `/api/v1/environment/data-trust` | Environment dataset coverage, freshness, provenance, and quality report |
| `GET` | `/api/v1/ebs/schema` | EBS program-stage schema for the custom UI |
| `GET` | `/api/v1/ebs/status` | Non-secret DHIS2 registry readiness and safety status |
| `GET` | `/api/v1/ebs/signals` | Search saved Tracker signals when protected reads are enabled |
| `GET` | `/api/v1/ebs/signals/{uid}` | Read a saved signal and mapped event timeline |
| `GET` | `/api/v1/ebs/operations` | Read and filter the operational response queue |
| `POST` | `/api/v1/ebs/operations/{uid}/assignment` | Assign an officer, deadline, actions, and response status |
| `GET` | `/api/v1/ebs/notifications` | Generate actionable deadline and ownership notifications |
| `GET` | `/api/v1/ebs/reports/situation.csv` | Download the current protected situation report |
| `POST` | `/api/v1/ebs/signals/preview` | Validate and preview a DHIS2 Tracker signal payload |
| `POST` | `/api/v1/ebs/signals` | Submit a signal only when EBS writes are explicitly enabled |
| `POST` | `/api/v1/ebs/stages/preview` | Validate and preview a follow-up Tracker stage event |
| `POST` | `/api/v1/ebs/stages` | Submit a follow-up event only when EBS writes are explicitly enabled |

## Alert interpretation

The practice algorithm compares the latest complete week with the mean of the previous four complete weeks.

| Current cases compared with baseline | Risk |
|---|---|
| Less than 120% | Low |
| 120% to less than 150% | Medium |
| 150% or more | High |

The result includes the observed and expected case counts, risk level, confidence heuristic, reasons, and recommended follow-up actions. These thresholds must be calibrated and validated before operational use.

## Testing

```bash
pytest
```

CI runs the test suite on supported Python versions for every push and pull request.

## Repository structure

```text
onehealth-platform/
├── .github/                  Community templates and CI
├── data/evidence_registry.json  Eight-programme evidence declarations
├── data/processed/           Normalized demonstration output
├── data/raw/                 Public aggregate source snapshot
├── data/staging/             Ignored runtime approval packages
├── docs/                     Architecture and data documentation
├── frontend/                 Customized React/TypeScript dashboard
├── scripts/                  Command-line ingestion tools
├── src/onehealth/            Application package
│   ├── api.py                FastAPI routes
│   ├── models.py             Domain models
│   └── services/             Ingestion, surveillance, and alerts
└── tests/                    Automated tests
```

## Data provenance and privacy

The included demonstration dataset is derived from publicly accessible, aggregate DGHS Bangladesh dengue reporting. It contains no names, patient identifiers, or individual-level health records. Every normalized record retains its source name and URL.

- Source: DGHS HEOC Dengue Dynamic Dashboard
- Source URL: <https://dashboard.dghs.gov.bd/pages/heoc_dengue_v1.php>
- Geographic scope: Bangladesh, national aggregate
- Temporal scope in the committed daily snapshot: 1 January–3 June 2026
- Data unit: daily admitted dengue cases
- Accessed by the upstream research project: June 2026
- Transformation: validated daily counts aggregated into Monday–Sunday ISO weeks
- Missing-value convention: empty normalized cells mean unavailable or not applicable

The committed measles series is also public, aggregate DGHS reporting and contains no patient identifiers.

- Source: DGHS Bangladesh measles national situation summaries
- Geographic scope: Bangladesh national aggregate plus source-available division observations
- Temporal scope: 2 April–2 June 2026
- Data unit: daily suspected measles cases reported in the previous 24 hours
- Transformation: daily counts aggregated into Monday–Sunday ISO weeks
- Quality rule: division rows exceeding the corresponding national daily value are rejected as parser contamination
- Completeness rule: only weeks containing all seven daily reports are synchronized to DHIS2 and used in trends and alerts

See the [Data Trust and Operations guide](docs/DATA_TRUST.md) for the evidence registry, derived trust reports, cache behavior, and guarded ingestion workflow. See the [data dictionary](docs/DATA_DICTIONARY.md) for variables, types, units, allowed values, and missing-value rules, and the [ethics statement](docs/ETHICS.md) for the current review basis and requirements for future operational data.

Do not commit credentials, protected health information, or identifiable patient data. See [SECURITY.md](SECURITY.md) for responsible reporting.

## Roadmap

1. Validate national and division metadata synchronization against a live DHIS2 instance.
2. Validate the EBS Tracker metadata and signal workflow against the live instance.
3. Validate EBS signal submission with controlled test data on the live instance.
4. Deploy the baseline to a controlled HTTPS test environment.
5. Validate DHIS2 metadata, reads, previews, and guarded writes on the test instance.
6. Add external identity-provider integration for production environments.
7. Extend Measles coverage to the remaining divisions and districts when complete authoritative series are available.
8. Analyze AWD–environment statistical correlation on top of the read-only district climate overlay (temperature, precipitation, extreme-heat days), now implemented.
9. Validate alert methods with public-health experts before operational use.

## Contributing

Contributions, reproducibility checks, documentation improvements, and public-health feedback are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) before opening a pull request.

## Citation

If you use this software in research, cite the repository using [CITATION.cff](CITATION.cff). A versioned DOI can be added to the citation metadata when an archival release is available.

## License

Licensed under the [MIT License](LICENSE). Third-party datasets remain subject to their original terms and attribution requirements.
