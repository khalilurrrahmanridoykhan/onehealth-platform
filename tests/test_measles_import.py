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
