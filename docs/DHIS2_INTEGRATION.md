# DHIS2 Integration

## Status

The repository now includes a tested DHIS2 Web API integration foundation. It supports metadata validation/import, aggregate weekly data-value synchronization, duplicate detection, sync reports, and reading DHIS2 data back through the existing FastAPI endpoints.

An actual DHIS2 instance is not bundled or running in this development environment because Docker is not installed. Mock-transport tests validate request construction and response handling without credentials.

## Data flow

```text
DGHS aggregate CSV
        ↓
Normalized weekly records
        ↓
DHIS2 dataValueSets Web API
        ↓
DHIS2 aggregate data store
        ↓
OneHealth FastAPI trends and alerts
        ↓
Customized dashboard (planned)
```

## Configuration

Copy `.env.example` to `.env`, load the variables in your shell, and set either a personal access token or basic-auth credentials.

```bash
export ONEHEALTH_BACKEND=dhis2
export DHIS2_BASE_URL=https://your-dhis2.example
export DHIS2_API_TOKEN=your-token
export DHIS2_MAPPING_PATH=dhis2/mappings/dengue.json
```

Never commit `.env`, access tokens, passwords, or production organization-unit UIDs that should remain private.

## Organization-unit mapping

Edit `dhis2/mappings/dengue.json` and replace all demonstration organization-unit UIDs with the real UIDs from the target DHIS2 instance. The mapping contains Bangladesh and all eight divisions.

| Local code | Organization unit |
|---|---|
| `BD` | Bangladesh |
| `BD-BAR` | Barishal Division |
| `BD-CTG` | Chattogram Division |
| `BD-DHA` | Dhaka Division |
| `BD-KHU` | Khulna Division |
| `BD-MYM` | Mymensingh Division |
| `BD-RAJ` | Rajshahi Division |
| `BD-RAN` | Rangpur Division |
| `BD-SYL` | Sylhet Division |

Metadata object UIDs in this project are stable:

| Object | UID |
|---|---|
| Weekly dengue dataset | `OhDngWeek01` |
| Dengue admitted-cases data element | `OhDngCase01` |

## Preview payloads locally

Preview performs no network request and writes no DHIS2 data:

```bash
make dhis2-preview
```

## Validate metadata against DHIS2

```bash
python scripts/import_dhis2_metadata.py --dry-run
```

Review the DHIS2 import response before committing:

```bash
python scripts/import_dhis2_metadata.py --commit
```

Native analytical dashboards are installed from
`dhis2/metadata/dengue_dashboard.json`. The commit workflow reapplies
visualizations through DHIS2's dedicated Visualization API so columns, rows,
filters, and periods are preserved after the general metadata import.

```bash
python scripts/import_dhis2_metadata.py dhis2/metadata/dengue_dashboard.json --commit
```

## Synchronize dengue data

Validate all complete weeks without committing:

```bash
python scripts/sync_dhis2.py --dry-run
```

After reviewing the generated report and DHIS2 response:

```bash
python scripts/sync_dhis2.py --commit
```

The client uses `CREATE_AND_UPDATE`, allowing a corrected source value to update an existing data value. Duplicate disease/location/period records within one local input are rejected before network submission. Partial national weeks are excluded. The current division input consists of source-published weekly aggregates and is treated as complete.

## Read through the OneHealth API

With `ONEHEALTH_BACKEND=dhis2`, existing endpoints read aggregate values from DHIS2 instead of the CSV backend:

- `GET /api/v1/diseases`
- `GET /api/v1/trends/DENGUE`
- `GET /api/v1/alerts/DENGUE/latest`

Use `ONEHEALTH_BACKEND=csv` for the self-contained demonstration mode.
