import csv
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path


HEADER = [
    "disease_code", "disease_name", "period_start", "period_end", "period_type",
    "period_label", "location_code", "location_name", "location_level", "cases",
    "deaths", "population", "incidence_per_100k", "data_status", "source_name",
    "source_url", "complete_period",
]

DIVISIONS = {
    "Barishal": ("BD-BAR", "Barishal"),
    "Barisal": ("BD-BAR", "Barishal"),
    "Chattogram": ("BD-CTG", "Chattogram"),
    "Chittagong": ("BD-CTG", "Chattogram"),
    "Dhaka": ("BD-DHA", "Dhaka"),
    "Khulna": ("BD-KHU", "Khulna"),
    "Mymensingh": ("BD-MYM", "Mymensingh"),
    "Rajshahi": ("BD-RAJ", "Rajshahi"),
    "Rangpur": ("BD-RAN", "Rangpur"),
    "Sylhet": ("BD-SYL", "Sylhet"),
}


def _record(
    week_start: date,
    observations: list[tuple[date, int]],
    location_code: str,
    location_name: str,
    location_level: str,
) -> dict[str, str | int]:
    week_end = week_start + timedelta(days=6)
    year, week, _ = week_start.isocalendar()
    return {
        "disease_code": "MEASLES", "disease_name": "Measles",
        "period_start": week_start.isoformat(), "period_end": week_end.isoformat(),
        "period_type": "weekly", "period_label": f"{year}-W{week:02d}",
        "location_code": location_code, "location_name": location_name,
        "location_level": location_level, "cases": sum(value for _, value in observations),
        "deaths": "", "population": "", "incidence_per_100k": "",
        "data_status": "observed", "source_name": "DGHS Bangladesh measles press releases",
        "source_url": "https://dghs.gov.bd/pages/press-releases/",
        "complete_period": str(len({day for day, _ in observations}) == 7),
    }


def normalize_measles(
    source: Path,
    output: Path,
    division_source: Path | None = None,
) -> int:
    weeks: dict[date, list[tuple[date, int]]] = defaultdict(list)
    national_by_date: dict[date, int] = {}
    with source.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            observed_on = date.fromisoformat(row["Date"])
            value = int(row["Suspected Cases (24h)"])
            week_start = observed_on - timedelta(days=observed_on.weekday())
            weeks[week_start].append((observed_on, value))
            national_by_date[observed_on] = value

    division_weeks: dict[tuple[str, date], list[tuple[date, int]]] = defaultdict(list)
    if division_source is not None:
        with division_source.open(encoding="utf-8-sig", newline="") as handle:
            for row in csv.DictReader(handle):
                division = DIVISIONS.get(row["division"].strip())
                if division is None:
                    continue
                observed_on = date.fromisoformat(row["date"])
                national_value = national_by_date.get(observed_on)
                value = int(row["suspected_24h"])
                # PDF extraction also captures vaccination tables. A division's
                # daily count cannot exceed the corresponding national count.
                if national_value is None or value < 0 or value > national_value:
                    continue
                week_start = observed_on - timedelta(days=observed_on.weekday())
                division_weeks[(division[0], week_start)].append((observed_on, value))

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADER, lineterminator="\n")
        writer.writeheader()
        rows = [_record(start, values, "BD", "Bangladesh", "national")
                for start, values in weeks.items()]
        for (location_code, week_start), observations in division_weeks.items():
            location_name = next(
                name for code, name in DIVISIONS.values() if code == location_code
            )
            rows.append(_record(
                week_start, observations, location_code, location_name, "division"
            ))
        writer.writerows(sorted(rows, key=lambda row: (row["period_start"], row["location_code"])))
    return len(rows)
