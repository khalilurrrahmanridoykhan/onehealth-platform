import csv
from collections import defaultdict
from datetime import date
from pathlib import Path

from onehealth.services.measles import HEADER


DIVISIONS = {
    "Barisal": ("BD-BAR", "Barishal"),
    "Chittagong": ("BD-CTG", "Chattogram"),
    "Dhaka": ("BD-DHA", "Dhaka"),
    "Narayanganj Sadar": ("BD-DHA", "Dhaka"),
    "Khulna": ("BD-KHU", "Khulna"),
    "Rajshahi": ("BD-RAJ", "Rajshahi"),
    "Rangpur": ("BD-RAN", "Rangpur"),
    "Sylhet": ("BD-SYL", "Sylhet"),
}


def normalize_hpai(source: Path, output: Path) -> int:
    """Normalize sparse WAHIS reports without converting reporting gaps to zero."""
    reported: dict[tuple[date, str, str], int] = defaultdict(int)
    national: dict[date, int] = defaultdict(int)
    with source.open(encoding="utf-8-sig", newline="") as handle:
        for source_row in csv.DictReader(handle):
            location = DIVISIONS.get(source_row["division"].strip())
            if location is None:
                continue
            start = date.fromisoformat(source_row["period_start"])
            semester = 1 if start.month == 1 else 2
            end = date(start.year, 6, 30) if semester == 1 else date(start.year, 12, 31)
            outbreaks = int(float(source_row["new_outbreaks"]))
            national[start] += outbreaks
            reported[(start, location[0], location[1])] += outbreaks

    division_rows: list[dict[str, str | int]] = []
    for (start, location_code, location_name), outbreaks in reported.items():
            semester = 1 if start.month == 1 else 2
            end = date(start.year, 6, 30) if semester == 1 else date(start.year, 12, 31)
            division_rows.append({
                "disease_code": "HPAI", "disease_name": "Avian Influenza (HPAI)",
                "period_start": start.isoformat(), "period_end": end.isoformat(),
                "period_type": "six_monthly", "period_label": f"{start.year}-S{semester}",
                "location_code": location_code, "location_name": location_name,
                "location_level": "division", "cases": outbreaks, "deaths": "",
                "population": "", "incidence_per_100k": "", "data_status": "observed",
                "source_name": "WOAH WAHIS quantitative animal-disease data",
                "source_url": "https://wahis.woah.org/#/dashboards/qd-dashboard",
                "complete_period": "True",
            })

    national_rows = []
    for start, outbreaks in national.items():
        semester = 1 if start.month == 1 else 2
        end = date(start.year, 6, 30) if semester == 1 else date(start.year, 12, 31)
        row = division_rows[0].copy()
        row.update({
            "period_start": start.isoformat(), "period_end": end.isoformat(),
            "period_label": f"{start.year}-S{semester}", "location_code": "BD",
            "location_name": "Bangladesh", "location_level": "national",
            "cases": outbreaks,
        })
        national_rows.append(row)

    rows = sorted([*division_rows, *national_rows], key=lambda row: (
        row["period_start"], row["location_code"]
    ))
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADER, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)
