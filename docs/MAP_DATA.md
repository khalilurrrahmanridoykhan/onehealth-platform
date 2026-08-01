# Bangladesh Division Map Data

The dashboard uses `frontend/public/bangladesh_divisions.geojson`, an ADM1 boundary extract from geoBoundaries.

- Dataset: geoBoundaries Bangladesh ADM1
- License: CC0 1.0
- Project: <https://www.geoboundaries.org/>
- Geographic level: eight Bangladesh divisions

The map joins surveillance locations to boundary features using `shapeISO`, not display-name spelling. The UI therefore keeps stable platform labels such as Chattogram, Rajshahi, and Barishal even where a source boundary uses an older English spelling.

These boundaries support demonstration visualization and are not an authoritative statement of administrative or international boundaries.
