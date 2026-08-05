import json
from pathlib import Path


def test_nipah_dashboard_has_cases_deaths_hotspot_map_and_valid_uids():
    metadata = json.loads((Path(__file__).parents[1] / "dhis2/metadata/nipah_dashboard.json").read_text())
    objects = [*metadata["visualizations"], *metadata["maps"], *metadata["dashboards"], *metadata["dashboards"][0]["dashboardItems"]]
    assert all(len(item["id"]) == 11 for item in objects)
    assert len(metadata["visualizations"]) == 7
    assert len(metadata["dashboards"][0]["dashboardItems"]) == 8
    assert metadata["maps"][0]["mapViews"][0]["periods"] == [{"id":"2021"}]
