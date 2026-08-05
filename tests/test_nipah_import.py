import csv
from pathlib import Path

from onehealth.services.nipah import normalize_nipah


def test_nipah_import_preserves_deaths_and_cumulative_division_semantics(tmp_path: Path):
    national = tmp_path / "national.csv"
    national.write_text("year,infected,deaths,cross_validated\n2024,5,5,False\n", encoding="utf-8")
    divisions = tmp_path / "division.csv"
    divisions.write_text("division,total_cases\nDhaka,147\n", encoding="utf-8")
    output = tmp_path / "nipah.csv"
    assert normalize_nipah(national, divisions, output) == 2
    with output.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    dhaka = next(row for row in rows if row["location_code"] == "BD-DHA")
    national_row = next(row for row in rows if row["location_code"] == "BD")
    assert dhaka["data_status"] == "cumulative_literature_2001_2021"
    assert dhaka["deaths"] == ""
    assert national_row["deaths"] == "5"
    assert national_row["period_label"] == "2024"
