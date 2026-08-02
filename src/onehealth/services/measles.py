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


def normalize_measles(source: Path, output: Path) -> int:
    weeks: dict[date, list[tuple[date, int]]] = defaultdict(list)
    with source.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            observed_on = date.fromisoformat(row["Date"])
            week_start = observed_on - timedelta(days=observed_on.weekday())
            weeks[week_start].append((observed_on, int(row["Suspected Cases (24h)"])))

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADER)
        writer.writeheader()
        for week_start, observations in sorted(weeks.items()):
            week_end = week_start + timedelta(days=6)
            year, week, _ = week_start.isocalendar()
            writer.writerow({
                "disease_code": "MEASLES", "disease_name": "Measles",
                "period_start": week_start.isoformat(), "period_end": week_end.isoformat(),
                "period_type": "weekly", "period_label": f"{year}-W{week:02d}",
                "location_code": "BD", "location_name": "Bangladesh",
                "location_level": "national", "cases": sum(value for _, value in observations),
                "deaths": "", "population": "", "incidence_per_100k": "",
                "data_status": "observed", "source_name": "DGHS Bangladesh measles press releases",
                "source_url": "https://dghs.gov.bd/pages/press-releases/",
                "complete_period": str(len({day for day, _ in observations}) == 7),
            })
    return len(weeks)
