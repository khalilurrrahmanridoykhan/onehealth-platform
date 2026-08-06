import csv
from pathlib import Path

from onehealth.services.je import normalize_je


def test_2016_japanese_encephalitis_rows_are_explicitly_partial(tmp_path: Path):
    source = tmp_path / "je_source.csv"
    source.write_text(
        "year,total,Rangpur,Rajshahi,Chittagong,Khulna\n"
        "2015,10,2,3,4,1\n"
        "2016,9,3,2,4,\n",
        encoding="utf-8",
    )
    output = tmp_path / "je_annual.csv"

    normalize_je(source, output)

    with output.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    rows_2015 = [row for row in rows if row["period_label"] == "2015"]
    rows_2016 = [row for row in rows if row["period_label"] == "2016"]
    assert all(row["complete_period"] == "True" for row in rows_2015)
    assert all(row["complete_period"] == "False" for row in rows_2016)
    assert all(row["period_end"] == "2016-07-31" for row in rows_2016)
    assert all(row["data_status"] == "partial_year_through_july" for row in rows_2016)
