import csv
from datetime import date
from pathlib import Path

from onehealth.services.measles import HEADER


DIVISIONS = {
    "Barisal": ("BD-BAR", "Barishal"), "Chittagong": ("BD-CTG", "Chattogram"),
    "Dhaka": ("BD-DHA", "Dhaka"), "Khulna": ("BD-KHU", "Khulna"),
    "Mymensingh": ("BD-MYM", "Mymensingh"), "Rajshahi": ("BD-RAJ", "Rajshahi"),
    "Rangpur": ("BD-RAN", "Rangpur"), "Sylhet": ("BD-SYL", "Sylhet"),
}
SOURCE_NAME = "Satter et al. (2023) and Bhowmik et al. (2024) literature compilation"
SOURCE_URL = "https://doi.org/10.1371/journal.pntd.0011617"


def _row(year: int, code: str, name: str, level: str, cases: int,
         deaths: int | str, status: str) -> dict[str, str | int]:
    return {
        "disease_code": "NIPAH", "disease_name": "Nipah Virus",
        "period_start": date(year, 1, 1).isoformat(),
        "period_end": date(year, 12, 31).isoformat(), "period_type": "annual",
        "period_label": str(year), "location_code": code, "location_name": name,
        "location_level": level, "cases": cases, "deaths": deaths,
        "population": "", "incidence_per_100k": "", "data_status": status,
        "source_name": SOURCE_NAME, "source_url": SOURCE_URL, "complete_period": "True",
    }


def normalize_nipah(national_source: Path, division_source: Path, output: Path) -> int:
    rows: list[dict[str, str | int]] = []
    with national_source.open(encoding="utf-8-sig", newline="") as handle:
        for source in csv.DictReader(handle):
            rows.append(_row(
                int(source["year"]), "BD", "Bangladesh", "national",
                int(source["infected"]), int(source["deaths"]),
                "cross_validated_literature" if source["cross_validated"].lower() == "true"
                else "single_source_literature",
            ))
    with division_source.open(encoding="utf-8-sig", newline="") as handle:
        for source in csv.DictReader(handle):
            location = DIVISIONS.get(source["division"].strip())
            if location is None:
                continue
            rows.append(_row(
                2021, location[0], location[1], "division",
                int(source["total_cases"]), "", "cumulative_literature_2001_2021",
            ))
    rows.sort(key=lambda row: (row["period_start"], row["location_code"]))
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADER, lineterminator="\n")
        writer.writeheader(); writer.writerows(rows)
    return len(rows)
