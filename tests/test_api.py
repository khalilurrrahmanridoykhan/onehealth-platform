from fastapi.testclient import TestClient

from onehealth.api import app


client = TestClient(app)


def test_locations_include_national_and_eight_divisions(monkeypatch):
    monkeypatch.setenv("ONEHEALTH_BACKEND", "csv")
    response = client.get("/api/v1/locations?disease_code=DENGUE")

    assert response.status_code == 200
    locations = response.json()
    assert len(locations) == 9
    assert {location["code"] for location in locations} == {
        "BD",
        "BD-BAR",
        "BD-CTG",
        "BD-DHA",
        "BD-KHU",
        "BD-MYM",
        "BD-RAJ",
        "BD-RAN",
        "BD-SYL",
    }


def test_division_trend_alert_and_summary(monkeypatch):
    monkeypatch.setenv("ONEHEALTH_BACKEND", "csv")

    trend = client.get("/api/v1/trends/DENGUE?location_code=BD-DHA")
    alert = client.get("/api/v1/alerts/DENGUE/latest?location_code=BD-DHA")
    summary = client.get("/api/v1/summary/DENGUE?location_code=BD-DHA")

    assert trend.status_code == 200
    assert len(trend.json()) == 22
    assert all(record["location_code"] == "BD-DHA" for record in trend.json())
    assert alert.status_code == 200
    assert alert.json()["location_code"] == "BD-DHA"
    assert summary.status_code == 200
    assert summary.json()["periods"] == 22
    assert summary.json()["location_name"] == "Dhaka"


def test_overview_returns_national_then_eight_divisions(monkeypatch):
    monkeypatch.setenv("ONEHEALTH_BACKEND", "csv")
    response = client.get("/api/v1/overview/DENGUE")

    assert response.status_code == 200
    overview = response.json()
    assert len(overview) == 9
    assert overview[0]["location_code"] == "BD"
    assert overview[0]["location_level"] == "national"
    assert {item["risk_level"] for item in overview} <= {"LOW", "MEDIUM", "HIGH"}


def test_ebs_schema_and_signal_preview(monkeypatch):
    monkeypatch.setenv("ONEHEALTH_EBS_WRITES_ENABLED", "false")
    schema = client.get("/api/v1/ebs/schema")
    payload = {
        "signal_id": "EBS-2026-0002",
        "title": "Unusual fever cluster",
        "source": "Community health worker",
        "signal_type": "CLUSTER",
        "description": "Seven people with fever in one locality",
        "location_code": "BD-DHA",
        "detected_on": "2026-08-01",
    }
    preview = client.post("/api/v1/ebs/signals/preview", json=payload)
    commit = client.post("/api/v1/ebs/signals", json=payload)

    assert schema.status_code == 200
    assert [stage["code"] for stage in schema.json()["stages"]] == [
        "detection",
        "verification",
        "risk_assessment",
        "investigation",
        "response",
        "closure",
    ]
    assert preview.status_code == 200
    assert preview.json()["bundle"]["events"][0]["orgUnit"] == "BdDivDha001"
    assert commit.status_code == 403


def test_ebs_follow_up_stage_preview_and_write_guard(monkeypatch):
    monkeypatch.delenv("ONEHEALTH_EBS_WRITES_ENABLED", raising=False)
    payload = {
        "stage": "risk_assessment",
        "enrollment_uid": "Bcdefg12345",
        "location_code": "BD-DHA",
        "occurred_on": "2026-08-02",
        "values": {
            "likelihood_score": 4,
            "impact_score": 3,
            "risk_level": "HIGH",
        },
    }

    preview = client.post("/api/v1/ebs/stages/preview", json=payload)
    commit = client.post("/api/v1/ebs/stages", json=payload)

    assert preview.status_code == 200
    assert preview.json()["stage"] == "risk_assessment"
    event = preview.json()["bundle"]["events"][0]
    assert event["programStage"] == "OhEbsRas001"
    assert event["enrollment"] == "Bcdefg12345"
    assert commit.status_code == 403


def test_ebs_follow_up_stage_rejects_missing_required_fields():
    response = client.post(
        "/api/v1/ebs/stages/preview",
        json={
            "stage": "verification",
            "enrollment_uid": "Bcdefg12345",
            "location_code": "BD-DHA",
            "occurred_on": "2026-08-02",
            "values": {"verification_notes": "Could not reach reporter"},
        },
    )

    assert response.status_code == 422
    assert "verification_status" in response.json()["detail"]
