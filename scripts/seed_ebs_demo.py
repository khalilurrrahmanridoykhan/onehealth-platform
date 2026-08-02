#!/usr/bin/env python3
"""Preview or seed non-identifiable operational EBS demonstration records."""

import argparse
from datetime import date

from onehealth.config import DHIS2Settings
from onehealth.dhis2 import DHIS2Client, DHIS2Mapping
from onehealth.dhis2.ebs import EBS_ATTRIBUTES, EBS_PROGRAM_UID
from onehealth.services.demo_data import build_demo_bundles


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", action="store_true", help="Write missing demo records to DHIS2")
    args = parser.parse_args()
    settings = DHIS2Settings.from_env()
    mapping = DHIS2Mapping.from_path(settings.mapping_path)
    org_units = {code: location.uid for code, location in mapping.locations.items()}
    bundles = build_demo_bundles(org_units, today=date.today())

    with DHIS2Client(
        settings.base_url,
        api_token=settings.api_token,
        username=settings.username,
        password=settings.password,
        verify_ssl=settings.verify_ssl,
        timeout_seconds=settings.timeout_seconds,
    ) as client:
        response = client.get_tracked_entities(program=EBS_PROGRAM_UID, page=1, page_size=100)
        entities = response.get("instances", response.get("trackedEntities", []))
        signal_attribute = EBS_ATTRIBUTES["signal_id"]
        existing = {
            str(attribute.get("value"))
            for entity in entities
            for attribute in entity.get("attributes", [])
            if attribute.get("attribute") == signal_attribute
        }
        created = skipped = 0
        for signal_id, bundle in bundles:
            if signal_id in existing:
                print(f"SKIP {signal_id}: already exists")
                skipped += 1
            elif not args.commit:
                print(f"PREVIEW {signal_id}: {len(bundle['events'])} lifecycle events")
            else:
                client.import_tracker_bundle(bundle)
                print(f"CREATED {signal_id}: {len(bundle['events'])} lifecycle events")
                created += 1
    mode = "COMMIT" if args.commit else "PREVIEW"
    print(f"{mode} complete: {created} created, {skipped} skipped, {len(bundles) - created - skipped} pending")


if __name__ == "__main__":
    main()
