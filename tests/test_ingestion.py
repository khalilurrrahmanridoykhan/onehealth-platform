from datetime import date, timedelta

from onehealth.services.ingestion import aggregate_dengue_weekly


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

