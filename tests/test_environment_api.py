from fastapi.testclient import TestClient

from onehealth.api import app


client = TestClient(app)


def test_environment_districts_returns_all_64_districts(monkeypatch):
    monkeypatch.setenv("ONEHEALTH_BACKEND", "csv")

    response = client.get("/api/v1/environment/districts")

    assert response.status_code == 200
    districts = response.json()
    assert len(districts) == 64
    assert {"location_code", "location_name", "mean_temp_c"}.issubset(districts[0])


def test_environment_single_district_returns_one_object(monkeypatch):
    monkeypatch.setenv("ONEHEALTH_BACKEND", "csv")

    response = client.get("/api/v1/environment/districts/BD-D-DHAKA")

    assert response.status_code == 200
    assert response.json()["location_code"] == "BD-D-DHAKA"


def test_environment_unknown_district_returns_404(monkeypatch):
    monkeypatch.setenv("ONEHEALTH_BACKEND", "csv")

    response = client.get("/api/v1/environment/districts/BD-D-ATLANTIS")

    assert response.status_code == 404
    assert "Unknown district location code" in response.json()["detail"]


def test_environment_monthly_is_ascending_and_honors_limit(monkeypatch):
    monkeypatch.setenv("ONEHEALTH_BACKEND", "csv")

    response = client.get("/api/v1/environment/districts/BD-D-DHAKA/monthly?limit=12")

    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 12
    assert rows == sorted(rows, key=lambda row: row["period_start"])


def test_environment_monthly_unknown_district_returns_404(monkeypatch):
    monkeypatch.setenv("ONEHEALTH_BACKEND", "csv")

    response = client.get("/api/v1/environment/districts/BD-D-ATLANTIS/monthly")

    assert response.status_code == 404


def test_environment_data_trust_reports_full_coverage(monkeypatch):
    monkeypatch.setenv("ONEHEALTH_BACKEND", "csv")

    response = client.get("/api/v1/environment/data-trust")

    assert response.status_code == 200
    report = response.json()
    assert report["coverage"]["location_count"] == 64
    assert report["capabilities"]["disease_correlation"] is False


def test_environment_endpoints_are_unaffected_by_the_disease_backend_switch(monkeypatch):
    monkeypatch.setenv("ONEHEALTH_BACKEND", "dhis2")

    response = client.get("/api/v1/environment/districts")

    assert response.status_code == 200
    assert len(response.json()) == 64
