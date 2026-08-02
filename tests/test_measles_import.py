import csv
from pathlib import Path

from onehealth.services.measles import normalize_measles


def test_measles_import_aggregates_daily_suspected_cases(tmp_path: Path):
    source = tmp_path / "measles.csv"
    source.write_text(
        "Date,Suspected Cases (24h)\n" +
        "\n".join(f"2026-04-{day:02d},{day}" for day in range(6, 13)) + "\n",
        encoding="utf-8",
    )
    output = tmp_path / "weekly.csv"

    assert normalize_measles(source, output) == 1
    with output.open(newline="", encoding="utf-8") as handle:
        row = next(csv.DictReader(handle))
    assert row["disease_code"] == "MEASLES"
    assert row["period_label"] == "2026-W15"
    assert row["cases"] == str(sum(range(6, 13)))
    assert row["complete_period"] == "True"


def test_measles_import_filters_pdf_noise_and_adds_divisions(tmp_path: Path):
    national = tmp_path / "national.csv"
    national.write_text(
        "Date,Suspected Cases (24h)\n" +
        "\n".join(f"2026-04-{day:02d},100" for day in range(6, 13)) + "\n",
        encoding="utf-8",
    )
    divisions = tmp_path / "divisions.csv"
    divisions.write_text(
        "date,division,suspected_24h\n" +
        "\n".join(f"2026-04-{day:02d},Dhaka,40" for day in range(6, 13)) +
        "\n2026-04-06,Dhaka,4000000\n2026-04-06,Total,100\n",
        encoding="utf-8",
    )
    output = tmp_path / "weekly.csv"

    assert normalize_measles(national, output, divisions) == 2
    with output.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    dhaka = next(row for row in rows if row["location_code"] == "BD-DHA")
    assert dhaka["cases"] == "280"
    assert dhaka["complete_period"] == "True"
