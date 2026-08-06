#!/usr/bin/env python3
"""Stage, approve, and verify normalized surveillance CSV packages."""

import argparse
import json
from dataclasses import asdict
from pathlib import Path

from onehealth.services.ingestion_gate import (
    IngestionGateError,
    approve_staged_dataset,
    require_approved_dataset,
    stage_normalized_csv,
)


def _stage(args: argparse.Namespace) -> int:
    staged = stage_normalized_csv(args.source, args.staging_root)
    print(
        json.dumps(
            {
                "packageId": staged.package_id,
                "packagePath": str(staged.package_path),
                "status": staged.status,
                "sha256": staged.sha256,
                "quality": staged.quality_report.to_dict(),
            },
            indent=2,
        )
    )
    return 0 if staged.quality_report.passed else 2


def _approve(args: argparse.Namespace) -> int:
    approved = approve_staged_dataset(
        args.package,
        reviewer=args.reviewer,
        expected_sha256=args.checksum,
        note=args.note,
    )
    print(json.dumps(asdict(approved) | {"status": "approved"}, indent=2, default=str))
    return 0


def _verify(args: argparse.Namespace) -> int:
    approved = require_approved_dataset(args.package)
    print(json.dumps(asdict(approved) | {"status": "approved"}, indent=2, default=str))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Manual approval gate for normalized OneHealth surveillance data."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    stage_parser = subparsers.add_parser("stage", help="Create an awaiting-review package")
    stage_parser.add_argument("source", type=Path)
    stage_parser.add_argument(
        "--staging-root", type=Path, default=Path("data/staging")
    )
    stage_parser.set_defaults(handler=_stage)

    approve_parser = subparsers.add_parser("approve", help="Explicitly approve a package")
    approve_parser.add_argument("package", type=Path)
    approve_parser.add_argument("--reviewer", required=True)
    approve_parser.add_argument(
        "--checksum",
        required=True,
        help="The complete SHA-256 displayed by the stage command",
    )
    approve_parser.add_argument("--note")
    approve_parser.set_defaults(handler=_approve)

    verify_parser = subparsers.add_parser(
        "verify", help="Verify approval and all package checksums"
    )
    verify_parser.add_argument("package", type=Path)
    verify_parser.set_defaults(handler=_verify)

    args = parser.parse_args()
    try:
        return args.handler(args)
    except IngestionGateError as exc:
        parser.exit(1, f"Ingestion gate blocked: {exc}\n")


if __name__ == "__main__":
    raise SystemExit(main())
