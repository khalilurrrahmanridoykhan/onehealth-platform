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
    map_view = metadata["maps"][0]["mapViews"][0]
    assert [item["id"] for item in map_view["rows"][0]["items"]] == [
        "LEVEL-2", "BdOrgUnit01"
    ]
    assert map_view["organisationUnitLevels"] == [2]
    assert map_view["organisationUnits"] == [{"id": "BdOrgUnit01"}]
    assert map_view["noDataColor"].startswith("#")
    assert map_view["colorLow"].startswith("#")
    assert map_view["colorHigh"].startswith("#")
    for item in metadata["dashboards"][0]["dashboardItems"]:
        if item["type"] == "MAP":
            assert item["map"]["id"] in map_ids
        else:
            assert item["visualization"]["id"] in visualization_ids
