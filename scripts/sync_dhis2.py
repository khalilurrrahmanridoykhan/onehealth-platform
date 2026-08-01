import argparse
import json
from pathlib import Path

from onehealth.config import DEFAULT_DATA_PATH, DHIS2Settings
from onehealth.dhis2 import DHIS2Client, DHIS2Mapping
from onehealth.dhis2.sync import records_to_data_value_sets, sync_records, sync_report
from onehealth.services.surveillance import load_surveillance_records


def main() -> None:
    parser = argparse.ArgumentParser(description="Synchronize normalized surveillance data to DHIS2.")
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA_PATH)
    parser.add_argument("--mapping", type=Path)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--preview", action="store_true", help="Print payloads without contacting DHIS2")
    mode.add_argument("--dry-run", action="store_true", help="Validate payloads through DHIS2 without committing")
    mode.add_argument("--commit", action="store_true", help="Write values to DHIS2")
    parser.add_argument("--report", type=Path, default=Path("data/sync/dhis2_sync_report.json"))
    args = parser.parse_args()

    if not any((args.preview, args.dry_run, args.commit)):
        parser.error("Choose --preview, --dry-run, or --commit")

    settings = None if args.preview else DHIS2Settings.from_env()
    mapping_path = args.mapping or (settings.mapping_path if settings else Path("dhis2/mappings/dengue.json"))
    mapping = DHIS2Mapping.from_path(mapping_path)
    records = load_surveillance_records(args.data)

    if args.preview:
        print(json.dumps(records_to_data_value_sets(records, mapping), indent=2))
        return

    assert settings is not None
    with DHIS2Client(
        settings.base_url,
        api_token=settings.api_token,
        username=settings.username,
        password=settings.password,
        verify_ssl=settings.verify_ssl,
        timeout_seconds=settings.timeout_seconds,
    ) as client:
        info = client.system_info()
        print(f"Connected to DHIS2 {info.get('version', 'unknown version')}")
        results = sync_records(client, records, mapping, dry_run=not args.commit)

    report = sync_report(results)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Processed {report['count']} records; report: {args.report}")


if __name__ == "__main__":
    main()

