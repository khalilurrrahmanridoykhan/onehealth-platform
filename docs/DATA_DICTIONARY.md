# Data Dictionary

## Raw dengue daily input

File: `data/raw/dengue_daily_2026.csv`

| Variable | Type | Unit | Missing values | Allowed values and meaning |
|---|---|---|---|---|
| `date` | ISO date | Calendar day | Not allowed | Valid `YYYY-MM-DD` date; each date must be unique |
| `dengue_cases_daily` | Integer | Admitted dengue cases per day | Not allowed | Zero or greater |

## Normalized weekly surveillance output

File: `data/processed/dengue_weekly.csv`

The output combines national records derived from daily observations with division-level records supplied as weekly aggregates.

Empty CSV cells represent values that are unavailable or not applicable. Empty values are serialized as Python `None` after loading.

| Variable | Type | Unit | Missing values | Allowed values and meaning |
|---|---|---|---|---|
| `disease_code` | String | None | Not allowed | Stable uppercase code; currently `DENGUE` |
| `disease_name` | String | None | Not allowed | Human-readable disease name; currently `Dengue` |
| `period_start` | ISO date | Calendar day | Not allowed | Monday beginning the epidemiological week |
| `period_end` | ISO date | Calendar day | Not allowed | Sunday ending the epidemiological week |
| `period_type` | Category | None | Not allowed | Currently `weekly`; future values may include `daily`, `monthly`, and `annual` |
| `period_label` | String | ISO week | Not allowed | ISO week-year label in `YYYY-Www` format |
| `location_code` | String | None | Not allowed | Stable geographic code; `BD` represents Bangladesh |
| `location_name` | String | None | Not allowed | Human-readable geographic name |
| `location_level` | Category | None | Not allowed | `national`, `division`, `district`, or `upazila` |
| `cases` | Integer | Admitted dengue cases per week | Not allowed | Zero or greater; sum of available daily counts |
| `deaths` | Integer | Deaths per week | Allowed | Zero or greater when reported; empty in the current source |
| `population` | Integer | People | Allowed | Positive denominator when available; empty in the current source |
| `incidence_per_100k` | Float | Cases per 100,000 population | Allowed | Zero or greater when cases and population are available |
| `data_status` | Category | None | Not allowed | `observed`, `estimated`, `modelled`, or `synthetic`; current data are `observed` |
| `source_name` | String | None | Not allowed | Name of the original data publisher or system |
| `source_url` | URL string | None | Not allowed | Public location of the source |
| `complete_period` | Boolean | None | Not allowed | `True` when all seven dates are present; otherwise `False` |

## Raw division-level dengue input

File: `data/raw/dengue_weekly_division_2026.csv`

| Variable | Type | Unit | Missing values | Allowed values and meaning |
|---|---|---|---|---|
| `year` | Integer | Calendar year | Not allowed | Valid ISO week-numbering year |
| `week` | String | Epidemiological week | Not used for calculation | Source display label such as `W01` |
| `week_num` | Integer | Epidemiological week | Not allowed | Valid ISO week number for the supplied year |
| `division` | Category | None | Not allowed | Barisal/Barishal, Chattogram, Dhaka, Khulna, Mymensingh, Rajshahi, Rangpur, or Sylhet |
| `dengue_cases` | Integer | Admitted dengue cases per division-week | Not allowed | Zero or greater |

`Barisal` in the source is normalized to the current display spelling `Barishal`. Weekly source rows are treated as complete reporting periods because the public source provides them as finished weekly aggregates; this does not independently prove facility-level reporting completeness.

## Location codes

| Code | Display name | Level |
|---|---|---|
| `BD` | Bangladesh | National |
| `BD-BAR` | Barishal | Division |
| `BD-CTG` | Chattogram | Division |
| `BD-DHA` | Dhaka | Division |
| `BD-KHU` | Khulna | Division |
| `BD-MYM` | Mymensingh | Division |
| `BD-RAJ` | Rajshahi | Division |
| `BD-RAN` | Rangpur | Division |
| `BD-SYL` | Sylhet | Division |

## Alert output

The alert endpoint returns JSON. Missing alerts are represented by HTTP `404` when fewer than five complete weeks are available.

| Variable | Type | Unit | Allowed values and meaning |
|---|---|---|---|
| `disease_code` | String | None | Disease identifier |
| `location_code` | String | None | Geographic identifier |
| `period` | String | ISO week | Complete week evaluated by the algorithm |
| `risk_level` | Category | None | `LOW`, `MEDIUM`, or `HIGH` |
| `observed_cases` | Integer | Cases | Cases in the evaluated week |
| `expected_cases` | Float | Cases | Mean of the previous four complete weeks |
| `predicted_cases` | Float | Cases | Practice projection combining current cases and baseline |
| `confidence` | Float | Proportion | Heuristic from `0.50` through `0.95`; not a calibrated probability |
| `reasons` | Array of strings | None | Human-readable evidence for the classification |
| `recommended_actions` | Array of strings | None | Suggested verification or routine surveillance actions |
