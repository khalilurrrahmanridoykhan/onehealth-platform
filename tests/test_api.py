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
