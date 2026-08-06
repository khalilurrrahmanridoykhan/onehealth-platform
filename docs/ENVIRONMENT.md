# Environment (Climate) Data Overlay

## Scope

This module surfaces district-level climate data (temperature, precipitation, extreme-heat days) as a read-only overlay in the dashboard. It is **not** an AWD or disease-correlation module — no statistical link between climate and any disease is computed or claimed here. That analysis remains a separate, future step (see the project status table in the main README).

The data never goes to DHIS2: it is not disease case-count data, has no data elements or org-unit mappings in `dhis2/mappings/`, and does not pass through the manual ingestion approval gate (`docs/INGESTION_GATE.md`), which only guards DHIS2 writes. The FastAPI read layer serves it directly from processed CSVs, the same way it serves every other module's data.

## Source and provenance

- **Climate observations**: NASA POWER (MERRA-2 reanalysis), a single unweighted grid-cell centroid per district, pulled by the companion [`bangladesh-climate-disease-synthesis`](https://github.com/khalilurrrahmanridoykhan/bangladesh-climate-disease-synthesis) project. Daily, 2017-01-01 to 2025-12-31.
- **District boundaries**: geoBoundaries Bangladesh ADM2, CC0 1.0.

## District identifier scheme

Neither the source climate data nor the boundary geojson carries a standard administrative code (geoBoundaries' `shapeISO` is empty for every district; `shapeID` is an internal, non-standard geoBoundaries identifier). `data/reference/bd_district_crosswalk.csv` mints new internal codes (`BD-D-<NAME>`) and fixes ~8 known spelling mismatches between the source data and current official/platform naming:

| Source spelling | Canonical spelling |
|---|---|
| Barisal | Barishal |
| Bogra | Bogura |
| Brahamanbaria | Brahmanbaria (typo fix) |
| Chittagong | Chattogram |
| Comilla | Cumilla |
| Jessore | Jashore |
| Maulvibazar | Moulvibazar |
| Netrakona | Netrokona |

One resolution is **unverified**: the source's "Nawabganj" is mapped to `BD-D-CHAPAINAWABGANJ` (Chapainawabganj, Rajshahi Division) as the most plausible match, since it is ambiguous with other historically-named Nawabganj locations. This has not been confirmed against the original NASA POWER pull coordinates and should be spot-checked. The environment data-trust report surfaces this as a standing `unverified_crosswalk_entries` `WARNING`, not a silent pass.

## Processed file schemas

`data/processed/environment/district_monthly.csv` (6,912 rows: 64 districts × 108 months, 2017-01 to 2025-12):

```
location_code,location_name,division_code,division_name,period_start,period_end,period_type,
period_label,mean_temp_c,mean_max_temp_c,total_precip_mm,extreme_heat_days,days_observed,
complete_period,data_status,source_name,source_url
```

`data/processed/environment/district_summary.csv` (64 rows, one per district):

```
location_code,location_name,division_code,division_name,mean_temp_c,mean_annual_precip_mm,
mean_annual_extreme_heat_days,extreme_heat_threshold_c,period_start,period_end,
data_status,source_name,source_url
```

`extreme_heat_days` counts days where `T2M_MAX >= 35.0°C`.

## Why monthly, not daily

The source daily CSV is 210,369 rows (7.4MB) — far larger than any other processed file this platform loads fully into memory on every cache refresh. It is not committed here; the monthly aggregate (6,912 rows) is generated from it locally and is what the live API and dashboard actually serve.

## API endpoints

| Endpoint | Returns |
|---|---|
| `GET /api/v1/environment/districts` | All 64 district summaries |
| `GET /api/v1/environment/districts/{location_code}` | One summary, `404` if unknown |
| `GET /api/v1/environment/districts/{location_code}/monthly?limit=60` | Ascending monthly records, `limit` clamped 1–120 |
| `GET /api/v1/environment/data-trust` | Coverage, freshness, provenance, and quality report |

All public, no authentication required — same posture as the disease Data Trust read endpoints.

## Frontend

A standalone "Climate & environment" navigation section (not folded into the disease dropdown, since every existing chart/table component is hard-wired to case-count/risk-level semantics). Renders a district choropleth map, a sortable district table, a monthly temperature/precipitation trend chart for the selected district, and its own evidence panel — independent of whichever disease is selected elsewhere on the dashboard.

## Limitations

- NASA POWER values are a single unweighted grid-cell centroid per district, not area- or population-weighted — materially weaker for large or geographically diverse districts, most notably Bandarban.
- Static, one-time data pull as of August 2026 with no automated refresh; the series is capped at 2025-12-31.
- MERRA-2/NASA POWER data prior to 2017 has a documented discontinuity and wrong-sign trend bug in the same underlying data family; this window deliberately starts at 2017 to avoid it.
- Visualization only — no statistical correlation with AWD or any other disease is computed or claimed.
- The Nawabganj → Chapainawabganj district resolution is unverified (see above).

## Regenerating the data

Manual, local developer utilities — not wired into CI or `make reproduce` (CI only checks out this repository and has no access to the sibling `bangladesh-climate-disease-synthesis` repo):

```bash
python scripts/import_environment.py \
  --climate-daily ../bangladesh-climate-disease-synthesis/data/processed/climate_daily_by_district_2017_2025.csv \
  --climate-summary ../bangladesh-climate-disease-synthesis/data/processed/district_climate_summary.csv

python scripts/build_environment_map.py \
  --source-geojson ../bangladesh-climate-disease-synthesis/data/external/bgd_adm2_geoboundaries.geojson
```
