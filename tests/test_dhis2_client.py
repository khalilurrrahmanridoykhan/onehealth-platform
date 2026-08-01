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
