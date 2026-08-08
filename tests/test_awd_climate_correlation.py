import statistics
from dataclasses import replace
from datetime import date

import pytest

from onehealth.models import EnvironmentMonthlyRecord, SurveillanceRecord
from onehealth.services.awd_climate_correlation import build_awd_climate_correlation_report


def _monthly_records(
    location_code: str,
    division_code: str,
    division_name: str,
    year: int,
    *,
    mean_temp_c: float,
    precip_per_month: float,
    heat_days_per_month: int,
) -> list[EnvironmentMonthlyRecord]:
    records = []
    for month in range(1, 13):
        records.append(
            EnvironmentMonthlyRecord(
                location_code=location_code,
                location_name=location_code,
                division_code=division_code,
                division_name=division_name,
                period_start=date(year, month, 1),
                period_end=date(year, month, 28),
                period_type="monthly",
                period_label=f"{year}-{month:02d}",
                mean_temp_c=mean_temp_c,
                mean_max_temp_c=mean_temp_c + 5,
                total_precip_mm=precip_per_month,
                extreme_heat_days=heat_days_per_month,
                days_observed=28,
                complete_period=True,
                data_status="modelled_reanalysis_daily_aggregate",
                source_name="NASA POWER",
                source_url="https://power.larc.nasa.gov/",
            )
        )
    return records


def _awd_record(location_code: str, location_name: str, year: int, incidence: float) -> SurveillanceRecord:
    return SurveillanceRecord(
        disease_code="AWD",
        disease_name="Acute Watery Diarrhoea",
        period_start=date(year, 1, 1),
        period_end=date(year, 12, 31),
        period_type="annual",
        period_label=str(year),
        location_code=location_code,
        location_name=location_name,
        location_level="division",
        cases=1000,
        deaths=None,
        population=100_000,
        incidence_per_100k=incidence,
        data_status="literature_derived_ecological_estimate",
        source_name="Test source",
        source_url="https://example.test/",
        complete_period=True,
    )


@pytest.fixture
def scenario():
    monthly: list[EnvironmentMonthlyRecord] = []
    # BD-CTG: two districts, two years
    monthly += _monthly_records("BD-D-CHATTOGRAM", "BD-CTG", "Chattogram", 2017, mean_temp_c=20, precip_per_month=10, heat_days_per_month=1)
    monthly += _monthly_records("BD-D-COXS_BAZAR", "BD-CTG", "Chattogram", 2017, mean_temp_c=22, precip_per_month=14, heat_days_per_month=3)
    monthly += _monthly_records("BD-D-CHATTOGRAM", "BD-CTG", "Chattogram", 2018, mean_temp_c=32, precip_per_month=8, heat_days_per_month=5)
    monthly += _monthly_records("BD-D-COXS_BAZAR", "BD-CTG", "Chattogram", 2018, mean_temp_c=34, precip_per_month=12, heat_days_per_month=7)
    # BD-DHA: two districts, two years
    monthly += _monthly_records("BD-D-DHAKA", "BD-DHA", "Dhaka", 2017, mean_temp_c=24, precip_per_month=6, heat_days_per_month=0)
    monthly += _monthly_records("BD-D-GAZIPUR", "BD-DHA", "Dhaka", 2017, mean_temp_c=26, precip_per_month=10, heat_days_per_month=2)
    monthly += _monthly_records("BD-D-DHAKA", "BD-DHA", "Dhaka", 2018, mean_temp_c=28, precip_per_month=16, heat_days_per_month=4)
    monthly += _monthly_records("BD-D-GAZIPUR", "BD-DHA", "Dhaka", 2018, mean_temp_c=30, precip_per_month=20, heat_days_per_month=6)

    # Division-annual mean_temp_c works out to: CTG/2017=21, CTG/2018=33, DHA/2017=25, DHA/2018=29.
    # AWD incidence is set as an exact linear function of temperature (x10) so the
    # expected pooled and within-division Pearson r for mean_temp_c is exactly 1.0,
    # independent of this module's own correlation math.
    awd = [
        _awd_record("BD-CTG", "Chattogram", 2017, 210.0),
        _awd_record("BD-CTG", "Chattogram", 2018, 330.0),
        _awd_record("BD-DHA", "Dhaka", 2017, 250.0),
        _awd_record("BD-DHA", "Dhaka", 2018, 290.0),
        # A non-division row that must be excluded from the analysis.
        _awd_record("BD", "Bangladesh", 2017, 999.0),
    ]
    return monthly, awd


def test_report_structure_and_sample_size(scenario):
    monthly, awd = scenario
    # location_level would be "national" for the excluded row in a real loader; patch it here.
    awd[-1] = replace(awd[-1], location_level="national")

    report = build_awd_climate_correlation_report(awd, monthly)

    assert report["sample_size"] == 4
    assert report["years"] == ["2017", "2018"]
    assert report["divisions"] == ["BD-CTG", "BD-DHA"]
    assert set(report["variables"]) == {"mean_temp_c", "total_precip_mm", "extreme_heat_days"}
    assert report["limitations"]
    assert "causation" in report["disclaimer"]


def test_pooled_and_within_division_correlation_for_temperature_is_exact(scenario):
    monthly, awd = scenario
    awd[-1] = replace(awd[-1], location_level="national")

    report = build_awd_climate_correlation_report(awd, monthly)

    temp = report["variables"]["mean_temp_c"]
    assert temp["pooled"]["pearson_r"] == pytest.approx(1.0)
    assert temp["within_division"]["pearson_r"] == pytest.approx(1.0)
    # A perfect relationship should be very unlikely under permutation.
    assert temp["pooled"]["pearson_p"] < 0.1


def test_two_stage_aggregation_matches_independent_hand_calculation(scenario):
    monthly, awd = scenario
    awd[-1] = replace(awd[-1], location_level="national")

    report = build_awd_climate_correlation_report(awd, monthly)

    # Hand-derived division-annual series, order [CTG/2017, CTG/2018, DHA/2017, DHA/2018].
    expected_precip = [144.0, 120.0, 96.0, 216.0]
    expected_heat_days = [24.0, 72.0, 12.0, 60.0]
    expected_awd = [210.0, 330.0, 250.0, 290.0]

    # Independent oracle (Python's own stdlib), not this module's pearson_r.
    expected_precip_r = statistics.correlation(expected_precip, expected_awd)
    expected_heat_days_r = statistics.correlation(expected_heat_days, expected_awd)

    assert report["variables"]["total_precip_mm"]["pooled"]["pearson_r"] == pytest.approx(expected_precip_r)
    assert report["variables"]["extreme_heat_days"]["pooled"]["pearson_r"] == pytest.approx(expected_heat_days_r)


def test_non_division_rows_are_excluded(scenario):
    monthly, awd = scenario
    # Leave the national row as location_level="division" by mistake is NOT what we test;
    # instead confirm the fixture's national row (still "division" here) would inflate n if
    # not filtered -- so explicitly mark it national and check n stays at 4.
    awd[-1] = replace(awd[-1], location_level="national")
    report = build_awd_climate_correlation_report(awd, monthly)
    assert report["sample_size"] == 4


def test_falls_back_to_raw_cases_when_incidence_is_unavailable(scenario):
    # incidence_per_100k doesn't round-trip through DHIS2 data values (only "cases"
    # does), so it is None for every record when ONEHEALTH_BACKEND=dhis2 in
    # production. This must degrade gracefully, not crash, and must disclose it.
    monthly, awd = scenario
    awd[-1] = replace(awd[-1], location_level="national")
    without_incidence = [replace(record, incidence_per_100k=None) for record in awd]

    report = build_awd_climate_correlation_report(without_incidence, monthly)

    assert report["sample_size"] == 4
    assert report["awd_metric"]["unit"] == "raw cases (not population-normalized)"
    assert report["limitations"][0].startswith("Population-normalized AWD incidence was not available")


def test_uses_incidence_when_fully_available(scenario):
    monthly, awd = scenario
    awd[-1] = replace(awd[-1], location_level="national")

    report = build_awd_climate_correlation_report(awd, monthly)

    assert report["awd_metric"]["unit"] == "cases per 100,000 population"
    assert not report["limitations"][0].startswith("Population-normalized AWD incidence was not available")
