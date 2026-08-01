import json
import re
from datetime import date
from pathlib import Path

import httpx
import pytest

from onehealth.dhis2.client import DHIS2Client
from onehealth.dhis2.ebs import (
    EBS_DATA_ELEMENTS,
    EBS_STAGES,
    EBSSignalInput,
    build_signal_bundle,
    build_stage_event,
    generate_dhis2_uid,
)


UID_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9]{10}$")


def test_generated_uid_matches_dhis2_format():
    assert UID_PATTERN.fullmatch(generate_dhis2_uid())


def test_detection_bundle_links_entity_enrollment_and_event():
    bundle = build_signal_bundle(
        EBSSignalInput(
            signal_id="EBS-2026-0001",
            title="Unusual fever cluster",
            source="Community health worker",
            signal_type="CLUSTER",
            description="Seven people with fever in one locality",
            org_unit_uid="BdDivDha001",
            detected_on=date(2026, 8, 1),
        ),
        tracked_entity_uid="Abcdef12345",
        enrollment_uid="Bcdefg12345",
        event_uid="Cdefgh12345",
    )

    entity = bundle["trackedEntities"][0]
    enrollment = bundle["enrollments"][0]
    event = bundle["events"][0]
    assert entity["trackedEntity"] == enrollment["trackedEntity"]
    assert enrollment["enrollment"] == event["enrollment"]
    assert event["programStage"] == EBS_STAGES["detection"]
    assert event["orgUnit"] == "BdDivDha001"
    assert event["status"] == "COMPLETED"
    assert enrollment["enrolledAt"] == "2026-08-01T00:00:00.000+06:00"
    assert event["occurredAt"] == "2026-08-01T00:00:00.000+06:00"


def test_follow_up_stage_maps_fields_and_rejects_unknown_values():
    bundle = build_stage_event(
        stage="risk_assessment",
        enrollment_uid="Bcdefg12345",
        org_unit_uid="BdDivDha001",
        occurred_on=date(2026, 8, 2),
        event_uid="Cdefgh12345",
        values={"likelihood_score": 4, "impact_score": 5, "risk_level": "HIGH"},
    )
    event = bundle["events"][0]
    assert event["programStage"] == EBS_STAGES["risk_assessment"]
    assert event["occurredAt"] == "2026-08-02T00:00:00.000+06:00"
    assert event["dataValues"] == [
        {"dataElement": EBS_DATA_ELEMENTS["likelihood_score"], "value": "4"},
        {"dataElement": EBS_DATA_ELEMENTS["impact_score"], "value": "5"},
        {"dataElement": EBS_DATA_ELEMENTS["risk_level"], "value": "HIGH"},
    ]

    with pytest.raises(ValueError, match="Fields not allowed for verification"):
        build_stage_event(
            stage="verification",
            enrollment_uid="Bcdefg12345",
            org_unit_uid="BdDivDha001",
            occurred_on=date(2026, 8, 2),
            values={"unknown": "value"},
        )

    with pytest.raises(ValueError, match="Missing required fields for response"):
        build_stage_event(
            stage="response",
            enrollment_uid="Bcdefg12345",
            org_unit_uid="BdDivDha001",
            occurred_on=date(2026, 8, 2),
            values={"response_status": "STARTED"},
        )


def test_investigation_requires_a_non_negative_sample_count():
    bundle = build_stage_event(
        stage="investigation",
        enrollment_uid="Bcdefg12345",
        org_unit_uid="BdDivDha001",
        occurred_on=date(2026, 8, 2),
        values={"investigation_status": "COMPLETED", "samples_collected": "3"},
    )
    values = bundle["events"][0]["dataValues"]
    assert {"dataElement": EBS_DATA_ELEMENTS["samples_collected"], "value": "3"} in values

    with pytest.raises(ValueError, match="whole-number count"):
        build_stage_event(
            stage="investigation",
            enrollment_uid="Bcdefg12345",
            org_unit_uid="BdDivDha001",
            occurred_on=date(2026, 8, 2),
            values={"investigation_status": "COMPLETED", "samples_collected": "YES"},
        )


def test_tracker_client_uses_atomic_synchronous_import():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/tracker"
        assert request.url.params["async"] == "false"
        assert request.url.params["importStrategy"] == "CREATE_AND_UPDATE"
        assert request.url.params["atomicMode"] == "ALL"
        assert request.url.params["reportMode"] == "FULL"
        return httpx.Response(200, json={"status": "OK"})

    with DHIS2Client(
        "https://dhis.example",
        api_token="test-token",
        transport=httpx.MockTransport(handler),
    ) as client:
        result = client.import_tracker_bundle({"events": []})
    assert result["status"] == "OK"


def test_ebs_metadata_uids_and_references_are_valid():
    path = Path(__file__).parents[1] / "dhis2" / "metadata" / "ebs_tracker.json"
    metadata = json.loads(path.read_text(encoding="utf-8"))
    ids = {
        item["id"]
        for collection in (
            "trackedEntityTypes",
            "trackedEntityAttributes",
            "dataElements",
            "programs",
            "programStages",
        )
        for item in metadata[collection]
    }
    assert len(ids) == 28
    assert all(UID_PATTERN.fullmatch(uid) for uid in ids)

    program_ids = {program["id"] for program in metadata["programs"]}
    data_element_ids = {element["id"] for element in metadata["dataElements"]}
    for stage in metadata["programStages"]:
        assert stage["program"]["id"] in program_ids
        assert all(
            item["dataElement"]["id"] in data_element_ids
            for item in stage["programStageDataElements"]
        )
