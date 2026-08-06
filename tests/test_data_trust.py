import json
from dataclasses import replace
from datetime import date, timedelta

import pytest

from onehealth.dhis2 import DHIS2Mapping
from onehealth.models import SurveillanceRecord
from onehealth.services.data_trust import (
    UnknownDiseaseError,
    build_data_trust_catalog,
    build_data_trust_detail,
    load_evidence_registry,
)
from onehealth.services.surveillance import load_surveillance_records


def record(
    disease_code: str = "DENGUE",
    disease_name: str = "Dengue",
    *,
    end: date = date(2026, 8, 2),
    complete: bool = True,
    status: str = "observed",
    location_code: str = "BD",
    location_name: str = "Bangladesh",
    location_level: str = "national",
) -> SurveillanceRecord:
    return SurveillanceRecord(
        disease_code=disease_code,
        disease_name=disease_name,
        period_start=end - timedelta(days=6),
        period_end=end,
        period_type="weekly",
        period_label="2026-W31",
        location_code=location_code,
        location_name=location_name,
        location_level=location_level,
        cases=12,
        deaths=None,
        population=None,
        incidence_per_100k=None,
        data_status=status,
        source_name="Source publisher",
        source_url="https://example.test/source",
        complete_period=complete,
    )


def test_registry_declares_all_eight_programmes_and_semantics():
    registry = load_evidence_registry()

    assert set(registry) == {
        "DENGUE", "MEASLES", "HPAI", "NIPAH", "JE", "AWD", "RABIES", "MALARIA"
    }
    assert registry["DENGUE"]["evidence_type"] == "observed_surveillance"
    assert registry["AWD"]["evidence_type"] == "literature_derived_ecological_estimate"
    assert registry["RABIES"]["metric"]["unit"] == "deaths"
    assert registry["MALARIA"]["capabilities"] == {
        "alerts": False,
        "forecast": False,
        "automated_refresh": False,
        "district_data": False,
    }


def test_detail_contract_is_json_serializable_and_current_when_on_time():
    detail = build_data_trust_detail(
        [record()], "dengue", as_of=date(2026, 8, 6)
    )

    assert set(detail) == {
        "disease_code", "disease_name", "metric", "evidence_type", "coverage",
        "freshness", "provenance", "quality", "capabilities", "limitations",
    }
    assert detail["coverage"] == {
        "start_date": "2026-07-27",
        "end_date": "2026-08-02",
        "record_count": 1,
        "location_count": 1,
        "location_levels": ["national"],
        "period_types": ["weekly"],
        "complete_periods": 1,
        "partial_periods": 0,
    }
    assert detail["freshness"] == {
        "status": "CURRENT",
        "latest_period_end": "2026-08-02",
        "age_days": 4,
        "expected_update_days": 7,
        "as_of": "2026-08-06",
    }
    assert detail["provenance"]["sources"] == [
        {"name": "Source publisher", "url": "https://example.test/source"}
    ]
    json.dumps(detail)


def test_historical_evidence_is_not_mislabelled_as_stale():
    nipah = replace(
        record(),
        disease_code="NIPAH",
        disease_name="Nipah Virus",
        period_start=date(2001, 1, 1),
        period_end=date(2001, 12, 31),
        period_type="annual",
        period_label="2001",
        data_status="cross_validated_literature",
    )

    detail = build_data_trust_detail([nipah], "NIPAH", as_of=date(2026, 8, 6))

    assert detail["freshness"]["status"] == "HISTORICAL"
    assert detail["freshness"]["age_days"] == 8984
    assert detail["evidence_type"] == "historical_literature_compilation"
    assert detail["capabilities"]["alerts"] is False


def test_quality_reports_partial_periods_and_missing_declared_locations():
    detail = build_data_trust_detail(
        [record(complete=False)], "DENGUE", as_of=date(2026, 8, 6)
    )

    checks = {check["code"]: check for check in detail["quality"]["checks"]}
    assert detail["quality"]["status"] == "WARNING"
    assert checks["period_completeness"]["status"] == "WARNING"
    assert checks["declared_location_coverage"]["status"] == "WARNING"
    assert detail["quality"]["issue_count"] == 2


def test_quality_fails_invalid_values_semantics_duplicates_and_provenance():
    invalid = replace(
        record(status="estimated"), cases=-1, source_name="", source_url=""
    )
    detail = build_data_trust_detail(
        [invalid, invalid], "DENGUE", as_of=date(2026, 8, 6)
    )

    checks = {check["code"]: check["status"] for check in detail["quality"]["checks"]}
    assert detail["quality"]["status"] == "FAIL"
    assert checks["nonnegative_values"] == "FAIL"
    assert checks["duplicate_records"] == "FAIL"
    assert checks["source_provenance"] == "FAIL"
    assert checks["evidence_semantics"] == "FAIL"


def test_catalog_uses_actual_processed_evidence_without_changing_its_meaning():
    data_dir = load_evidence_registry.__globals__["PROJECT_ROOT"] / "data" / "processed"
    records = []
    for path in sorted(data_dir.glob("*.csv")):
        records.extend(load_surveillance_records(path))

    catalog = build_data_trust_catalog(records, as_of=date(2026, 8, 6))
    by_code = {detail["disease_code"]: detail for detail in catalog}

    assert len(catalog) == 8
    assert by_code["DENGUE"]["coverage"]["record_count"] == 199
    assert by_code["DENGUE"]["freshness"]["status"] == "STALE"
    assert by_code["MEASLES"]["coverage"]["partial_periods"] == 19
    assert by_code["AWD"]["evidence_type"] == "literature_derived_ecological_estimate"
    assert by_code["AWD"]["quality"]["status"] == "PASS"
    assert by_code["NIPAH"]["freshness"]["status"] == "HISTORICAL"
    assert by_code["JE"]["coverage"]["partial_periods"] == 4
    assert by_code["JE"]["quality"]["status"] == "WARNING"
    assert by_code["RABIES"]["metric"] == {
        "label": "Reported human rabies deaths", "unit": "deaths"
    }
    assert by_code["MALARIA"]["coverage"]["location_count"] == 1
    json.dumps(catalog)


def test_unknown_disease_is_rejected():
    with pytest.raises(UnknownDiseaseError, match="Unknown disease code"):
        build_data_trust_detail([], "not-a-disease")


def test_all_dhis2_mappings_preserve_registered_evidence_and_source_provenance():
    project_root = load_evidence_registry.__globals__["PROJECT_ROOT"]
    registry = load_evidence_registry()

    mappings = [
        DHIS2Mapping.from_path(path)
        for path in sorted((project_root / "dhis2" / "mappings").glob("*.json"))
    ]

    assert {mapping.disease_code for mapping in mappings} == set(registry)
    for mapping in mappings:
        assert mapping.data_status in registry[mapping.disease_code]["allowed_data_statuses"]
        assert mapping.source_name and mapping.source_name != "DHIS2"
        assert mapping.source_url.startswith("https://")
