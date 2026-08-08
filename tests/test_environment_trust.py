from datetime import date
from pathlib import Path

import pytest

from onehealth.models import EnvironmentDistrictSummary, EnvironmentMonthlyRecord
from onehealth.services.environment_trust import (
    EnvironmentRegistryError,
    build_environment_trust_report,
    load_environment_registry,
)


def monthly_record(
    location_code: str = "BD-D-DHAKA",
    *,
    period_label: str = "2020-06",
    mean_temp_c: float = 30.0,
    total_precip_mm: float = 10.0,
    extreme_heat_days: int = 1,
) -> EnvironmentMonthlyRecord:
    return EnvironmentMonthlyRecord(
        location_code=location_code,
        location_name="Dhaka",
        division_code="BD-DHA",
        division_name="Dhaka",
        period_start=date(2020, 6, 1),
        period_end=date(2020, 6, 30),
        period_type="monthly",
        period_label=period_label,
        mean_temp_c=mean_temp_c,
        mean_max_temp_c=mean_temp_c + 5,
        total_precip_mm=total_precip_mm,
        extreme_heat_days=extreme_heat_days,
        days_observed=30,
        complete_period=True,
        data_status="modelled_reanalysis_daily_aggregate",
        source_name="NASA POWER",
        source_url="https://power.larc.nasa.gov/",
    )


def summary_record(location_code: str = "BD-D-DHAKA") -> EnvironmentDistrictSummary:
    return EnvironmentDistrictSummary(
        location_code=location_code,
        location_name="Dhaka",
        division_code="BD-DHA",
        division_name="Dhaka",
        mean_temp_c=27.0,
        mean_annual_precip_mm=2000.0,
        mean_annual_extreme_heat_days=20.0,
        extreme_heat_threshold_c=35.0,
        period_start=date(2017, 1, 1),
        period_end=date(2025, 12, 31),
        data_status="modelled_reanalysis_daily_aggregate",
        source_name="NASA POWER",
        source_url="https://power.larc.nasa.gov/",
    )


def declaration() -> dict:
    registry_path = Path(__file__).resolve().parents[1] / "data" / "environment_registry.json"
    return load_environment_registry(registry_path)


def test_registry_loads_and_validates_the_committed_file():
    entry = declaration()
    assert entry["evidence_type"] == "modelled_reanalysis_observation"
    assert len(entry["expected_location_codes"]) == 64
    assert entry["capabilities"]["disease_correlation"] is True


def test_registry_rejects_missing_file(tmp_path: Path):
    with pytest.raises(EnvironmentRegistryError):
        load_environment_registry(tmp_path / "missing.json")


def test_negative_temperature_does_not_fail_quality_checks():
    entry = declaration()
    monthly = [monthly_record(mean_temp_c=-5.0)]
    summary = [summary_record()]

    report = build_environment_trust_report(monthly, summary, entry)

    codes_with_fail = [c["code"] for c in report["quality"]["checks"] if c["status"] == "FAIL"]
    assert "nonnegative_precipitation_and_heat_days" not in codes_with_fail


def test_negative_precipitation_fails_quality_checks():
    entry = declaration()
    monthly = [monthly_record(total_precip_mm=-1.0)]
    summary = [summary_record()]

    report = build_environment_trust_report(monthly, summary, entry)

    check = next(
        c for c in report["quality"]["checks"] if c["code"] == "nonnegative_precipitation_and_heat_days"
    )
    assert check["status"] == "FAIL"
    assert report["quality"]["status"] == "FAIL"


def test_unverified_crosswalk_entry_surfaces_as_warning():
    entry = declaration()
    monthly = [monthly_record(location_code="BD-D-CHAPAINAWABGANJ")]
    summary = [summary_record(location_code="BD-D-CHAPAINAWABGANJ")]

    report = build_environment_trust_report(monthly, summary, entry)

    check = next(c for c in report["quality"]["checks"] if c["code"] == "unverified_crosswalk_entries")
    assert check["status"] == "WARNING"
    assert "BD-D-CHAPAINAWABGANJ" in check["message"]


def test_verified_district_does_not_trigger_unverified_warning():
    entry = declaration()
    monthly = [monthly_record(location_code="BD-D-DHAKA")]
    summary = [summary_record(location_code="BD-D-DHAKA")]

    report = build_environment_trust_report(monthly, summary, entry)

    check = next(c for c in report["quality"]["checks"] if c["code"] == "unverified_crosswalk_entries")
    assert check["status"] == "PASS"


def test_no_records_fails_records_present_check():
    entry = declaration()
    report = build_environment_trust_report([], [], entry)

    assert report["quality"]["status"] == "FAIL"
    check = next(c for c in report["quality"]["checks"] if c["code"] == "records_present")
    assert check["status"] == "FAIL"
