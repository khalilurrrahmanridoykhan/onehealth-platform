import json
from types import SimpleNamespace

import onehealth.api as api_module
from fastapi.testclient import TestClient
from onehealth.auth import User, issue_token, password_hash

from onehealth.api import app


client = TestClient(app)


def test_data_trust_endpoints_expose_evidence_and_component_views(monkeypatch):
    monkeypatch.setenv("ONEHEALTH_BACKEND", "csv")

    catalog = client.get("/api/v1/data-trust")
    detail = client.get("/api/v1/data-trust/DENGUE")
    coverage = client.get("/api/v1/data-trust/DENGUE/coverage")
    freshness = client.get("/api/v1/data-trust/DENGUE/freshness")
    provenance = client.get("/api/v1/data-trust/DENGUE/provenance")
    quality = client.get("/api/v1/data-trust/DENGUE/quality")

    assert catalog.status_code == 200
    assert {item["disease_code"] for item in catalog.json()} == {
        "DENGUE", "MEASLES", "HPAI", "NIPAH", "JE", "AWD", "RABIES", "MALARIA"
    }
    assert detail.status_code == 200
    assert detail.json()["disease_code"] == "DENGUE"
    assert detail.headers["X-OneHealth-Cache"] in {"HIT", "MISS", "STALE"}
    assert detail.headers["X-OneHealth-Data-Loaded-At"]
    assert coverage.json() == detail.json()["coverage"]
    assert freshness.json() == detail.json()["freshness"]
    assert provenance.json() == detail.json()["provenance"]
    assert quality.json() == detail.json()["quality"]


def test_data_trust_rejects_an_unknown_programme(monkeypatch):
    monkeypatch.setenv("ONEHEALTH_BACKEND", "csv")

    response = client.get("/api/v1/data-trust/NOT_REAL")

    assert response.status_code == 404
    assert "Unknown disease code" in response.json()["detail"]


def test_snapshot_cache_status_and_admin_invalidation(monkeypatch):
    monkeypatch.setenv("ONEHEALTH_BACKEND", "csv")
    monkeypatch.setenv("ONEHEALTH_AUTH_SECRET", "a-secure-test-secret-with-32-characters")
    client.get("/api/v1/data-trust/DENGUE")

    status = client.get("/api/v1/data-trust/cache/status")
    unauthenticated = client.post("/api/v1/data-trust/cache/invalidate")
    headers = {"Authorization": f"Bearer {issue_token(User('admin', 'admin'))}"}
    invalidated = client.post("/api/v1/data-trust/cache/invalidate", headers=headers)
    empty = client.get("/api/v1/data-trust/cache/status")

    assert status.status_code == 200
    assert status.json()["backend"] == "csv"
    assert status.json()["cache_state"] in {"HIT", "MISS", "STALE"}
    assert "last_error" not in status.json()
    assert unauthenticated.status_code == 401
    assert invalidated.status_code == 200
    assert invalidated.json()["status"] == "invalidated"
    assert invalidated.json()["entries_cleared"] >= 1
    assert empty.json()["cache_state"] == "EMPTY"


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


def test_overview_can_include_an_explicit_partial_historical_period(monkeypatch):
    root = api_module.DEFAULT_DATA_PATH.parents[1]
    monkeypatch.setenv("ONEHEALTH_BACKEND", "csv")
    monkeypatch.setenv("ONEHEALTH_DATA_PATHS", str(root / "processed/je_annual.csv"))

    complete = client.get("/api/v1/overview/JE")
    with_partial = client.get("/api/v1/overview/JE?complete_only=false")

    assert complete.status_code == 200
    assert complete.json()[0]["latest_period"] == "2015"
    assert with_partial.status_code == 200
    assert with_partial.json()[0]["latest_period"] == "2016"


def test_csv_backend_supports_multiple_diseases(monkeypatch):
    root = api_module.DEFAULT_DATA_PATH.parents[1]
    monkeypatch.setenv("ONEHEALTH_BACKEND", "csv")
    monkeypatch.setenv(
        "ONEHEALTH_DATA_PATHS",
        f"{root / 'processed/dengue_weekly.csv'},{root / 'processed/measles_weekly.csv'}",
    )

    diseases = client.get("/api/v1/diseases")
    trend = client.get("/api/v1/trends/MEASLES?location_code=BD")
    alert = client.get("/api/v1/alerts/MEASLES/latest?location_code=BD")

    assert {item["code"] for item in diseases.json()} == {"DENGUE", "MEASLES"}
    assert trend.status_code == 200
    assert len(trend.json()) == 8
    assert alert.status_code == 200
    assert "vaccination" in " ".join(alert.json()["recommended_actions"]).lower()


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
    assert commit.status_code == 401


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
    assert commit.status_code == 401


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


def test_ebs_status_reports_unconfigured_without_exposing_secrets(monkeypatch):
    for name in ("DHIS2_BASE_URL", "DHIS2_API_TOKEN", "DHIS2_USERNAME", "DHIS2_PASSWORD"):
        monkeypatch.delenv(name, raising=False)

    response = client.get("/api/v1/ebs/status")

    assert response.status_code == 200
    assert response.json() == {
        "dhis2_configured": False,
        "reads_enabled": False,
        "writes_enabled": False,
        "program_uid": "OhEbsProg01",
    }


def test_ebs_signal_search_and_detail_read_from_tracker(monkeypatch):
    monkeypatch.setenv("ONEHEALTH_EBS_READS_ENABLED", "true")
    monkeypatch.setenv("ONEHEALTH_AUTH_SECRET", "a-secure-test-secret-with-32-characters")
    headers = {"Authorization": f"Bearer {issue_token(User('viewer', 'viewer'))}"}
    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return None

        def get_tracked_entities(self, **_):
            return {"instances": [{
                "trackedEntity": "Abcdef12345", "orgUnit": "BdDivDha001",
                "createdAt": "2026-08-01T10:00:00.000", "updatedAt": "2026-08-02T10:00:00.000",
                "attributes": [
                    {"attribute": "OhEbsId0001", "value": "EBS-2026-0001"},
                    {"attribute": "OhEbsTit001", "value": "Unusual fever cluster"},
                    {"attribute": "OhEbsSrc001", "value": "Community worker"},
                ],
            }], "pager": {"page": 1, "pageSize": 25, "total": 1}}

        def get_tracked_entity(self, uid):
            entity = self.get_tracked_entities()["instances"][0]
            return {**entity, "trackedEntity": uid, "enrollments": [{"enrollment": "Bcdefg12345"}]}

        def get_tracker_events(self, **_):
            return {"instances": [{
                "event": "Cdefgh12345", "programStage": "OhEbsVer001", "status": "COMPLETED",
                "occurredAt": "2026-08-02T00:00:00.000", "updatedAt": "2026-08-02T10:00:00.000",
                "dataValues": [{"dataElement": "OhEbsVrf001", "value": "VERIFIED"}],
            }]}

    monkeypatch.setattr(
        api_module,
        "_settings_and_client",
        lambda: (SimpleNamespace(base_url="https://dhis.example"), FakeClient()),
    )

    search = client.get("/api/v1/ebs/signals?q=fever", headers=headers)
    detail = client.get("/api/v1/ebs/signals/Abcdef12345", headers=headers)
    operations = client.get("/api/v1/ebs/operations", headers=headers)

    assert search.status_code == 200
    assert search.json()["signals"][0]["signal_id"] == "EBS-2026-0001"
    assert detail.status_code == 200
    assert detail.json()["enrollment_uid"] == "Bcdefg12345"
    assert detail.json()["events"][0]["stage"] == "verification"
    assert detail.json()["events"][0]["values"] == {"verification_status": "VERIFIED"}
    assert operations.status_code == 200
    assert operations.json()["summary"] == {
        "total": 1, "open": 1, "closed": 0, "overdue": 0, "due_soon": 0,
        "unassigned": 1, "high_risk": 0,
    }
    assert operations.json()["signals"][0]["latest_stage"] == "verification"


def test_ebs_registry_reads_are_disabled_by_default(monkeypatch):
    monkeypatch.delenv("ONEHEALTH_EBS_READS_ENABLED", raising=False)

    response = client.get("/api/v1/ebs/signals")

    assert response.status_code == 401


def test_committed_signal_returns_the_identifiers_written_to_tracker(monkeypatch):
    monkeypatch.setenv("ONEHEALTH_EBS_WRITES_ENABLED", "true")
    monkeypatch.setenv("ONEHEALTH_AUTH_SECRET", "a-secure-test-secret-with-32-characters")
    monkeypatch.setattr(
        api_module.DHIS2Settings,
        "from_env",
        lambda: SimpleNamespace(
            base_url="https://dhis.example", api_token="token", username=None,
            password=None, verify_ssl=True, timeout_seconds=30,
        ),
    )
    imported = {}

    class FakeClient:
        def __init__(self, *_args, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def import_tracker_bundle(self, bundle):
            imported.update(bundle)
            return {"status": "OK"}

    monkeypatch.setattr(api_module, "DHIS2Client", FakeClient)
    headers = {"Authorization": f"Bearer {issue_token(User('responder', 'responder'))}"}
    response = client.post(
        "/api/v1/ebs/signals",
        headers=headers,
        json={
            "signal_id": "EBS-2026-COMMIT", "title": "Commit contract test",
            "source": "Surveillance desk", "signal_type": "CLUSTER",
            "description": "Non-identifiable practice signal", "location_code": "BD-DHA",
            "detected_on": "2026-08-02",
        },
    )

    assert response.status_code == 200
    result = response.json()
    assert result["mode"] == "COMMITTED"
    assert result["tracked_entity_uid"] == imported["trackedEntities"][0]["trackedEntity"]
    assert result["enrollment_uid"] == imported["enrollments"][0]["enrollment"]
    assert result["event_uid"] == imported["events"][0]["event"]


def test_assignment_notifications_and_situation_report(monkeypatch):
    monkeypatch.setenv("ONEHEALTH_EBS_READS_ENABLED", "true")
    monkeypatch.setenv("ONEHEALTH_EBS_WRITES_ENABLED", "true")
    monkeypatch.setenv("ONEHEALTH_AUTH_SECRET", "a-secure-test-secret-with-32-characters")
    imported = {}

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *_):
            return None

        def get_tracked_entities(self, **_):
            return {"instances": [self.get_tracked_entity("Abcdef12345")]}

        def get_tracked_entity(self, uid):
            return {
                "trackedEntity": uid, "orgUnit": "BdDivDha001",
                "updatedAt": "2026-08-02T10:00:00.000",
                "enrollments": [{"enrollment": "Bcdefg12345"}],
                "attributes": [
                    {"attribute": "OhEbsId0001", "value": "EBS-2026-0001"},
                    {"attribute": "OhEbsTit001", "value": "Unusual fever cluster"},
                    {"attribute": "OhEbsSrc001", "value": "Community worker"},
                ],
            }

        def get_tracker_events(self, **_):
            return {"instances": [{
                "event": "Cdefgh12345", "programStage": "OhEbsRas001",
                "status": "COMPLETED", "occurredAt": "2026-08-02T00:00:00.000",
                "dataValues": [{"dataElement": "OhEbsRsk001", "value": "HIGH"}],
            }]}

        def import_tracker_bundle(self, bundle):
            imported.update(bundle)
            return {"status": "OK"}

    monkeypatch.setattr(
        api_module,
        "_settings_and_client",
        lambda: (SimpleNamespace(base_url="https://dhis.example"), FakeClient()),
    )
    responder_headers = {"Authorization": f"Bearer {issue_token(User('responder', 'responder'))}"}
    viewer_headers = {"Authorization": f"Bearer {issue_token(User('viewer', 'viewer'))}"}

    assignment = client.post(
        "/api/v1/ebs/operations/Abcdef12345/assignment",
        headers=responder_headers,
        json={
            "responsible_officer": "Dr Rahman",
            "due_date": "2026-08-10",
            "recommended_actions": "Verify facilities and collect samples",
            "response_status": "IN_PROGRESS",
        },
    )
    notifications = client.get("/api/v1/ebs/notifications", headers=viewer_headers)
    report = client.get("/api/v1/ebs/reports/situation.csv", headers=viewer_headers)

    assert assignment.status_code == 200
    assert assignment.json()["officer"] == "Dr Rahman"
    data_values = {item["dataElement"]: item["value"] for item in imported["events"][0]["dataValues"]}
    assert data_values["OhEbsOff001"] == "Dr Rahman"
    assert notifications.status_code == 200
    assert notifications.json()["notifications"][0]["type"] == "UNASSIGNED"
    assert report.status_code == 200
    assert report.headers["content-type"].startswith("text/csv")
    assert "EBS-2026-0001" in report.text


def test_login_and_role_based_access(monkeypatch):
    monkeypatch.setenv("ONEHEALTH_AUTH_SECRET", "a-secure-test-secret-with-32-characters")
    monkeypatch.setenv("ONEHEALTH_AUTH_USERS", json.dumps([{
        "username": "analyst", "role": "analyst", "salt": "test-salt",
        "password_hash": password_hash("correct-password", "test-salt"),
    }]))

    login = client.post("/api/v1/auth/login", json={"username": "analyst", "password": "correct-password"})
    token = login.json()["access_token"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    denied_write = client.post(
        "/api/v1/ebs/signals",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "signal_id": "EBS-2026-RBAC", "title": "Role test signal",
            "source": "Test source", "signal_type": "CLUSTER",
            "description": "Role enforcement test", "location_code": "BD-DHA",
            "detected_on": "2026-08-01",
        },
    )

    assert login.status_code == 200
    assert me.json() == {"username": "analyst", "role": "analyst"}
    assert denied_write.status_code == 403


def test_login_accepts_dhis2_superuser_credentials(monkeypatch):
    monkeypatch.setenv("ONEHEALTH_AUTH_SECRET", "a-secure-test-secret-with-32-characters")
    monkeypatch.setenv("ONEHEALTH_AUTH_USERS", "[]")
    monkeypatch.setattr(
        api_module.DHIS2Settings,
        "from_env",
        lambda: SimpleNamespace(
            base_url="https://dhis.example", verify_ssl=True, timeout_seconds=30,
        ),
    )

    class FakeClient:
        def __init__(self, *_args, **kwargs):
            assert kwargs["username"] == "admin"
            assert kwargs["password"] == "dhis-password"

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def current_user(self):
            return {"username": "admin", "authorities": ["ALL"]}

    monkeypatch.setattr(api_module, "DHIS2Client", FakeClient)
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "dhis-password"},
    )

    assert response.status_code == 200
    assert response.json()["user"] == {"username": "admin", "role": "admin"}
