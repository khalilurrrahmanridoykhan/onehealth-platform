#!/usr/bin/env python3
"""Normalize district-level climate data from the sibling bangladesh-climate-disease-synthesis
repository into OneHealth's environment monthly and summary CSVs.

This is a manual, local developer utility. It is not wired into CI or `make reproduce`
because CI only checks out this repository and has no access to the sibling repo.
"""

import argparse
from pathlib import Path

from onehealth.services.environment_import import normalize_monthly, normalize_summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--climate-daily", type=Path, required=True,
                         help="Path to climate_daily_by_district_2017_2025.csv")
    parser.add_argument("--climate-summary", type=Path, required=True,
                         help="Path to district_climate_summary.csv")
    parser.add_argument("--crosswalk", type=Path,
                         default=Path("data/reference/bd_district_crosswalk.csv"))
    parser.add_argument("--monthly-output", type=Path,
                         default=Path("data/processed/environment_district_monthly.csv"))
    parser.add_argument("--summary-output", type=Path,
                         default=Path("data/processed/environment_district_summary.csv"))
    args = parser.parse_args()

    monthly_count = normalize_monthly(args.climate_daily, args.crosswalk, args.monthly_output)
    print(f"Wrote {monthly_count} monthly environment records to {args.monthly_output}")

    summary_count = normalize_summary(args.climate_summary, args.crosswalk, args.summary_output)
    print(f"Wrote {summary_count} district environment summaries to {args.summary_output}")


if __name__ == "__main__":
    main()
