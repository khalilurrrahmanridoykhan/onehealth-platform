# OneHealth Intelligence Platform

[![CI](https://github.com/khalilurrrahmanridoykhan/onehealth-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/khalilurrrahmanridoykhan/onehealth-platform/actions/workflows/ci.yml)
[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Project status: early development](https://img.shields.io/badge/status-early%20development-orange)](#project-status)

An open-source disease-surveillance, early-warning, and response platform for Bangladesh. The project is being developed incrementally from reproducible dengue, measles, and acute watery diarrhea research workflows.

> [!IMPORTANT]
> This repository is an early practice and research implementation. It is not a validated clinical tool, an official outbreak-definition system, or a production DHIS2 deployment.

## Vision

The target platform combines a customized public-health dashboard with DHIS2 as the health-data backend and independent services for ingestion, prediction, explainable alerts, and response recommendations.

```text
Research datasets and surveillance sources
                   ↓
       Validation and ingestion
                   ↓
       DHIS2 health-data backend
                   ↓
 Integration and prediction services
                   ↓
 Customized dashboard, alerts, and actions
```

The DHIS2 integration foundation and customized frontend are implemented. Live-instance validation remains on the roadmap.

## Current capabilities

- Validates an existing daily dengue CSV export
- Aggregates observations into ISO epidemiological weeks
- Produces a normalized surveillance dataset with source provenance
- Includes national and eight-division dengue surveillance
- Detects partial reporting weeks and excludes them from alert calculations
- Generates explainable alerts using a four-week historical baseline
- Exposes FastAPI endpoints for diseases, trends, and latest alerts
- Previews, validates, submits, and reads DHIS2 aggregate surveillance payloads
- Displays an interactive Bangladesh division risk map
- Previews EBS signal enrollment payloads while DHIS2 writes remain disabled by default
- Includes automated tests and continuous integration

## Project status

| Capability | Status |
|---|---|
| Dengue CSV ingestion | Implemented |
| Weekly surveillance data model | Implemented |
| Explainable baseline alerts | Implemented |
| FastAPI service | Implemented |
| DHIS2 API client and mapping foundation | Implemented |
| DHIS2 metadata and data-value dry-run synchronization | Implemented |
| Division-level dengue surveillance | Implemented |
| Live DHIS2 instance validation | Blocked until an instance is configured |
| Customized React surveillance dashboard | Implemented with division map and EBS preview workspace |
| EBS Tracker metadata and payload workflow | Implemented; live validation pending |
| Measles integration | Planned |
| AWD/environmental-risk integration | Planned |
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

### Reproduce the current output

Install the project, regenerate the normalized dengue dataset from the committed aggregate source snapshot, and run all tests with one command:

```bash
make reproduce
```

### Start the API

```bash
uvicorn onehealth.api:app --reload
```

- API: <http://127.0.0.1:8000>
- Interactive documentation: <http://127.0.0.1:8000/docs>
- OpenAPI schema: <http://127.0.0.1:8000/openapi.json>

The default backend is the committed CSV demonstration. To read from a configured DHIS2 instance, follow the [DHIS2 integration guide](docs/DHIS2_INTEGRATION.md) and set `ONEHEALTH_BACKEND=dhis2`.

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
- Six-stage EBS workflow with safe detection and follow-up event previews
- Protected DHIS2 signal registry with search, detail, and event history
- Signed application sessions and Viewer/Analyst/Responder/Admin roles
- Non-root container deployment baseline with automatic HTTPS
- Responsive desktop and mobile layouts

### Available endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Service health and version |
| `GET` | `/api/v1/diseases` | Available diseases |
| `GET` | `/api/v1/locations?disease_code=DENGUE` | Available national and division locations |
| `GET` | `/api/v1/trends/DENGUE` | Complete weekly dengue records |
| `GET` | `/api/v1/trends/DENGUE?location_code=BD-DHA` | Dhaka Division weekly trend |
| `GET` | `/api/v1/trends/DENGUE?complete_only=false&limit=10` | Include partial weeks and limit results |
| `GET` | `/api/v1/alerts/DENGUE/latest` | Latest explainable dengue alert |
| `GET` | `/api/v1/alerts/DENGUE/latest?location_code=BD-DHA` | Latest Dhaka Division alert |
| `GET` | `/api/v1/summary/DENGUE?location_code=BD-DHA` | Summary metrics for a location |
| `GET` | `/api/v1/ebs/schema` | EBS program-stage schema for the custom UI |
| `GET` | `/api/v1/ebs/status` | Non-secret DHIS2 registry readiness and safety status |
| `GET` | `/api/v1/ebs/signals` | Search saved Tracker signals when protected reads are enabled |
| `GET` | `/api/v1/ebs/signals/{uid}` | Read a saved signal and mapped event timeline |
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
├── data/processed/           Normalized demonstration output
├── data/raw/                 Public aggregate source snapshot
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

See the [data dictionary](docs/DATA_DICTIONARY.md) for variables, types, units, allowed values, and missing-value rules. See the [ethics statement](docs/ETHICS.md) for the current review basis and requirements for future operational data.

Do not commit credentials, protected health information, or identifiable patient data. See [SECURITY.md](SECURITY.md) for responsible reporting.

## Roadmap

1. Validate national and division metadata synchronization against a live DHIS2 instance.
2. Validate the EBS Tracker metadata and signal workflow against the live instance.
3. Validate EBS signal submission with controlled test data on the live instance.
4. Deploy the baseline to a controlled HTTPS test environment.
5. Validate DHIS2 metadata, reads, previews, and guarded writes on the test instance.
6. Add external identity-provider integration for production environments.
6. Integrate measles outbreak intelligence.
7. Integrate AWD, rainfall, and flood-risk indicators.
8. Validate alert methods with public-health experts before operational use.

## Contributing

Contributions, reproducibility checks, documentation improvements, and public-health feedback are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) before opening a pull request.

## Citation

If you use this software in research, cite the repository using [CITATION.cff](CITATION.cff). A versioned DOI can be added to the citation metadata when an archival release is available.

## License

Licensed under the [MIT License](LICENSE). Third-party datasets remain subject to their original terms and attribution requirements.
