from datetime import date, timedelta
from pathlib import Path

from onehealth.services.ingestion import (
    aggregate_dengue_weekly,
    read_dengue_division_weekly,
)


def test_weekly_aggregation_marks_complete_and_partial_weeks():
    monday = date(2026, 1, 5)
    daily = [(monday + timedelta(days=offset), 10) for offset in range(7)]
    daily.extend([(monday + timedelta(days=7), 4)])

    records = aggregate_dengue_weekly(daily)

    assert len(records) == 2
    assert records[0].cases == 70
    assert records[0].complete_period is True
    assert records[0].period_label == "2026-W02"
    assert records[1].cases == 4
    assert records[1].complete_period is False


def test_division_weekly_import_normalizes_barishal(tmp_path: Path):
    source = tmp_path / "division.csv"
    source.write_text(
        "year,week,week_num,division,dengue_cases\n"
        "2026,W01,1,Barisal,67\n"
        "2026,W01,1,Dhaka,25\n",
        encoding="utf-8",
    )

    records = read_dengue_division_weekly(source)

    assert len(records) == 2
    assert records[0].location_code == "BD-BAR"
    assert records[0].location_name == "Barishal"
    assert records[0].location_level == "division"
    assert records[0].complete_period is True
    assert records[1].location_code == "BD-DHA"

