import csv
from pathlib import Path

from onehealth.services.hpai import normalize_hpai


def test_hpai_import_adds_division_and_national_semester_rows(tmp_path: Path):
    source = tmp_path / "hpai.csv"
    source.write_text(
        "division,period_start,new_outbreaks\n"
        "Dhaka,2025-01-01,3.0\nKhulna,2025-01-01,1.0\n"
        "Narayanganj Sadar,2025-01-01,2.0\n",
        encoding="utf-8",
    )
    output = tmp_path / "normalized.csv"
    assert normalize_hpai(source, output) == 3
    with output.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    national = next(row for row in rows if row["location_code"] == "BD")
    assert national["cases"] == "6"
    assert national["period_label"] == "2025-S1"
    assert national["period_type"] == "six_monthly"
    dhaka = next(row for row in rows if row["location_code"] == "BD-DHA")
    assert dhaka["cases"] == "5"
