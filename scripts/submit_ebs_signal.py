import argparse
import json
from datetime import date

from onehealth.config import DHIS2Settings
from onehealth.dhis2.client import DHIS2Client
from onehealth.dhis2.ebs import EBSSignalInput, build_signal_bundle


def main() -> None:
    parser = argparse.ArgumentParser(description="Create an EBS signal enrollment in DHIS2 Tracker.")
    parser.add_argument("--signal-id", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--signal-type", required=True)
    parser.add_argument("--description", required=True)
    parser.add_argument("--org-unit", required=True, help="Real DHIS2 organization-unit UID")
    parser.add_argument("--detected-on", type=date.fromisoformat, required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--preview", action="store_true", help="Print the Tracker bundle without a network request")
    mode.add_argument("--commit", action="store_true", help="Submit the Tracker bundle to DHIS2")
    args = parser.parse_args()

    bundle = build_signal_bundle(
        EBSSignalInput(
            signal_id=args.signal_id,
            title=args.title,
            source=args.source,
            signal_type=args.signal_type,
            description=args.description,
            org_unit_uid=args.org_unit,
            detected_on=args.detected_on,
        )
    )
    if args.preview:
        print(json.dumps(bundle, indent=2))
        return

    settings = DHIS2Settings.from_env()
    with DHIS2Client(
        settings.base_url,
        api_token=settings.api_token,
        username=settings.username,
        password=settings.password,
        verify_ssl=settings.verify_ssl,
        timeout_seconds=settings.timeout_seconds,
    ) as client:
        result = client.import_tracker_bundle(bundle)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

