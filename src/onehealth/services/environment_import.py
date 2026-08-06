import calendar
import csv
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from pathlib import Path

EXTREME_HEAT_THRESHOLD_C = 35.0
DATA_STATUS = "modelled_reanalysis_daily_aggregate"
SOURCE_NAME = "NASA POWER via bangladesh-climate-disease-synthesis"
SOURCE_URL = "https://power.larc.nasa.gov/"
SUMMARY_PERIOD_START = date(2017, 1, 1)
SUMMARY_PERIOD_END = date(2025, 12, 31)

MONTHLY_HEADER = [
    "location_code", "location_name", "division_code", "division_name",
    "period_start", "period_end", "period_type", "period_label",
    "mean_temp_c", "mean_max_temp_c", "total_precip_mm", "extreme_heat_days",
    "days_observed", "complete_period", "data_status", "source_name", "source_url",
]

SUMMARY_HEADER = [
    "location_code", "location_name", "division_code", "division_name",
    "mean_temp_c", "mean_annual_precip_mm", "mean_annual_extreme_heat_days",
    "extreme_heat_threshold_c", "period_start", "period_end",
    "data_status", "source_name", "source_url",
]


@dataclass(frozen=True, slots=True)
class CrosswalkEntry:
    location_code: str
    district_name: str
    division_code: str
    division_name: str


def load_crosswalk(path: Path) -> dict[str, CrosswalkEntry]:
    entries: dict[str, CrosswalkEntry] = {}
    with path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            entries[row["source_district_name"]] = CrosswalkEntry(
                location_code=row["location_code"],
                district_name=row["district_name"],
                division_code=row["division_code"],
                division_name=row["division_name"],
            )
    return entries


def _resolve(crosswalk: dict[str, CrosswalkEntry], source_district_name: str) -> CrosswalkEntry:
    try:
        return crosswalk[source_district_name]
    except KeyError as error:
        raise ValueError(
            f"District {source_district_name!r} has no crosswalk entry in "
            "data/reference/bd_district_crosswalk.csv"
        ) from error


def normalize_monthly(daily_csv_path: Path, crosswalk_path: Path, output_path: Path) -> int:
    crosswalk = load_crosswalk(crosswalk_path)
    groups: dict[tuple[str, str], list[tuple[float, float, float]]] = defaultdict(list)

    with daily_csv_path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            entry = _resolve(crosswalk, row["district"])
            month_key = row["date"][:7]
            groups[(entry.location_code, month_key)].append(
                (float(row["T2M"]), float(row["T2M_MAX"]), float(row["PRECTOTCORR"]))
            )

    location_names = {entry.location_code: entry for entry in crosswalk.values()}
    rows: list[dict[str, str]] = []
    for (location_code, month_key), observations in groups.items():
        entry = location_names[location_code]
        year, month = (int(part) for part in month_key.split("-"))
        days_in_month = calendar.monthrange(year, month)[1]
        days_observed = len(observations)
        mean_temp_c = sum(item[0] for item in observations) / days_observed
        mean_max_temp_c = sum(item[1] for item in observations) / days_observed
        total_precip_mm = sum(item[2] for item in observations)
        extreme_heat_days = sum(1 for item in observations if item[1] >= EXTREME_HEAT_THRESHOLD_C)

        rows.append({
            "location_code": location_code,
            "location_name": entry.district_name,
            "division_code": entry.division_code,
            "division_name": entry.division_name,
            "period_start": date(year, month, 1).isoformat(),
            "period_end": date(year, month, days_in_month).isoformat(),
            "period_type": "monthly",
            "period_label": month_key,
            "mean_temp_c": f"{mean_temp_c:.2f}",
            "mean_max_temp_c": f"{mean_max_temp_c:.2f}",
            "total_precip_mm": f"{total_precip_mm:.2f}",
            "extreme_heat_days": str(extreme_heat_days),
            "days_observed": str(days_observed),
            "complete_period": "True" if days_observed == days_in_month else "False",
            "data_status": DATA_STATUS,
            "source_name": SOURCE_NAME,
            "source_url": SOURCE_URL,
        })

    rows.sort(key=lambda row: (row["location_code"], row["period_start"]))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=MONTHLY_HEADER, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


def normalize_summary(summary_csv_path: Path, crosswalk_path: Path, output_path: Path) -> int:
    crosswalk = load_crosswalk(crosswalk_path)
    rows: list[dict[str, str]] = []

    with summary_csv_path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            entry = _resolve(crosswalk, row["district"])
            rows.append({
                "location_code": entry.location_code,
                "location_name": entry.district_name,
                "division_code": entry.division_code,
                "division_name": entry.division_name,
                "mean_temp_c": f"{float(row['mean_temp_c']):.2f}",
                "mean_annual_precip_mm": f"{float(row['mean_annual_precip_mm']):.2f}",
                "mean_annual_extreme_heat_days": f"{float(row['mean_annual_extreme_heat_days']):.2f}",
                "extreme_heat_threshold_c": f"{EXTREME_HEAT_THRESHOLD_C:.1f}",
                "period_start": SUMMARY_PERIOD_START.isoformat(),
                "period_end": SUMMARY_PERIOD_END.isoformat(),
                "data_status": DATA_STATUS,
                "source_name": SOURCE_NAME,
                "source_url": SOURCE_URL,
            })

    rows.sort(key=lambda row: row["location_code"])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=SUMMARY_HEADER, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)
