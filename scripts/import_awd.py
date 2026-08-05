#!/usr/bin/env python3
"""Normalize literature-derived annual AWD estimates."""
import argparse
from pathlib import Path
from onehealth.services.awd import normalize_awd

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=Path("data/processed/awd_annual.csv"))
    args = parser.parse_args()
    print(f"Wrote {normalize_awd(args.source, args.output)} AWD records to {args.output}")

if __name__ == "__main__": main()
