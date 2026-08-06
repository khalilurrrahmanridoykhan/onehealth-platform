# Bangladesh Division Map Data

The dashboard uses `frontend/public/bangladesh_divisions.geojson`, an ADM1 boundary extract from geoBoundaries.

- Dataset: geoBoundaries Bangladesh ADM1
- License: CC0 1.0
- Project: <https://www.geoboundaries.org/>
- Geographic level: eight Bangladesh divisions

The map joins surveillance locations to boundary features using `shapeISO`, not display-name spelling. The UI therefore keeps stable platform labels such as Chattogram, Rajshahi, and Barishal even where a source boundary uses an older English spelling.

The polygon rings are normalized for D3's spherical renderer. This prevents a division from being interpreted as the inverse, world-covering polygon. The dashboard validates eight distinct ADM1 features and offers alert-risk, latest-case, and baseline-deviation layers.

These boundaries support demonstration visualization and are not an authoritative statement of administrative or international boundaries.

## Bangladesh District Map Data

The environment (climate) section uses `frontend/public/bangladesh_districts.geojson`, an ADM2 boundary extract from geoBoundaries, generated from the sibling `bangladesh-climate-disease-synthesis` project's `data/external/bgd_adm2_geoboundaries.geojson` via `scripts/build_environment_map.py`.

- Dataset: geoBoundaries Bangladesh ADM2
- License: CC0 1.0
- Project: <https://www.geoboundaries.org/>
- Geographic level: 64 Bangladesh districts (zila)

This file uses a **different join method** from the division map above. The ADM2 source has an empty `shapeISO` on every feature, so the `shapeISO`-lookup-table pattern used for divisions cannot work here. Instead, `scripts/build_environment_map.py` bakes `location_code`, `district_name`, `division_code`, and `division_name` directly into each feature's properties at build time, sourced from `data/reference/bd_district_crosswalk.csv`. The original `shapeName`, `shapeISO`, `shapeID`, `shapeGroup`, and `shapeType` properties are kept for provenance.

The crosswalk also fixes spelling differences between the source data and current official/platform naming (Barisal→Barishal, Bogra→Bogura, Brahamanbaria→Brahmanbaria, Chittagong→Chattogram, Comilla→Cumilla, Jessore→Jashore, Maulvibazar→Moulvibazar, Netrakona→Netrokona). One resolution is flagged as unverified: the source's "Nawabganj" is mapped to Chapainawabganj (Rajshahi Division) as the most plausible match, but this has not been confirmed against the original NASA POWER coordinates and should be spot-checked before being treated as authoritative.

The underlying climate values are a single unweighted NASA POWER grid-cell centroid per district, not area- or population-weighted — this is a materially weaker approximation for large or geographically diverse districts, most notably Bandarban.

Regenerate with:

```
python scripts/build_environment_map.py \
  --source-geojson ../bangladesh-climate-disease-synthesis/data/external/bgd_adm2_geoboundaries.geojson
```

As with the division map, these boundaries support demonstration visualization only and are not an authoritative statement of administrative boundaries.
