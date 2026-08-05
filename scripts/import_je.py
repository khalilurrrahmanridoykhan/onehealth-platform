#!/usr/bin/env python3
"""Normalize cited Japanese encephalitis sentinel-site surveillance data."""

import argparse
from pathlib import Path

from onehealth.services.je import normalize_je


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=Path("data/processed/je_annual.csv"))
    args = parser.parse_args()
    count = normalize_je(args.source, args.output)
    print(f"Wrote {count} Japanese encephalitis records to {args.output}")


if __name__ == "__main__":
    main()
