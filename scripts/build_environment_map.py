#!/usr/bin/env python3
"""Bake district location codes into the ADM2 boundary geojson from the sibling
bangladesh-climate-disease-synthesis project, for the frontend district map.

This is a manual, local developer utility, not wired into CI or `make reproduce`
(CI only checks out this repository and has no access to the sibling repo).
"""

import argparse
import csv
import json
from pathlib import Path


def _signed_area(ring: list) -> float:
    area = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[i + 1][0], ring[i + 1][1]
        area += x1 * y2 - x2 * y1
    return area / 2.0


def _rewind_ring(ring: list, want_clockwise: bool) -> list:
    is_clockwise = _signed_area(ring) < 0
    return ring if is_clockwise == want_clockwise else list(reversed(ring))


def _rewind_polygon(polygon: list) -> list:
    # Matches this project's existing (working) bangladesh_divisions.geojson
    # convention, where exterior rings are clockwise -- not RFC 7946's
    # right-hand rule. Raw geoBoundaries data (shapefile-derived) is
    # counterclockwise, which d3-geo/geoPath renders as the polygon's
    # world-covering inverse: a single filled rectangle instead of the
    # actual district shapes. See docs/MAP_DATA.md.
    return [_rewind_ring(ring, want_clockwise=(index == 0)) for index, ring in enumerate(polygon)]


def _rewind_geometry(geometry: dict) -> dict:
    if geometry["type"] == "Polygon":
        geometry["coordinates"] = _rewind_polygon(geometry["coordinates"])
    elif geometry["type"] == "MultiPolygon":
        geometry["coordinates"] = [_rewind_polygon(polygon) for polygon in geometry["coordinates"]]
    return geometry


def build_environment_map(source_geojson: Path, crosswalk_path: Path, output_path: Path) -> int:
    with crosswalk_path.open(encoding="utf-8-sig", newline="") as handle:
        crosswalk = {row["source_district_name"]: row for row in csv.DictReader(handle)}

    payload = json.loads(source_geojson.read_text(encoding="utf-8"))
    matched = 0
    for feature in payload["features"]:
        source_name = feature["properties"]["shapeName"]
        try:
            entry = crosswalk[source_name]
        except KeyError as error:
            raise ValueError(
                f"District {source_name!r} has no crosswalk entry in "
                "data/reference/bd_district_crosswalk.csv"
            ) from error
        feature["properties"]["location_code"] = entry["location_code"]
        feature["properties"]["district_name"] = entry["district_name"]
        feature["properties"]["division_code"] = entry["division_code"]
        feature["properties"]["division_name"] = entry["division_name"]
        feature["geometry"] = _rewind_geometry(feature["geometry"])
        matched += 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload), encoding="utf-8")
    return matched


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-geojson", type=Path, required=True,
                         help="Path to bgd_adm2_geoboundaries.geojson")
    parser.add_argument("--crosswalk", type=Path,
                         default=Path("data/reference/bd_district_crosswalk.csv"))
    parser.add_argument("--output", type=Path,
                         default=Path("frontend/public/bangladesh_districts.geojson"))
    args = parser.parse_args()

    count = build_environment_map(args.source_geojson, args.crosswalk, args.output)
    print(f"Wrote {count} district boundary features to {args.output}")


if __name__ == "__main__":
    main()
