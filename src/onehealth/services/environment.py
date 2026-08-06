import csv
from datetime import date
from pathlib import Path

from onehealth.models import EnvironmentDistrictSummary, EnvironmentMonthlyRecord


def load_environment_monthly(path: Path) -> list[EnvironmentMonthlyRecord]:
    if not path.exists():
        return []

    with path.open(encoding="utf-8", newline="") as handle:
        records = [
            EnvironmentMonthlyRecord(
                location_code=row["location_code"],
                location_name=row["location_name"],
                division_code=row["division_code"],
                division_name=row["division_name"],
                period_start=date.fromisoformat(row["period_start"]),
                period_end=date.fromisoformat(row["period_end"]),
                period_type=row["period_type"],
                period_label=row["period_label"],
                mean_temp_c=float(row["mean_temp_c"]),
                mean_max_temp_c=float(row["mean_max_temp_c"]),
                total_precip_mm=float(row["total_precip_mm"]),
                extreme_heat_days=int(row["extreme_heat_days"]),
                days_observed=int(row["days_observed"]),
                complete_period=row["complete_period"].lower() == "true",
                data_status=row["data_status"],
                source_name=row["source_name"],
                source_url=row["source_url"],
            )
            for row in csv.DictReader(handle)
        ]
    return sorted(records, key=lambda item: (item.location_code, item.period_start))


def load_environment_summary(path: Path) -> list[EnvironmentDistrictSummary]:
    if not path.exists():
        return []

    with path.open(encoding="utf-8", newline="") as handle:
        records = [
            EnvironmentDistrictSummary(
                location_code=row["location_code"],
                location_name=row["location_name"],
                division_code=row["division_code"],
                division_name=row["division_name"],
                mean_temp_c=float(row["mean_temp_c"]),
                mean_annual_precip_mm=float(row["mean_annual_precip_mm"]),
                mean_annual_extreme_heat_days=float(row["mean_annual_extreme_heat_days"]),
                extreme_heat_threshold_c=float(row["extreme_heat_threshold_c"]),
                period_start=date.fromisoformat(row["period_start"]),
                period_end=date.fromisoformat(row["period_end"]),
                data_status=row["data_status"],
                source_name=row["source_name"],
                source_url=row["source_url"],
            )
            for row in csv.DictReader(handle)
        ]
    return sorted(records, key=lambda item: item.location_code)
