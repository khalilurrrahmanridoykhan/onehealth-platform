#!/usr/bin/env python3
"""Normalize public WOAH WAHIS HPAI division-semester data."""

import argparse
from pathlib import Path

from onehealth.services.hpai import normalize_hpai


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument(
        "--output", type=Path, default=Path("data/processed/hpai_semester.csv")
    )
    args = parser.parse_args()
    count = normalize_hpai(args.source, args.output)
    print(f"Wrote {count} HPAI surveillance records to {args.output}")


if __name__ == "__main__":
    main()
