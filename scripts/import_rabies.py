#!/usr/bin/env python3
"""Normalize WHO GHO national human-rabies death records."""
import argparse
from pathlib import Path
from onehealth.services.rabies import normalize_rabies

def main() -> None:
    parser=argparse.ArgumentParser(); parser.add_argument("source",type=Path); parser.add_argument("--output",type=Path,default=Path("data/processed/rabies_annual.csv")); args=parser.parse_args()
    print(f"Wrote {normalize_rabies(args.source,args.output)} rabies records to {args.output}")
if __name__=="__main__": main()
