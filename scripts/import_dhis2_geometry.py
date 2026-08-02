#!/usr/bin/env python3
"""Validate or import Bangladesh division boundary geometry into DHIS2."""

import argparse
import json
from pathlib import Path

from onehealth.config import DHIS2Settings
from onehealth.dhis2.client import DHIS2Client


ISO_TO_UID = {
    "BD-A": "BdDivBar001", "BD-B": "BdDivCtg001", "BD-C": "BdDivDha001",
    "BD-D": "BdDivKhu001", "BD-E": "BdDivRaj001", "BD-F": "BdDivRan001",
    "BD-G": "BdDivSyl001", "BD-H": "BdDivMym001",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("geojson", type=Path)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--commit", action="store_true")
    args = parser.parse_args()
    collection = json.loads(args.geojson.read_text(encoding="utf-8"))
    geometry = {
        ISO_TO_UID[feature["properties"]["shapeISO"]]: feature["geometry"]
        for feature in collection["features"]
    }

    settings = DHIS2Settings.from_env()
    with DHIS2Client(
        settings.base_url, api_token=settings.api_token,
        username=settings.username, password=settings.password,
        verify_ssl=settings.verify_ssl, timeout_seconds=settings.timeout_seconds,
    ) as client:
        current = client.get_json(
            "organisationUnits.json",
            params={
                "filter": f"id:in:[{','.join(geometry)}]",
                "fields": "id,name,shortName,code,openingDate,parent[id]",
            },
        )["organisationUnits"]
        for unit in current:
            unit["geometry"] = geometry[unit["id"]]
        result = client.import_metadata(
            {"organisationUnits": current}, dry_run=not args.commit
        )
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
