# Event-Based Surveillance Tracker

## Purpose

The EBS Tracker program represents unusual public-health signals as registered DHIS2 tracked entities. Each signal moves through auditable program stages instead of being stored only as a dashboard alert.

## Workflow

```text
Signal detection
      ↓
Verification
      ↓
Risk assessment
      ↓
Investigation
      ↓
Response actions
      ↓
Closure and lessons learned
```

## Program stages

| Stage | Core fields | Repeatable |
|---|---|---|
| Detection | Signal type, description | No |
| Verification | Verification status, notes | No |
| Risk assessment | Likelihood score, impact score, risk level | No |
| Investigation | Status, samples collected, findings | Yes |
| Response | Recommended actions, responsible officer, due date, status | Yes |
| Closure | Outcome, closure date, lessons learned | No |

## Metadata validation and import

The metadata package is `dhis2/metadata/ebs_tracker.json`.

Validate it against a configured DHIS2 instance without committing:

```bash
python scripts/import_dhis2_metadata.py dhis2/metadata/ebs_tracker.json --dry-run
```

After reviewing the DHIS2 response:

```bash
python scripts/import_dhis2_metadata.py dhis2/metadata/ebs_tracker.json --commit
```

## Preview a new signal

Preview creates valid local DHIS2 UIDs but makes no network request:

```bash
python scripts/submit_ebs_signal.py \
  --signal-id EBS-2026-0001 \
  --title "Unusual fever cluster" \
  --source "Community health worker" \
  --signal-type CLUSTER \
  --description "Seven people with fever in one locality" \
  --org-unit BdDivDha001 \
  --detected-on 2026-08-01 \
  --preview
```

Replace the demonstration organization-unit UID with a real UID before submitting to DHIS2. Use `--commit` only after metadata installation and preview review.

## Custom dashboard API

The custom frontend reads the workflow definition from `GET /api/v1/ebs/schema` and validates signal input with `POST /api/v1/ebs/signals/preview`. Preview mode returns the DHIS2 Tracker enrollment and detection-event payload without making a network write.

Tracker enrollment and event timestamps carry an explicit `+06:00` offset so Bangladesh reporting dates are not misclassified as future UTC dates by DHIS2.

`POST /api/v1/ebs/signals` is protected by `ONEHEALTH_EBS_WRITES_ENABLED`. It defaults to `false`; enable it only after installing the metadata, replacing demonstration organization-unit UIDs, configuring credentials, and completing a reviewed live-instance dry run.

After a detection preview creates an enrollment UID, the custom workspace can build verification, risk-assessment, investigation, response, and closure event previews through `POST /api/v1/ebs/stages/preview`. Required fields and allowed stage fields are enforced by the backend. The matching `POST /api/v1/ebs/stages` write endpoint uses the same disabled-by-default safety setting.

## Saved signal registry

The customized registry reads tracked entities and program events from DHIS2, supports local search over signal ID, title, and source, and maps metadata UIDs back to readable stages and fields. `GET /api/v1/ebs/status` reports configuration state without returning credentials.

## Operational response queue

The customized dashboard converts authorized Tracker records into an operational queue without creating a separate clinical data store. It derives the latest lifecycle stage, risk, officer, response status and deadline from EBS events. Active deadlines are classified as `ON_TRACK`, `DUE_SOON`, `DUE_TODAY`, `OVERDUE`, or `UNSCHEDULED`; completed or closed signals are excluded from overdue notifications.

Responders can assign or update an officer, due date, recommended actions and response status. Each update is saved as a repeatable DHIS2 Response stage event, preserving the Tracker event history and audit trail. Viewers can filter the protected queue and download a server-generated CSV situation report. The notification endpoint produces action items for overdue, due-soon and unassigned signals; it does not send patient data or credentials to an external messaging provider.

| Endpoint | Minimum role | Purpose |
|---|---|---|
| `GET /api/v1/ebs/operations` | Viewer | Queue, summary counts, filters and deadline state |
| `POST /api/v1/ebs/operations/{trackedEntityUid}/assignment` | Responder | Write a repeatable assignment/response event to DHIS2 |
| `GET /api/v1/ebs/notifications` | Viewer | Current operational action notices |
| `GET /api/v1/ebs/reports/situation.csv` | Viewer | Downloadable situation report |

External email, SMS or WhatsApp delivery is intentionally not enabled by default. It should be added only after an approved provider, recipient policy, message template, delivery audit and protected-data review are configured.

Registry endpoints require an authenticated Viewer or higher and are also protected by `ONEHEALTH_EBS_READS_ENABLED=false`. Tracker writes require a Responder or Admin plus the independent write switch. Enabling either flag does not expose DHIS2 credentials to the browser; all DHIS2 requests remain server-side. See [Authentication and Roles](AUTHENTICATION.md).

## Safety boundaries

- The current workflow is for aggregate or non-identifiable event signals.
- Do not enter names, phone numbers, addresses, or patient identifiers.
- Text statuses are intentionally simple in this first metadata version; controlled option sets should be calibrated with program owners before operational deployment.
- DHIS2 access control, sharing, retention, and audit policies must be configured on the live instance.
