from dataclasses import asdict, dataclass
from datetime import date
from typing import Any

from onehealth.dhis2.client import DHIS2Client
from onehealth.dhis2.mapping import DHIS2Mapping
from onehealth.dhis2.periods import dhis2_period_bounds, local_period_to_dhis2
from onehealth.models import SurveillanceRecord


@dataclass(frozen=True, slots=True)
class SyncItemResult:
    disease_code: str
    location_code: str
    period: str
    dry_run: bool
    status: str
    response: dict[str, Any]


def records_to_data_value_sets(
    records: list[SurveillanceRecord], mapping: DHIS2Mapping
) -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()

    for record in records:
        if record.disease_code != mapping.disease_code:
            continue
        if not record.complete_period:
            continue

        key = (record.disease_code, record.location_code, record.period_label)
        if key in seen:
            raise ValueError(f"Duplicate surveillance record: {key}")
        seen.add(key)

        location = mapping.location_for_code(record.location_code)
        data_values = [{
            "dataElement": mapping.cases_uid_for_location(location),
            "value": str(record.cases),
            "comment": f"Source: {record.source_name}",
        }]
        deaths_uid = mapping.deaths_uid_for_location(location)
        if deaths_uid and record.deaths is not None:
            data_values.append({
                "dataElement": deaths_uid,
                "value": str(record.deaths),
                "comment": f"Source: {record.source_name}",
            })
        payloads.append(
            {
                "dataSet": mapping.data_set_uid,
                "period": local_period_to_dhis2(record.period_label, mapping.period_type),
                "orgUnit": location.uid,
                "completeDate": record.period_end.isoformat(),
                "dataValues": data_values,
            }
        )
    return payloads


def sync_records(
    client: DHIS2Client,
    records: list[SurveillanceRecord],
    mapping: DHIS2Mapping,
    *,
    dry_run: bool,
) -> list[SyncItemResult]:
    results: list[SyncItemResult] = []
    for payload in records_to_data_value_sets(records, mapping):
        response = client.import_data_value_set(payload, dry_run=dry_run)
        results.append(
            SyncItemResult(
                disease_code=mapping.disease_code,
                location_code=mapping.code_for_uid(payload["orgUnit"]),
                period=payload["period"],
                dry_run=dry_run,
                status=str(response.get("status", "SUBMITTED")),
                response=response,
            )
        )
    return results


def sync_report(results: list[SyncItemResult]) -> dict[str, Any]:
    return {
        "generatedAt": date.today().isoformat(),
        "count": len(results),
        "dryRun": all(item.dry_run for item in results) if results else True,
        "items": [asdict(item) for item in results],
    }


def records_from_dhis2(
    response: dict[str, Any], mapping: DHIS2Mapping
) -> list[SurveillanceRecord]:
    records: list[SurveillanceRecord] = []
    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    for value in response.get("dataValues", []):
        location_code = mapping.code_for_uid(value["orgUnit"])
        location = mapping.location_for_code(location_code)
        key = (value["period"], value["orgUnit"])
        item = grouped.setdefault(key, {"location_code": location_code, "location": location})
        if value.get("dataElement") == mapping.cases_uid_for_location(location):
            item["cases"] = int(value["value"])
        elif value.get("dataElement") == mapping.deaths_uid_for_location(location):
            item["deaths"] = int(value["value"])
    for (period, _), value in grouped.items():
        if "cases" not in value:
            continue
        location_code = value["location_code"]
        location = value["location"]
        start, end, label = dhis2_period_bounds(period, mapping.period_type)
        records.append(
            SurveillanceRecord(
                disease_code=mapping.disease_code,
                disease_name=mapping.disease_name,
                period_start=start,
                period_end=end,
                period_type=mapping.period_type.lower(),
                period_label=label,
                location_code=location_code,
                location_name=location.name,
                location_level=location.level,
                cases=value["cases"],
                deaths=value.get("deaths"),
                population=None,
                incidence_per_100k=None,
                data_status="observed",
                source_name="DHIS2",
                source_url="",
                complete_period=True,
            )
        )
    return sorted(records, key=lambda record: record.period_start)
