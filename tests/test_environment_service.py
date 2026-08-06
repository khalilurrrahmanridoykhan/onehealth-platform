from datetime import date
from pathlib import Path

from onehealth.services.environment import load_environment_monthly, load_environment_summary


MONTHLY_CSV = (
    "location_code,location_name,division_code,division_name,period_start,period_end,"
    "period_type,period_label,mean_temp_c,mean_max_temp_c,total_precip_mm,extreme_heat_days,"
    "days_observed,complete_period,data_status,source_name,source_url\n"
    "BD-D-DHAKA,Dhaka,BD-DHA,Dhaka,2020-06-01,2020-06-30,monthly,2020-06,30.00,35.00,15.00,2,"
    "30,True,modelled_reanalysis_daily_aggregate,NASA POWER,https://power.larc.nasa.gov/\n"
)

SUMMARY_CSV = (
    "location_code,location_name,division_code,division_name,mean_temp_c,"
    "mean_annual_precip_mm,mean_annual_extreme_heat_days,extreme_heat_threshold_c,"
    "period_start,period_end,data_status,source_name,source_url\n"
    "BD-D-DHAKA,Dhaka,BD-DHA,Dhaka,27.10,2000.00,20.00,35.0,2017-01-01,2025-12-31,"
    "modelled_reanalysis_daily_aggregate,NASA POWER,https://power.larc.nasa.gov/\n"
)


def test_load_environment_monthly_round_trip(tmp_path: Path):
    path = tmp_path / "monthly.csv"
    path.write_text(MONTHLY_CSV, encoding="utf-8")

    records = load_environment_monthly(path)

    assert len(records) == 1
    record = records[0]
    assert record.location_code == "BD-D-DHAKA"
    assert record.period_start == date(2020, 6, 1)
    assert record.mean_temp_c == 30.0
    assert record.extreme_heat_days == 2
    assert record.complete_period is True


def test_load_environment_summary_round_trip(tmp_path: Path):
    path = tmp_path / "summary.csv"
    path.write_text(SUMMARY_CSV, encoding="utf-8")

    records = load_environment_summary(path)

    assert len(records) == 1
    record = records[0]
    assert record.location_code == "BD-D-DHAKA"
    assert record.mean_annual_precip_mm == 2000.0
    assert record.extreme_heat_threshold_c == 35.0


def test_load_environment_monthly_missing_file_returns_empty(tmp_path: Path):
    assert load_environment_monthly(tmp_path / "missing.csv") == []


def test_load_environment_summary_missing_file_returns_empty(tmp_path: Path):
    assert load_environment_summary(tmp_path / "missing.csv") == []
