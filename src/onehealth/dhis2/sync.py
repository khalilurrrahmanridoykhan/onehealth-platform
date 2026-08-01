from dataclasses import asdict, dataclass
from datetime import date
from typing import Any

from onehealth.dhis2.client import DHIS2Client
from onehealth.dhis2.mapping import DHIS2Mapping
from onehealth.dhis2.periods import dhis2_week_bounds, local_week_to_dhis2
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
        payloads.append(
            {
                "dataSet": mapping.data_set_uid,
                "period": local_week_to_dhis2(record.period_label),
                "orgUnit": location.uid,
                "completeDate": record.period_end.isoformat(),
                "dataValues": [
                    {
                        "dataElement": mapping.cases_data_element_uid,
                        "value": str(record.cases),
                        "comment": f"Source: {record.source_name}",
                    }
                ],
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
    for value in response.get("dataValues", []):
        if value.get("dataElement") != mapping.cases_data_element_uid:
            continue
        location_code = mapping.code_for_uid(value["orgUnit"])
        location = mapping.location_for_code(location_code)
        start, end, label = dhis2_week_bounds(value["period"])
        records.append(
            SurveillanceRecord(
                disease_code=mapping.disease_code,
                disease_name=mapping.disease_name,
                period_start=start,
                period_end=end,
                period_type="weekly",
                period_label=label,
                location_code=location_code,
                location_name=location.name,
                location_level=location.level,
                cases=int(value["value"]),
                deaths=None,
                population=None,
                incidence_per_100k=None,
                data_status="observed",
                source_name="DHIS2",
                source_url="",
                complete_period=True,
            )
        )
    return sorted(records, key=lambda record: record.period_start)

