#!/usr/bin/env python3
"""Normalize WHO GHO confirmed malaria cases for Bangladesh."""
import argparse
from pathlib import Path
from onehealth.services.malaria import normalize_malaria
def main():
 p=argparse.ArgumentParser(); p.add_argument("source",type=Path); p.add_argument("--output",type=Path,default=Path("data/processed/malaria_annual.csv")); a=p.parse_args(); print(f"Wrote {normalize_malaria(a.source,a.output)} malaria records to {a.output}")
if __name__=="__main__": main()
