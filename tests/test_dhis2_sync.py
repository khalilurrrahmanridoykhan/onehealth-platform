from dataclasses import replace
from datetime import date, timedelta

import pytest

from onehealth.dhis2.mapping import DHIS2Mapping, LocationMapping
from onehealth.dhis2.periods import dhis2_week_bounds, local_week_to_dhis2
from onehealth.dhis2.sync import records_from_dhis2, records_to_data_value_sets
from onehealth.models import SurveillanceRecord


MAPPING = DHIS2Mapping(
    disease_code="DENGUE",
    disease_name="Dengue",
    data_set_uid="OhDngWeek01",
    cases_data_element_uid="OhDngCase01",
    locations={
        "BD": LocationMapping(uid="BdOrgUnit01", name="Bangladesh", level="national")
    },
)


def record(cases: int = 70, *, complete: bool = True) -> SurveillanceRecord:
    start = date(2026, 1, 5)
    return SurveillanceRecord(
        disease_code="DENGUE",
        disease_name="Dengue",
        period_start=start,
        period_end=start + timedelta(days=6),
        period_type="weekly",
        period_label="2026-W02",
        location_code="BD",
        location_name="Bangladesh",
        location_level="national",
        cases=cases,
        deaths=None,
        population=None,
        incidence_per_100k=None,
        data_status="observed",
        source_name="DGHS",
        source_url="https://example.test",
        complete_period=complete,
    )


def test_period_conversion_round_trip():
    assert local_week_to_dhis2("2026-W02") == "2026W2"
    start, end, label = dhis2_week_bounds("2026W2")
    assert (start, end, label) == (
        date(2026, 1, 5),
        date(2026, 1, 11),
        "2026-W02",
    )


def test_complete_record_becomes_data_value_set():
    payloads = records_to_data_value_sets([record()], MAPPING)
    assert payloads == [
        {
            "dataSet": "OhDngWeek01",
            "period": "2026W2",
            "orgUnit": "BdOrgUnit01",
            "completeDate": "2026-01-11",
            "dataValues": [
                {
                    "dataElement": "OhDngCase01",
                    "value": "70",
                    "comment": "Source: DGHS",
                }
            ],
        }
    ]
    assert records_to_data_value_sets([record(complete=False)], MAPPING) == []


def test_duplicate_period_is_rejected():
    with pytest.raises(ValueError, match="Duplicate surveillance record"):
        records_to_data_value_sets([record(), record()], MAPPING)


def test_national_records_can_use_a_separate_data_element():
    mapping = replace(MAPPING, national_cases_data_element_uid="OhDngNat001")
    payload = records_to_data_value_sets([record()], mapping)[0]
    assert payload["dataValues"][0]["dataElement"] == "OhDngNat001"


def test_dhis2_values_become_surveillance_records():
    response = {
        "dataValues": [
            {
                "dataElement": "OhDngCase01",
                "period": "2026W2",
                "orgUnit": "BdOrgUnit01",
                "value": "70",
            }
        ]
    }
    records = records_from_dhis2(response, MAPPING)
    assert len(records) == 1
    assert records[0].period_label == "2026-W02"
    assert records[0].cases == 70
    assert records[0].source_name == "DHIS2"
