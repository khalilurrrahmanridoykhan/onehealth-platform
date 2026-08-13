# Bangladesh Geo Service

A standalone geo lookup + DHIS2 crosswalk API for Bangladesh's Division →
District → Upazila → Union administrative geography. Not a DHIS2 app --
shared infrastructure the rest of `onehealth-platform`'s tools (and anything
else in this portfolio) can depend on, instead of each re-deriving admin
geography from shapefiles.

Sixth sibling to `outbreak-signal-detector/` and
`dhis2-fhir-immunization-bridge/` -- same standalone Node/TS shape, no
server framework, no DHIS2 dependency at runtime.

## Where the data comes from

The full Division/District/Upazila/Union dataset (8/64/590/4,926 units, with
union-level boundary geometry) is generated from the
[`bangladesh-admin-boundary-xlsform`](https://github.com/khalilurrrahmanridoykhan/bangladesh-admin-boundary-xlsform)
project's already-validated `choices` sheet -- not re-derived from the raw
shapefiles a second time here, which would just re-risk the duplicate-code
issue that project's `dissolve()` step already fixed once.

The DHIS2 crosswalk is generated from this monorepo's own
`dhis2/mappings/*.json` disease-surveillance mapping files -- the same files
6 of the 8 disease programs already use for real. Not hand-typed twice.

## The real constraint this API is honest about

The OneHealth DHIS2 instance only has organisation units at **national and
division level** today (9 total: 1 national + 8 divisions, confirmed by
reading every mapping file in `dhis2/mappings/`). There are no
district/upazila/union-level organisation units in DHIS2 yet. So:

- `/geo/*` endpoints serve the full depth (division through union) --
  that data is real and complete on the geography side.
- `/geo/crosswalk/:code` only resolves for **division-level** codes. Asking
  it for a district/upazila/union code returns a `404` with an explicit
  reason, not a silent empty response -- there's nothing real to crosswalk
  to below division level until DHIS2's own organisation unit tree is
  extended, which is a live-production metadata change and a separate
  decision, not something this service does on its own.

## Endpoints

| Endpoint | Returns |
|---|---|
| `GET /geo/division` | All 8 divisions |
| `GET /geo/district?division=<code>` | Districts under a division |
| `GET /geo/upazila?district=<code>` | Upazilas under a district |
| `GET /geo/union?upazila=<code>` | Unions under an upazila (no geometry) |
| `GET /geo/union/:code` | One union's record (geometry omitted) |
| `GET /geo/union/:code?geometry=full` | Same, with the full boundary geoshape |
| `GET /geo/crosswalk/:code` | DHIS2 orgUnit UID for a `div_` code; `404` with a reason for anything finer |

Codes follow the xlsform project's own scheme: `div_30`, `dis_3029`,
`upa_302921`, `uni_302921175` (GEO_CODE-based, so they can never drift from
the source shapefile the way name-based slugs did in the original form).

## Example

```
GET /geo/division
GET /geo/district?division=div_30        # Dhaka's districts, includes dis_3029 (Faridpur)
GET /geo/upazila?district=dis_3029       # includes upa_302921 (Char Bhadrasan)
GET /geo/union?upazila=upa_302921        # includes uni_302921175 (Char Bhadrasan)
GET /geo/union/uni_302921175?geometry=full
GET /geo/crosswalk/div_30                # -> { dhis2OrgUnitUid: "BdDivDha001", ... }
GET /geo/crosswalk/uni_302921175         # -> 404, "national and division level" reason
```

The Dhaka → Faridpur → Char Bhadrasan → Char Bhadrasan union chain above is
the same real location field-verified live in KoboCollect on Android for the
xlsform project (lat 23.571876, lon 89.9895) -- used here as the test fixture
precisely because it's already independently confirmed correct.

## Regenerating the data files

```
npm run build-data        # xlsform choices sheet -> data/admin-geo.json
npm run build-crosswalk    # dhis2/mappings/*.json -> data/dhis2-crosswalk.json
```

`build-data.ts` looks for the source xlsx at
`../../bangladesh-admin-boundary-xlsform/forms/Full Bangladesh Division To Union (with map + boundaries).xlsx`
relative to this repo by default (i.e. a sibling checkout under the same
parent directory) -- pass `--xlsx <path>` if yours lives elsewhere. Both
scripts validate their own output (row counts, name matches) and fail loudly
rather than silently writing bad data.

## Running

```
npm install
npm run build-data && npm run build-crosswalk   # only needed if data/ is empty or stale
npm start                                        # http://localhost:4000
npm test
npm run typecheck
```

## Explicitly out of scope (for now)

- No writes to the live DHIS2 instance, no new organisation units created.
  Extending the crosswalk below division level means writing new org units
  into a production system other services already depend on -- a real,
  separate decision.
- Not deployed as a running service yet. This is the code, tested and
  verified locally; standing it up behind Caddy on the VPS alongside the
  rest of the OneHealth stack is a natural next step, not bundled here.

## License

MIT (matches the rest of `onehealth-platform`). The underlying admin
boundary geometry is derived from third-party government shapefile data --
see the xlsform project's README for that caveat.
