import csv
from pathlib import Path

import pytest

from onehealth.services.environment_import import normalize_monthly, normalize_summary


CROSSWALK_CSV = (
    "location_code,district_name,source_district_name,division_code,division_name,notes\n"
    "BD-D-BOGURA,Bogura,Bogra,BD-RAJ,Rajshahi,Source spelling renamed.\n"
    "BD-D-DHAKA,Dhaka,Dhaka,BD-DHA,Dhaka,\n"
)


def _write(path: Path, content: str) -> Path:
    path.write_text(content, encoding="utf-8")
    return path


def test_district_name_is_translated_through_crosswalk(tmp_path: Path):
    crosswalk = _write(tmp_path / "crosswalk.csv", CROSSWALK_CSV)
    daily = _write(
        tmp_path / "daily.csv",
        "date,T2M,T2M_MAX,PRECTOTCORR,district\n"
        "2020-01-01,20.0,25.0,0.0,Bogra\n"
        "2020-01-02,21.0,26.0,1.0,Bogra\n",
    )
    output = tmp_path / "monthly.csv"

    normalize_monthly(daily, crosswalk, output)

    with output.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 1
    assert rows[0]["location_code"] == "BD-D-BOGURA"
    assert rows[0]["location_name"] == "Bogura"
    assert rows[0]["division_code"] == "BD-RAJ"


def test_monthly_aggregation_math_is_exact(tmp_path: Path):
    crosswalk = _write(tmp_path / "crosswalk.csv", CROSSWALK_CSV)
    daily = _write(
        tmp_path / "daily.csv",
        "date,T2M,T2M_MAX,PRECTOTCORR,district\n"
        "2020-06-01,30.0,34.0,10.0,Dhaka\n"
        "2020-06-02,32.0,36.0,5.0,Dhaka\n"
        "2020-06-03,28.0,35.0,0.0,Dhaka\n",
    )
    output = tmp_path / "monthly.csv"

    normalize_monthly(daily, crosswalk, output)

    with output.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 1
    row = rows[0]
    assert row["mean_temp_c"] == "30.00"
    assert row["mean_max_temp_c"] == "35.00"
    assert row["total_precip_mm"] == "15.00"
    # T2M_MAX >= 35.0 on two of the three days (36.0 and 35.0)
    assert row["extreme_heat_days"] == "2"
    assert row["days_observed"] == "3"


def test_incomplete_month_is_flagged_not_complete(tmp_path: Path):
    crosswalk = _write(tmp_path / "crosswalk.csv", CROSSWALK_CSV)
    daily = _write(
        tmp_path / "daily.csv",
        "date,T2M,T2M_MAX,PRECTOTCORR,district\n"
        "2020-06-01,30.0,34.0,10.0,Dhaka\n",
    )
    output = tmp_path / "monthly.csv"

    normalize_monthly(daily, crosswalk, output)

    with output.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert rows[0]["complete_period"] == "False"
    assert rows[0]["period_end"] == "2020-06-30"


def test_unmatched_district_name_raises_a_clear_error(tmp_path: Path):
    crosswalk = _write(tmp_path / "crosswalk.csv", CROSSWALK_CSV)
    daily = _write(
        tmp_path / "daily.csv",
        "date,T2M,T2M_MAX,PRECTOTCORR,district\n"
        "2020-06-01,30.0,34.0,10.0,Atlantis\n",
    )
    output = tmp_path / "monthly.csv"

    with pytest.raises(ValueError, match="Atlantis"):
        normalize_monthly(daily, crosswalk, output)


def test_normalize_summary_joins_through_crosswalk(tmp_path: Path):
    crosswalk = _write(tmp_path / "crosswalk.csv", CROSSWALK_CSV)
    summary = _write(
        tmp_path / "summary.csv",
        "district,mean_temp_c,mean_annual_precip_mm,mean_annual_extreme_heat_days\n"
        "Bogra,26.5,1800.0,40.0\n"
        "Dhaka,27.1,2000.0,20.0\n",
    )
    output = tmp_path / "summary_out.csv"

    count = normalize_summary(summary, crosswalk, output)

    assert count == 2
    with output.open(encoding="utf-8", newline="") as handle:
        rows = {row["location_code"]: row for row in csv.DictReader(handle)}
    assert rows["BD-D-BOGURA"]["location_name"] == "Bogura"
    assert rows["BD-D-BOGURA"]["division_code"] == "BD-RAJ"
    assert rows["BD-D-DHAKA"]["mean_temp_c"] == "27.10"
    assert rows["BD-D-BOGURA"]["extreme_heat_threshold_c"] == "35.0"


def test_summary_unmatched_district_raises(tmp_path: Path):
    crosswalk = _write(tmp_path / "crosswalk.csv", CROSSWALK_CSV)
    summary = _write(
        tmp_path / "summary.csv",
        "district,mean_temp_c,mean_annual_precip_mm,mean_annual_extreme_heat_days\n"
        "Atlantis,26.5,1800.0,40.0\n",
    )
    output = tmp_path / "summary_out.csv"

    with pytest.raises(ValueError, match="Atlantis"):
        normalize_summary(summary, crosswalk, output)
