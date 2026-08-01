import argparse
from pathlib import Path

from onehealth.config import DEFAULT_DATA_PATH
from onehealth.services.ingestion import (
    aggregate_dengue_weekly,
    read_dengue_daily,
    read_dengue_division_weekly,
    write_surveillance_csv,
)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Normalize the DGHS dengue daily CSV into weekly OneHealth records."
    )
    parser.add_argument("source", type=Path, help="Path to dengue_daily_2026.csv")
    parser.add_argument(
        "--division-source",
        type=Path,
        help="Optional path to dengue_weekly_division_2026.csv",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_DATA_PATH)
    args = parser.parse_args()

    records = aggregate_dengue_weekly(read_dengue_daily(args.source))
    if args.division_source:
        records.extend(read_dengue_division_weekly(args.division_source))
        records.sort(key=lambda item: (item.location_code, item.period_start))
    write_surveillance_csv(records, args.output)
    complete = sum(record.complete_period for record in records)
    print(f"Wrote {len(records)} weekly records to {args.output}")
    print(f"Complete weeks: {complete}; incomplete weeks: {len(records) - complete}")


if __name__ == "__main__":
    main()
