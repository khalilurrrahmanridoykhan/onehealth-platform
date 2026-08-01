from collections.abc import Mapping
from typing import Any

import httpx


class DHIS2APIError(RuntimeError):
    """Raised when DHIS2 returns an unsuccessful response."""


class DHIS2Client:
    def __init__(
        self,
        base_url: str,
        *,
        api_token: str | None = None,
        username: str | None = None,
        password: str | None = None,
        verify_ssl: bool = True,
        timeout_seconds: float = 30,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        if not api_token and not (username and password):
            raise ValueError("DHIS2 authentication is required")

        headers = {"Accept": "application/json"}
        auth = None
        if api_token:
            headers["Authorization"] = f"ApiToken {api_token}"
        else:
            auth = httpx.BasicAuth(username or "", password or "")

        self._client = httpx.Client(
            base_url=f"{base_url.rstrip('/')}/api/",
            headers=headers,
            auth=auth,
            verify=verify_ssl,
            timeout=timeout_seconds,
            transport=transport,
        )

    def __enter__(self) -> "DHIS2Client":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def close(self) -> None:
        self._client.close()

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Mapping[str, Any] | None = None,
        payload: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        try:
            response = self._client.request(
                method, path.lstrip("/"), params=params, json=payload
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:1000]
            raise DHIS2APIError(
                f"DHIS2 {method} {path} failed with "
                f"HTTP {exc.response.status_code}: {detail}"
            ) from exc
        except httpx.HTTPError as exc:
            raise DHIS2APIError(f"Could not reach DHIS2: {exc}") from exc

        if not response.content:
            return {}
        try:
            result = response.json()
        except ValueError as exc:
            raise DHIS2APIError("DHIS2 returned a non-JSON response") from exc
        if not isinstance(result, dict):
            raise DHIS2APIError("DHIS2 returned an unexpected JSON response")
        return result

    def system_info(self) -> dict[str, Any]:
        return self._request("GET", "system/info")

    def import_metadata(
        self, metadata: Mapping[str, Any], *, dry_run: bool = True
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            "metadata",
            params={"importStrategy": "CREATE_AND_UPDATE", "dryRun": dry_run},
            payload=metadata,
        )

    def import_data_value_set(
        self, data_value_set: Mapping[str, Any], *, dry_run: bool = True
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            "dataValueSets",
            params={"importStrategy": "CREATE_AND_UPDATE", "dryRun": dry_run},
            payload=data_value_set,
        )

    def update_visualization(
        self, uid: str, visualization: Mapping[str, Any]
    ) -> dict[str, Any]:
        return self._request("PUT", f"visualizations/{uid}", payload=visualization)

    def update_dashboard(
        self, uid: str, dashboard: Mapping[str, Any]
    ) -> dict[str, Any]:
        return self._request("PUT", f"dashboards/{uid}", payload=dashboard)

    def get_data_values(
        self,
        *,
        data_set: str,
        org_unit: str,
        start_date: str,
        end_date: str,
    ) -> dict[str, Any]:
        return self._request(
            "GET",
            "dataValueSets",
            params={
                "dataSet": data_set,
                "orgUnit": org_unit,
                "startDate": start_date,
                "endDate": end_date,
            },
        )

    def import_tracker_bundle(
        self, bundle: Mapping[str, Any]
    ) -> dict[str, Any]:
        return self._request(
            "POST",
            "tracker",
            params={
                "async": "false",
                "importStrategy": "CREATE_AND_UPDATE",
                "atomicMode": "ALL",
                "reportMode": "FULL",
            },
            payload=bundle,
        )

    def get_tracked_entities(
        self,
        *,
        program: str,
        org_unit: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {
            "program": program,
            "page": page,
            "pageSize": page_size,
            "totalPages": "true",
            "fields": "trackedEntity,orgUnit,createdAt,updatedAt,attributes",
        }
        if org_unit:
            params.update({"orgUnit": org_unit, "ouMode": "SELECTED"})
        return self._request("GET", "tracker/trackedEntities", params=params)

    def get_tracked_entity(self, tracked_entity_uid: str) -> dict[str, Any]:
        return self._request(
            "GET",
            f"tracker/trackedEntities/{tracked_entity_uid}",
            params={"fields": "trackedEntity,orgUnit,createdAt,updatedAt,attributes,enrollments"},
        )

    def get_tracker_events(
        self, *, tracked_entity_uid: str, program: str
    ) -> dict[str, Any]:
        return self._request(
            "GET",
            "tracker/events",
            params={
                "trackedEntity": tracked_entity_uid,
                "program": program,
                "fields": "event,programStage,enrollment,orgUnit,status,occurredAt,createdAt,updatedAt,dataValues",
                "order": "occurredAt:asc",
                "pageSize": 100,
            },
        )
