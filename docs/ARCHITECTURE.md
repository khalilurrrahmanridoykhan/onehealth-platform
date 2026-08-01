# Architecture

## Target architecture

```text
DGHS and research data sources
              ↓
     Ingestion adapters
              ↓
       Validation layer
              ↓
 DHIS2 health-data backend
              ↓
Integration and prediction API
              ↓
Customized React dashboard
              ↓
Alerts, investigations, and actions
```

## Current milestone

The repository currently implements ingestion, the normalized domain model, the alert service, FastAPI, and the DHIS2 aggregate-data integration boundary. It can preview or submit metadata and weekly data-value payloads and can read DHIS2 values through the API. Live-instance validation still requires configured DHIS2 access.

FastAPI is intended to become an integration and prediction layer. It is not intended to replace DHIS2 as the target health-data backend.

## Planned DHIS2 responsibilities

- Organization units and geographic hierarchy
- Disease indicators and aggregate surveillance values
- EBS signals and verification status
- Risk assessments and investigations
- Alert records and response actions where appropriate
- User roles and auditable program workflows

## Planned application responsibilities

- Source-specific ingestion and validation
- DHIS2 API synchronization
- Prediction and explainable alert generation
- Customized dashboard experience
- Map, trend, and alert visualization
- Notification integrations

## Design principles

1. Preserve provenance for every observation.
2. Separate observed, estimated, modelled, and synthetic data.
3. Exclude incomplete periods from automated alert decisions by default.
4. Keep prediction explanations alongside predictions.
5. Avoid storing patient identifiers in the research prototype.
6. Treat alert thresholds as configurable and subject to validation.
