import csv
from datetime import date
from pathlib import Path

from onehealth.services.measles import HEADER


DIVISIONS = {
    "Barishal": ("BD-BAR", "Barishal"), "Chattogram": ("BD-CTG", "Chattogram"),
    "Dhaka": ("BD-DHA", "Dhaka"), "Khulna": ("BD-KHU", "Khulna"),
    "Mymensingh": ("BD-MYM", "Mymensingh"), "Rajshahi": ("BD-RAJ", "Rajshahi"),
    "Rangpur": ("BD-RAN", "Rangpur"), "Sylhet": ("BD-SYL", "Sylhet"),
}
SOURCE_NAME = "Kabir et al. (2025) and Ali et al. (2023) literature-derived estimates"
SOURCE_URL = "https://pmc.ncbi.nlm.nih.gov/articles/PMC11922245/"


def _row(year: int, code: str, name: str, level: str, cases: int,
         population: int | str, incidence: float | str) -> dict[str, str | int | float]:
    return {
        "disease_code": "AWD", "disease_name": "Acute Watery Diarrhoea",
        "period_start": date(year, 1, 1).isoformat(), "period_end": date(year, 12, 31).isoformat(),
        "period_type": "annual", "period_label": str(year), "location_code": code,
        "location_name": name, "location_level": level, "cases": cases, "deaths": "",
        "population": population, "incidence_per_100k": incidence,
        "data_status": "literature_derived_ecological_estimate", "source_name": SOURCE_NAME,
        "source_url": SOURCE_URL, "complete_period": "True",
    }


def normalize_awd(source_path: Path, output: Path) -> int:
    rows: list[dict[str, str | int | float]] = []
    national: dict[int, int] = {}
    with source_path.open(encoding="utf-8-sig", newline="") as handle:
        for source in csv.DictReader(handle):
            location = DIVISIONS.get(source["division"].strip())
            if location is None:
                raise ValueError(f"Unknown AWD division: {source['division']}")
            year = int(source["year"]); cases = int(float(source["awd_cases"]))
            national[year] = national.get(year, 0) + cases
            rows.append(_row(year, location[0], location[1], "division", cases,
                             int(float(source["population"])), float(source["incidence_per_100k"])))
    rows.extend(_row(year, "BD", "Bangladesh", "national", cases, "", "") for year, cases in national.items())
    rows.sort(key=lambda row: (row["period_start"], row["location_code"]))
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADER, lineterminator="\n")
        writer.writeheader(); writer.writerows(rows)
    return len(rows)
