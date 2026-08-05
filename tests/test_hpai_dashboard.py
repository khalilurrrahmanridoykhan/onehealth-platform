import json
from pathlib import Path


def test_hpai_dashboard_metadata_is_complete_and_references_valid_objects():
    root = Path(__file__).parents[1]
    metadata = json.loads(
        (root / "dhis2/metadata/hpai_dashboard.json").read_text(encoding="utf-8")
    )
    objects = [
        *metadata["visualizations"], *metadata["maps"], *metadata["dashboards"],
        *metadata["dashboards"][0]["dashboardItems"],
    ]
    assert all(len(item["id"]) == 11 for item in objects)
    assert len(metadata["visualizations"]) == 6
    assert len(metadata["maps"]) == 1
    assert len(metadata["dashboards"][0]["dashboardItems"]) == 7
    map_view = metadata["maps"][0]["mapViews"][0]
    assert map_view["rows"][0]["items"] == [
        {"id": "LEVEL-2", "dimensionItemType": "ORGANISATION_UNIT"},
        {"id": "BdOrgUnit01", "dimensionItemType": "ORGANISATION_UNIT"},
    ]
    assert map_view["periods"][0] == {"id": "2007S1"}
    assert map_view["periods"][-1] == {"id": "2025S1"}
    assert len(map_view["periods"]) == 19
