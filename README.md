# OneHealth Intelligence Platform

An incremental disease-surveillance, early-warning, and response platform for Bangladesh. This repository consumes standardized exports from independent disease research projects and will later integrate with DHIS2.

## Implemented in the first milestone

- Dengue daily CSV validation and ingestion
- ISO epidemiological-week aggregation
- A shared surveillance record format with source provenance
- Detection and exclusion of incomplete weeks
- Explainable four-week historical-threshold alerts
- FastAPI endpoints for disease lists, weekly trends, and the latest alert
- Unit tests for aggregation and alert logic

## Architecture

```text
Disease research repository
        ↓ CSV export
OneHealth ingestion and validation
        ↓ normalized weekly records
Surveillance and alert services
        ↓
FastAPI
        ↓
Dashboard and DHIS2 integration (next milestones)
```

## Setup

```bash
cd /Users/khalilur/Documents/AIWORK/onehealth-platform
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
```

## Import the existing dengue data

```bash
python scripts/import_dengue.py \
  /Users/khalilur/Documents/AIWORK/dengue/data/raw/dengue_daily_2026.csv
```

The normalized output is written to `data/processed/dengue_weekly.csv`. Partial weeks remain available for display but are excluded from alert calculations.

## Run the API

```bash
uvicorn onehealth.api:app --reload
```

Interactive API documentation: <http://127.0.0.1:8000/docs>

Available endpoints:

- `GET /health`
- `GET /api/v1/diseases`
- `GET /api/v1/trends/DENGUE`
- `GET /api/v1/trends/DENGUE?complete_only=false&limit=10`
- `GET /api/v1/alerts/DENGUE/latest`

## Run tests

```bash
pytest
```

## Alert interpretation

The baseline is the mean of the previous four complete weeks.

| Current cases compared with baseline | Risk |
|---|---|
| Less than 120% | Low |
| 120% to less than 150% | Medium |
| 150% or more | High |

This is an explainable practice threshold, not a validated clinical or government outbreak definition. It must be reviewed and calibrated before operational use.

## Next milestone

Build the React dashboard with trend charts, filters, alert cards, and a Bangladesh map. Then add division-level dengue records and map them to stable organization-unit codes for future DHIS2 synchronization.

