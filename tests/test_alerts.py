from datetime import date, timedelta

from onehealth.models import SurveillanceRecord
from onehealth.services.alerts import generate_latest_alert


def record(week: int, cases: int, complete: bool = True) -> SurveillanceRecord:
    start = date(2026, 1, 5) + timedelta(weeks=week)
    return SurveillanceRecord(
        disease_code="DENGUE",
        disease_name="Dengue",
        period_start=start,
        period_end=start + timedelta(days=6),
        period_type="weekly",
        period_label=f"2026-W{week + 2:02d}",
        location_code="BD",
        location_name="Bangladesh",
        location_level="national",
        cases=cases,
        deaths=None,
        population=None,
        incidence_per_100k=None,
        data_status="observed",
        source_name="Test",
        source_url="https://example.test",
        complete_period=complete,
    )


def test_high_alert_uses_previous_four_complete_weeks():
    records = [record(index, cases) for index, cases in enumerate([100, 100, 100, 100, 170])]

    alert = generate_latest_alert(records)

    assert alert is not None
    assert alert.risk_level == "HIGH"
    assert alert.expected_cases == 100
    assert alert.observed_cases == 170


def test_incomplete_latest_week_is_excluded():
    records = [record(index, cases) for index, cases in enumerate([100, 100, 100, 100, 130])]
    records.append(record(5, 1000, complete=False))

    alert = generate_latest_alert(records)

    assert alert is not None
    assert alert.period == "2026-W06"
    assert alert.observed_cases == 130
    assert alert.risk_level == "MEDIUM"

