import onehealth.api as api_module
from fastapi.testclient import TestClient

from onehealth.api import app


client = TestClient(app)


def _use_awd_data(monkeypatch):
    root = api_module.DEFAULT_DATA_PATH.parents[1]
    monkeypatch.setenv("ONEHEALTH_BACKEND", "csv")
    monkeypatch.setenv("ONEHEALTH_DATA_PATHS", str(root / "processed/awd_annual.csv"))


def test_awd_correlation_returns_full_report(monkeypatch):
    _use_awd_data(monkeypatch)

    response = client.get("/api/v1/environment/awd-correlation")

    assert response.status_code == 200
    report = response.json()
    assert report["sample_size"] == 64
    assert report["years"] == [str(year) for year in range(2017, 2025)]
    assert len(report["divisions"]) == 8
    assert set(report["variables"]) == {"mean_temp_c", "total_precip_mm", "extreme_heat_days"}
    for variable in report["variables"].values():
        assert -1.0 <= variable["pooled"]["pearson_r"] <= 1.0
        assert 0.0 < variable["pooled"]["pearson_p"] <= 1.0
        assert -1.0 <= variable["within_division"]["pearson_r"] <= 1.0
    assert report["limitations"]
    assert "causation" in report["disclaimer"]


def test_awd_correlation_is_reproducible_across_requests(monkeypatch):
    # Fixed permutation seed: repeated calls (served from cache or recomputed)
    # must return identical p-values, not just identical r-values.
    _use_awd_data(monkeypatch)

    first = client.get("/api/v1/environment/awd-correlation").json()
    second = client.get("/api/v1/environment/awd-correlation").json()

    assert first["variables"] == second["variables"]


def test_awd_correlation_survives_records_without_incidence(monkeypatch, tmp_path):
    # Regression test for a real production failure: DHIS2-backed AWD records
    # never carry incidence_per_100k (only "cases" round-trips through DHIS2
    # data values), which previously crashed this endpoint with a 500. Simulate
    # that shape using the CSV backend so it doesn't require a live DHIS2 instance.
    import csv

    root = api_module.DEFAULT_DATA_PATH.parents[1]
    source = root / "processed/awd_annual.csv"
    stripped = tmp_path / "awd_no_incidence.csv"
    with source.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    for row in rows:
        row["incidence_per_100k"] = ""
        row["population"] = ""
    with stripped.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    monkeypatch.setenv("ONEHEALTH_BACKEND", "csv")
    monkeypatch.setenv("ONEHEALTH_DATA_PATHS", str(stripped))

    response = client.get("/api/v1/environment/awd-correlation")

    assert response.status_code == 200
    report = response.json()
    assert report["sample_size"] == 64
    assert report["awd_metric"]["unit"] == "raw cases (not population-normalized)"
    assert report["limitations"][0].startswith("Population-normalized AWD incidence was not available")
