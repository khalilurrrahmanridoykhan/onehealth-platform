#!/usr/bin/env python3
"""Normalize cited Nipah national annual and division hotspot tables."""

import argparse
from pathlib import Path

from onehealth.services.nipah import normalize_nipah


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("national_source", type=Path)
    parser.add_argument("division_source", type=Path)
    parser.add_argument("--output", type=Path, default=Path("data/processed/nipah_annual.csv"))
    args = parser.parse_args()
    count = normalize_nipah(args.national_source, args.division_source, args.output)
    print(f"Wrote {count} Nipah surveillance records to {args.output}")


if __name__ == "__main__":
    main()
