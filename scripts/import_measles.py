#!/usr/bin/env python3
"""Normalize public DGHS measles daily totals into ISO surveillance weeks."""

import argparse
from pathlib import Path

from onehealth.services.measles import normalize_measles


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--division-source", type=Path)
    parser.add_argument("--output", type=Path, default=Path("data/processed/measles_weekly.csv"))
    args = parser.parse_args()
    count = normalize_measles(args.source, args.output, args.division_source)
    print(f"Wrote {count} measles surveillance records to {args.output}")


if __name__ == "__main__":
    main()
