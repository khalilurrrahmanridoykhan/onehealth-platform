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

The DHIS2 integration foundation is implemented; live-instance validation and the customized frontend remain on the roadmap.

## Current capabilities

- Validates an existing daily dengue CSV export
- Aggregates observations into ISO epidemiological weeks
- Produces a normalized surveillance dataset with source provenance
- Detects partial reporting weeks and excludes them from alert calculations
- Generates explainable alerts using a four-week historical baseline
- Exposes FastAPI endpoints for diseases, trends, and latest alerts
- Previews, validates, submits, and reads DHIS2 aggregate surveillance payloads
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
| Division-level surveillance | Planned |
| Live DHIS2 instance validation | Blocked until an instance is configured |
| Customized React dashboard | Planned |
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

### Available endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Service health and version |
| `GET` | `/api/v1/diseases` | Available diseases |
| `GET` | `/api/v1/trends/DENGUE` | Complete weekly dengue records |
| `GET` | `/api/v1/trends/DENGUE?complete_only=false&limit=10` | Include partial weeks and limit results |
| `GET` | `/api/v1/alerts/DENGUE/latest` | Latest explainable dengue alert |

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

1. Add division-level dengue ingestion and stable geographic codes.
2. Validate the aggregate metadata and synchronization against a live DHIS2 instance.
3. Define EBS Tracker programs and program stages.
4. Build the customized React dashboard with trends, maps, and alerts.
5. Add EBS verification, risk assessment, investigation, and response workflows.
6. Integrate measles outbreak intelligence.
7. Integrate AWD, rainfall, and flood-risk indicators.
8. Validate alert methods with public-health experts before operational use.

## Contributing

Contributions, reproducibility checks, documentation improvements, and public-health feedback are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) before opening a pull request.

## Citation

If you use this software in research, cite the repository using [CITATION.cff](CITATION.cff). A versioned DOI can be added to the citation metadata when an archival release is available.

## License

Licensed under the [MIT License](LICENSE). Third-party datasets remain subject to their original terms and attribution requirements.
