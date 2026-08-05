import csv
from datetime import date
from pathlib import Path

from onehealth.services.measles import HEADER


SITES = {
    "Rangpur": ("BD-RAN", "Rangpur"),
    "Rajshahi": ("BD-RAJ", "Rajshahi"),
    "Chittagong": ("BD-CTG", "Chattogram"),
    "Khulna": ("BD-KHU", "Khulna"),
}
SOURCE_NAME = "Paul et al. (2020) hospital-based sentinel surveillance"
SOURCE_URL = "https://doi.org/10.1016/j.ijid.2020.07.026"


def _row(year: int, code: str, name: str, level: str, cases: int) -> dict[str, str | int]:
    return {
        "disease_code": "JE", "disease_name": "Japanese Encephalitis",
        "period_start": date(year, 1, 1).isoformat(),
        "period_end": (date(year, 7, 31) if year == 2016 else date(year, 12, 31)).isoformat(),
        "period_type": "annual", "period_label": str(year),
        "location_code": code, "location_name": name, "location_level": level,
        "cases": cases, "deaths": "", "population": "", "incidence_per_100k": "",
        "data_status": "partial_year_through_july" if year == 2016 else "single_source_literature",
        "source_name": SOURCE_NAME, "source_url": SOURCE_URL, "complete_period": "True",
    }


def normalize_je(source_path: Path, output: Path) -> int:
    rows: list[dict[str, str | int]] = []
    with source_path.open(encoding="utf-8-sig", newline="") as handle:
        for source in csv.DictReader(handle):
            year = int(source["year"])
            rows.append(_row(year, "BD", "Bangladesh", "national", int(float(source["total"]))))
            for column, (code, name) in SITES.items():
                value = source.get(column, "").strip()
                if value:
                    rows.append(_row(year, code, name, "division", int(float(value))))
    rows.sort(key=lambda row: (row["period_start"], row["location_code"]))
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADER, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)
