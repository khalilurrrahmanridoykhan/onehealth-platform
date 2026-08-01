# Surveillance Data Model

The normalized record is designed to support multiple diseases, reporting periods, and geographic levels before mapping to DHIS2 metadata.

For variable types, units, allowed values, and missing-value conventions, see the complete [data dictionary](DATA_DICTIONARY.md).

| Field | Meaning |
|---|---|
| `disease_code` | Stable machine-readable disease identifier |
| `disease_name` | Human-readable disease name |
| `period_start` | First date of the reporting period |
| `period_end` | Last date of the reporting period |
| `period_type` | Daily, weekly, monthly, or annual |
| `period_label` | Stable display and exchange label |
| `location_code` | Stable geographic identifier |
| `location_name` | Human-readable location |
| `location_level` | National, division, district, or upazila |
| `cases` | Reported case count |
| `deaths` | Reported death count when available |
| `population` | Population denominator when available |
| `incidence_per_100k` | Derived incidence when available |
| `data_status` | Observed, estimated, modelled, or synthetic |
| `source_name` | Original source name |
| `source_url` | Original source URL |
| `complete_period` | Whether all expected observations are present |

## DHIS2 mapping direction

The next design step will map:

- `location_code` to DHIS2 organization-unit UIDs
- disease measures to DHIS2 data elements
- reporting periods to DHIS2 period formats
- EBS signals and investigations to Tracker program stages
- generated alerts to auditable event or tracked-entity records

Mappings should be configuration-driven so the application can work with different DHIS2 instances without hardcoded UIDs.
