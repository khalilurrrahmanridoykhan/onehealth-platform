import csv
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

from onehealth.models import SurveillanceRecord


DENGUE_SOURCE_NAME = "DGHS HEOC Dengue Dynamic Dashboard"
DENGUE_SOURCE_URL = "https://dashboard.dghs.gov.bd/pages/heoc_dengue_v1.php"

DIVISION_LOCATIONS = {
    "Barisal": ("BD-BAR", "Barishal"),
    "Barishal": ("BD-BAR", "Barishal"),
    "Chattogram": ("BD-CTG", "Chattogram"),
    "Dhaka": ("BD-DHA", "Dhaka"),
    "Khulna": ("BD-KHU", "Khulna"),
    "Mymensingh": ("BD-MYM", "Mymensingh"),
    "Rajshahi": ("BD-RAJ", "Rajshahi"),
    "Rangpur": ("BD-RAN", "Rangpur"),
    "Sylhet": ("BD-SYL", "Sylhet"),
}


def _week_bounds(day: date) -> tuple[date, date]:
    start = day - timedelta(days=day.weekday())
    return start, start + timedelta(days=6)


def read_dengue_daily(path: Path) -> list[tuple[date, int]]:
    rows: list[tuple[date, int]] = []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"date", "dengue_cases_daily"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError(f"Expected columns {sorted(required)} in {path}")

        for line_number, row in enumerate(reader, start=2):
            try:
                day = date.fromisoformat(row["date"])
                cases = int(row["dengue_cases_daily"])
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Invalid dengue row at line {line_number}") from exc
            if cases < 0:
                raise ValueError(f"Cases cannot be negative at line {line_number}")
            rows.append((day, cases))

    if not rows:
        raise ValueError(f"No dengue observations found in {path}")
    if len({day for day, _ in rows}) != len(rows):
        raise ValueError("Duplicate dates found in dengue daily data")
    return sorted(rows)


def aggregate_dengue_weekly(
    daily_rows: list[tuple[date, int]],
) -> list[SurveillanceRecord]:
    grouped: dict[date, list[tuple[date, int]]] = defaultdict(list)
    for day, cases in daily_rows:
        week_start, _ = _week_bounds(day)
        grouped[week_start].append((day, cases))

    records: list[SurveillanceRecord] = []
    for week_start in sorted(grouped):
        observations = grouped[week_start]
        week_end = week_start + timedelta(days=6)
        dates_present = {day for day, _ in observations}
        expected_dates = {week_start + timedelta(days=offset) for offset in range(7)}
        iso_year, iso_week, _ = week_start.isocalendar()
        records.append(
            SurveillanceRecord(
                disease_code="DENGUE",
                disease_name="Dengue",
                period_start=week_start,
                period_end=week_end,
                period_type="weekly",
                period_label=f"{iso_year}-W{iso_week:02d}",
                location_code="BD",
                location_name="Bangladesh",
                location_level="national",
                cases=sum(cases for _, cases in observations),
                deaths=None,
                population=None,
                incidence_per_100k=None,
                data_status="observed",
                source_name=DENGUE_SOURCE_NAME,
                source_url=DENGUE_SOURCE_URL,
                complete_period=dates_present == expected_dates,
            )
        )
    return records


def read_dengue_division_weekly(path: Path) -> list[SurveillanceRecord]:
    records: list[SurveillanceRecord] = []
    seen: set[tuple[int, int, str]] = set()
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {"year", "week_num", "division", "dengue_cases"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ValueError(f"Expected columns {sorted(required)} in {path}")

        for line_number, row in enumerate(reader, start=2):
            try:
                year = int(row["year"])
                week = int(row["week_num"])
                cases = int(row["dengue_cases"])
                source_division = row["division"].strip()
                location_code, location_name = DIVISION_LOCATIONS[source_division]
                week_start = date.fromisocalendar(year, week, 1)
            except (KeyError, TypeError, ValueError) as exc:
                raise ValueError(
                    f"Invalid division-level dengue row at line {line_number}"
                ) from exc
            if cases < 0:
                raise ValueError(f"Cases cannot be negative at line {line_number}")

            key = (year, week, location_code)
            if key in seen:
                raise ValueError(f"Duplicate division/week at line {line_number}: {key}")
            seen.add(key)
            records.append(
                SurveillanceRecord(
                    disease_code="DENGUE",
                    disease_name="Dengue",
                    period_start=week_start,
                    period_end=week_start + timedelta(days=6),
                    period_type="weekly",
                    period_label=f"{year}-W{week:02d}",
                    location_code=location_code,
                    location_name=location_name,
                    location_level="division",
                    cases=cases,
                    deaths=None,
                    population=None,
                    incidence_per_100k=None,
                    data_status="observed",
                    source_name=DENGUE_SOURCE_NAME,
                    source_url=DENGUE_SOURCE_URL,
                    complete_period=True,
                )
            )

    if not records:
        raise ValueError(f"No division-level dengue observations found in {path}")
    return sorted(records, key=lambda item: (item.location_code, item.period_start))


CSV_FIELDS = (
    "disease_code",
    "disease_name",
    "period_start",
    "period_end",
    "period_type",
    "period_label",
    "location_code",
    "location_name",
    "location_level",
    "cases",
    "deaths",
    "population",
    "incidence_per_100k",
    "data_status",
    "source_name",
    "source_url",
    "complete_period",
)


def write_surveillance_csv(records: list[SurveillanceRecord], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS, lineterminator="\n")
        writer.writeheader()
        for record in records:
            writer.writerow(
                {
                    field: getattr(record, field).isoformat()
                    if isinstance(getattr(record, field), date)
                    else getattr(record, field)
                    for field in CSV_FIELDS
                }
            )
