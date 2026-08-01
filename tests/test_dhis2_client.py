import httpx

from onehealth.dhis2.client import DHIS2Client


def test_api_token_and_system_info_request():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == "https://dhis.example/api/system/info"
        assert request.headers["Authorization"] == "ApiToken test-token"
        return httpx.Response(200, json={"version": "42.0"})

    with DHIS2Client(
        "https://dhis.example",
        api_token="test-token",
        transport=httpx.MockTransport(handler),
    ) as client:
        assert client.system_info()["version"] == "42.0"


def test_data_value_import_uses_dry_run_and_update_strategy():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/dataValueSets"
        assert request.url.params["dryRun"] == "true"
        assert request.url.params["importStrategy"] == "CREATE_AND_UPDATE"
        return httpx.Response(200, json={"status": "SUCCESS"})

    with DHIS2Client(
        "https://dhis.example",
        api_token="test-token",
        transport=httpx.MockTransport(handler),
    ) as client:
        result = client.import_data_value_set(
            {"dataSet": "OhDngWeek01", "dataValues": []}, dry_run=True
        )

    assert result["status"] == "SUCCESS"


def test_tracker_entity_and_event_reads_use_program_filters():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"instances": []})

    with DHIS2Client(
        "https://dhis.example",
        api_token="test-token",
        transport=httpx.MockTransport(handler),
    ) as client:
        client.get_tracked_entities(program="OhEbsProg01", org_unit="BdDivDha001")
        client.get_tracker_events(
            tracked_entity_uid="Abcdef12345", program="OhEbsProg01"
        )

    assert requests[0].url.path == "/api/tracker/trackedEntities"
    assert requests[0].url.params["program"] == "OhEbsProg01"
    assert requests[0].url.params["orgUnit"] == "BdDivDha001"
    assert requests[1].url.path == "/api/tracker/events"
    assert requests[1].url.params["trackedEntity"] == "Abcdef12345"


def test_analytical_objects_use_dedicated_update_endpoints():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"status": "OK"})

    with DHIS2Client(
        "https://dhis.example",
        api_token="test-token",
        transport=httpx.MockTransport(handler),
    ) as client:
        client.update_visualization("OhDngTrend1", {"id": "OhDngTrend1"})
        client.update_dashboard("OhDngDash01", {"id": "OhDngDash01"})

    assert requests[0].method == "PUT"
    assert requests[0].url.path == "/api/visualizations/OhDngTrend1"
    assert requests[1].method == "PUT"
    assert requests[1].url.path == "/api/dashboards/OhDngDash01"
