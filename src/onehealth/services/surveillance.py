import csv
from datetime import date
from pathlib import Path

from onehealth.models import SurveillanceRecord


def _optional_int(value: str | None) -> int | None:
    return int(value) if value not in (None, "") else None


def _optional_float(value: str | None) -> float | None:
    return float(value) if value not in (None, "") else None


def load_surveillance_records(path: Path) -> list[SurveillanceRecord]:
    if not path.exists():
        return []

    with path.open(encoding="utf-8", newline="") as handle:
        records = []
        for row in csv.DictReader(handle):
            records.append(
                SurveillanceRecord(
                    disease_code=row["disease_code"],
                    disease_name=row["disease_name"],
                    period_start=date.fromisoformat(row["period_start"]),
                    period_end=date.fromisoformat(row["period_end"]),
                    period_type=row["period_type"],
                    period_label=row["period_label"],
                    location_code=row["location_code"],
                    location_name=row["location_name"],
                    location_level=row["location_level"],
                    cases=int(row["cases"]),
                    deaths=_optional_int(row.get("deaths")),
                    population=_optional_int(row.get("population")),
                    incidence_per_100k=_optional_float(row.get("incidence_per_100k")),
                    data_status=row["data_status"],
                    source_name=row["source_name"],
                    source_url=row["source_url"],
                    complete_period=row["complete_period"].lower() == "true",
                )
            )
    return sorted(records, key=lambda item: item.period_start)

