import argparse
import json
from pathlib import Path

from onehealth.config import DHIS2Settings
from onehealth.dhis2.client import DHIS2Client


def main() -> None:
    parser = argparse.ArgumentParser(description="Import OneHealth metadata into DHIS2.")
    parser.add_argument(
        "metadata", type=Path, nargs="?", default=Path("dhis2/metadata/dengue_aggregate.json")
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Validate through DHIS2 without committing")
    mode.add_argument("--commit", action="store_true", help="Commit metadata to DHIS2")
    args = parser.parse_args()

    if not args.dry_run and not args.commit:
        parser.error("Choose --dry-run or --commit")

    settings = DHIS2Settings.from_env()
    with args.metadata.open(encoding="utf-8") as handle:
        metadata = json.load(handle)

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
        result = client.import_metadata(metadata, dry_run=not args.commit)
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

