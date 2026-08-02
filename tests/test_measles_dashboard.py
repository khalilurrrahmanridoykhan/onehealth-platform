import json
from pathlib import Path


def test_measles_dashboard_metadata_has_valid_references_and_uids():
    path = Path(__file__).parents[1] / "dhis2" / "metadata" / "measles_dashboard.json"
    metadata = json.loads(path.read_text(encoding="utf-8"))

    objects = [
        *metadata["visualizations"], *metadata["maps"], *metadata["dashboards"],
        *metadata["dashboards"][0]["dashboardItems"],
    ]
    assert all(len(item["id"]) == 11 for item in objects)
    assert len(metadata["visualizations"]) == 6
    assert len(metadata["maps"]) == 1
    assert len(metadata["dashboards"][0]["dashboardItems"]) == 7

    visualization_ids = {item["id"] for item in metadata["visualizations"]}
    map_ids = {item["id"] for item in metadata["maps"]}
    for item in metadata["dashboards"][0]["dashboardItems"]:
        if item["type"] == "MAP":
            assert item["map"]["id"] in map_ids
        else:
            assert item["visualization"]["id"] in visualization_ids
