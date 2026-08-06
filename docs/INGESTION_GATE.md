# Surveillance ingestion approval gate

Normalized surveillance data must pass a filesystem-backed manual approval gate
before it can be submitted to DHIS2. The gate is independent of the web API and
does not contact DHIS2.

## Package contract

Each staging operation creates a new directory under `data/staging/` containing:

| File | Purpose |
|---|---|
| `dataset.csv` | Byte-for-byte copy of the normalized input |
| `quality-report.json` | Schema, value, period, duplicate, provenance, and disclosure checks |
| `manifest.json` | Package ID, `awaiting_review` status, file names, byte size, and SHA-256 values |
| `approval.json` | Added only after explicit approval; records reviewer, time, note, and reviewed checksums |

Staging packages are runtime audit artifacts and are ignored by Git. They may
contain data that is not licensed or appropriate for publication.

## Workflow

Stage a normalized CSV:

```bash
PYTHONPATH=src python scripts/manage_ingestion.py stage \
  data/processed/dengue_weekly.csv
```

The command prints the package path, quality report, and complete SHA-256. A
quality failure still produces an `awaiting_review` package for audit purposes,
but that package cannot be approved.

After independently reviewing the source, provenance, geographic and temporal
coverage, missing data, and quality findings, approve the exact digest displayed
by the staging command:

```bash
PYTHONPATH=src python scripts/manage_ingestion.py approve \
  data/staging/<package-id> \
  --reviewer "Data Steward Name" \
  --checksum <64-character-sha256> \
  --note "Reviewed source and reporting coverage"
```

Verify the full checksum chain at any time:

```bash
PYTHONPATH=src python scripts/manage_ingestion.py verify \
  data/staging/<package-id>
```

DHIS2 validation and commit modes accept only a verified package:

```bash
PYTHONPATH=src python scripts/sync_dhis2.py \
  --staged-package data/staging/<package-id> \
  --mapping dhis2/mappings/dengue.json \
  --dry-run
```

Replace `--dry-run` with `--commit` only in an authorized environment. Immediately
before any DHIS2 client is constructed, the sync command verifies the dataset,
quality report, and approval receipt against the checksums bound into the package.
Any modification after approval blocks synchronization.

Raw `--data` input remains available only with `--preview`, which never contacts
DHIS2. This preserves a convenient payload-development workflow without bypassing
the write boundary.

## Trust boundary

The reviewer name is supplied by the command operator; it is not authenticated
against an identity provider and the approval receipt is not cryptographically
signed. Run these commands only in an access-controlled operator environment and
export receipts to an append-only audit system for production governance. The
checksum chain detects post-approval file changes, but a privileged filesystem
operator could replace and recompute an entire package.
