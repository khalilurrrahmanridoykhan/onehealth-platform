import os
from dataclasses import asdict
from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from onehealth import __version__
from onehealth.config import DEFAULT_DATA_PATH, DEFAULT_DHIS2_MAPPING_PATH, DHIS2Settings
from onehealth.dhis2 import DHIS2APIError, DHIS2Client, DHIS2Mapping
from onehealth.dhis2.ebs import (
    EBS_ATTRIBUTES,
    EBS_DATA_ELEMENTS,
    EBS_PROGRAM_UID,
    EBS_REQUIRED_FIELDS,
    EBS_STAGE_FIELDS,
    EBS_STAGES,
    EBSSignalInput,
    build_signal_bundle,
    build_stage_event,
)
from onehealth.dhis2.sync import records_from_dhis2
from onehealth.services.alerts import generate_latest_alert
from onehealth.services.surveillance import load_surveillance_records


app = FastAPI(
    title="OneHealth Intelligence Platform API",
    version=__version__,
    description="Disease surveillance trends and explainable early-warning alerts.",
)

cors_origins = [
    origin.strip()
    for origin in os.environ.get(
        "ONEHEALTH_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _data_path() -> Path:
    return Path(os.environ.get("ONEHEALTH_DATA_PATH", DEFAULT_DATA_PATH))


def _records():
    backend = os.environ.get("ONEHEALTH_BACKEND", "csv").strip().lower()
    if backend == "dhis2":
        try:
            settings = DHIS2Settings.from_env()
            mapping = DHIS2Mapping.from_path(settings.mapping_path)
            start_date = os.environ.get("DHIS2_START_DATE", "2020-01-01")
            end_date = os.environ.get("DHIS2_END_DATE", date.today().isoformat())
            responses = []
            with DHIS2Client(
                settings.base_url,
                api_token=settings.api_token,
                username=settings.username,
                password=settings.password,
                verify_ssl=settings.verify_ssl,
                timeout_seconds=settings.timeout_seconds,
            ) as client:
                for location in mapping.locations.values():
                    responses.append(
                        client.get_data_values(
                            data_set=mapping.data_set_uid,
                            org_unit=location.uid,
                            start_date=start_date,
                            end_date=end_date,
                        )
                    )
            records = [
                record
                for response in responses
                for record in records_from_dhis2(response, mapping)
            ]
        except (ValueError, OSError, DHIS2APIError) as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
    elif backend == "csv":
        records = load_surveillance_records(_data_path())
    else:
        raise HTTPException(
            status_code=503,
            detail="ONEHEALTH_BACKEND must be csv or dhis2",
        )
    if not records:
        raise HTTPException(
            status_code=503,
            detail="No surveillance data returned by the configured backend.",
        )
    return records


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


@app.get("/api/v1/diseases")
def diseases() -> list[dict[str, str]]:
    unique = {(record.disease_code, record.disease_name) for record in _records()}
    return [
        {"code": code, "name": name}
        for code, name in sorted(unique)
    ]


@app.get("/api/v1/locations")
def locations(disease_code: str | None = None) -> list[dict[str, str]]:
    selected = [
        record
        for record in _records()
        if disease_code is None or record.disease_code == disease_code.upper()
    ]
    unique = {
        (record.location_code, record.location_name, record.location_level)
        for record in selected
    }
    return [
        {"code": code, "name": name, "level": level}
        for code, name, level in sorted(unique)
    ]


@app.get("/api/v1/trends/{disease_code}")
def trends(
    disease_code: str,
    location_code: str = "BD",
    complete_only: bool = True,
    limit: int = Query(default=52, ge=1, le=520),
) -> list[dict]:
    selected = [
        record
        for record in _records()
        if record.disease_code == disease_code.upper()
        and record.location_code == location_code.upper()
        and (record.complete_period or not complete_only)
    ]
    if not selected:
        raise HTTPException(status_code=404, detail="Disease/location trend not found")
    return [asdict(record) for record in selected[-limit:]]


@app.get("/api/v1/alerts/{disease_code}/latest")
def latest_alert(disease_code: str, location_code: str = "BD") -> dict:
    selected = [
        record
        for record in _records()
        if record.disease_code == disease_code.upper()
        and record.location_code == location_code.upper()
    ]
    alert = generate_latest_alert(selected)
    if alert is None:
        raise HTTPException(status_code=404, detail="Not enough complete periods for an alert")
    return asdict(alert)


@app.get("/api/v1/summary/{disease_code}")
def summary(disease_code: str, location_code: str = "BD") -> dict:
    selected = [
        record
        for record in _records()
        if record.disease_code == disease_code.upper()
        and record.location_code == location_code.upper()
        and record.complete_period
    ]
    if not selected:
        raise HTTPException(status_code=404, detail="Disease/location summary not found")
    selected.sort(key=lambda record: record.period_start)
    latest = selected[-1]
    alert = generate_latest_alert(selected)
    return {
        "disease_code": latest.disease_code,
        "location_code": latest.location_code,
        "location_name": latest.location_name,
        "periods": len(selected),
        "total_cases": sum(record.cases for record in selected),
        "latest_period": latest.period_label,
        "latest_cases": latest.cases,
        "risk_level": alert.risk_level if alert else None,
    }


@app.get("/api/v1/overview/{disease_code}")
def overview(disease_code: str) -> list[dict]:
    disease_records = [
        record
        for record in _records()
        if record.disease_code == disease_code.upper() and record.complete_period
    ]
    if not disease_records:
        raise HTTPException(status_code=404, detail="Disease overview not found")

    by_location: dict[str, list] = {}
    for record in disease_records:
        by_location.setdefault(record.location_code, []).append(record)

    results = []
    for location_code, records in by_location.items():
        records.sort(key=lambda record: record.period_start)
        latest = records[-1]
        alert = generate_latest_alert(records)
        results.append(
            {
                "location_code": location_code,
                "location_name": latest.location_name,
                "location_level": latest.location_level,
                "periods": len(records),
                "total_cases": sum(record.cases for record in records),
                "latest_period": latest.period_label,
                "latest_cases": latest.cases,
                "risk_level": alert.risk_level if alert else None,
                "expected_cases": alert.expected_cases if alert else None,
            }
        )
    return sorted(
        results,
        key=lambda item: (item["location_level"] != "national", item["location_name"]),
    )


class EBSSignalRequest(BaseModel):
    signal_id: str = Field(min_length=3, max_length=100)
    title: str = Field(min_length=3, max_length=200)
    source: str = Field(min_length=2, max_length=100)
    signal_type: str = Field(min_length=2, max_length=100)
    description: str = Field(min_length=5, max_length=2000)
    location_code: str = Field(min_length=2, max_length=20)
    detected_on: date


class EBSStageRequest(BaseModel):
    stage: str = Field(min_length=3, max_length=50)
    enrollment_uid: str = Field(min_length=11, max_length=11)
    location_code: str = Field(min_length=2, max_length=20)
    occurred_on: date
    values: dict[str, str | int]


def _ebs_org_unit_uid(location_code: str) -> str:
    mapping_path = Path(
        os.environ.get("DHIS2_MAPPING_PATH", DEFAULT_DHIS2_MAPPING_PATH)
    )
    try:
        mapping = DHIS2Mapping.from_path(mapping_path)
        return mapping.location_for_code(location_code.upper()).uid
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _ebs_signal_bundle(request: EBSSignalRequest) -> dict:
    return build_signal_bundle(
        EBSSignalInput(
            signal_id=request.signal_id,
            title=request.title,
            source=request.source,
            signal_type=request.signal_type,
            description=request.description,
            org_unit_uid=_ebs_org_unit_uid(request.location_code),
            detected_on=request.detected_on,
        )
    )


def _ebs_stage_bundle(request: EBSStageRequest) -> dict:
    try:
        return build_stage_event(
            stage=request.stage,
            enrollment_uid=request.enrollment_uid,
            org_unit_uid=_ebs_org_unit_uid(request.location_code),
            occurred_on=request.occurred_on,
            values=request.values,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/v1/ebs/schema")
def ebs_schema() -> dict:
    order = [
        "detection",
        "verification",
        "risk_assessment",
        "investigation",
        "response",
        "closure",
    ]
    return {
        "stages": [
            {
                "code": stage,
                "uid": EBS_STAGES[stage],
                "fields": sorted(EBS_STAGE_FIELDS.get(stage, {"signal_type", "description"})),
                "required_fields": sorted(
                    EBS_REQUIRED_FIELDS.get(stage, {"signal_type", "description"})
                ),
                "repeatable": stage in {"investigation", "response"},
            }
            for stage in order
        ]
    }


def _tracker_items(response: dict, legacy_key: str) -> list[dict]:
    items = response.get("instances", response.get(legacy_key, []))
    return items if isinstance(items, list) else []


def _attribute_values(entity: dict) -> dict[str, str]:
    by_uid = {
        item.get("attribute"): str(item.get("value", ""))
        for item in entity.get("attributes", [])
        if isinstance(item, dict)
    }
    return {name: by_uid.get(uid, "") for name, uid in EBS_ATTRIBUTES.items()}


def _event_view(event: dict) -> dict:
    stage_by_uid = {uid: code for code, uid in EBS_STAGES.items()}
    field_by_uid = {uid: code for code, uid in EBS_DATA_ELEMENTS.items()}
    values = {
        field_by_uid.get(item.get("dataElement"), item.get("dataElement", "unknown")): item.get("value")
        for item in event.get("dataValues", [])
        if isinstance(item, dict)
    }
    return {
        "event_uid": event.get("event"),
        "stage": stage_by_uid.get(event.get("programStage"), "unknown"),
        "status": event.get("status"),
        "occurred_at": event.get("occurredAt"),
        "updated_at": event.get("updatedAt"),
        "values": values,
    }


def _settings_and_client() -> tuple[DHIS2Settings, DHIS2Client]:
    settings = DHIS2Settings.from_env()
    return settings, DHIS2Client(
        settings.base_url,
        api_token=settings.api_token,
        username=settings.username,
        password=settings.password,
        verify_ssl=settings.verify_ssl,
        timeout_seconds=settings.timeout_seconds,
    )


@app.get("/api/v1/ebs/status")
def ebs_status() -> dict:
    configured = bool(
        os.environ.get("DHIS2_BASE_URL", "").strip()
        and (
            os.environ.get("DHIS2_API_TOKEN", "").strip()
            or (
                os.environ.get("DHIS2_USERNAME", "").strip()
                and os.environ.get("DHIS2_PASSWORD", "").strip()
            )
        )
    )
    return {
        "dhis2_configured": configured,
        "reads_enabled": os.environ.get("ONEHEALTH_EBS_READS_ENABLED", "false").lower() == "true",
        "writes_enabled": os.environ.get("ONEHEALTH_EBS_WRITES_ENABLED", "false").lower() == "true",
        "program_uid": EBS_PROGRAM_UID,
    }


@app.get("/api/v1/ebs/signals")
def list_ebs_signals(
    q: str | None = Query(default=None, max_length=100),
    location_code: str | None = Query(default=None, max_length=20),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
) -> dict:
    if os.environ.get("ONEHEALTH_EBS_READS_ENABLED", "false").lower() != "true":
        raise HTTPException(
            status_code=403,
            detail="EBS registry reads are disabled until access control is configured.",
        )
    try:
        settings, client = _settings_and_client()
        org_unit = _ebs_org_unit_uid(location_code) if location_code else None
        with client:
            response = client.get_tracked_entities(
                program=EBS_PROGRAM_UID,
                org_unit=org_unit,
                page=page,
                page_size=page_size,
            )
    except (ValueError, OSError, DHIS2APIError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    signals = []
    query = (q or "").casefold()
    for entity in _tracker_items(response, "trackedEntities"):
        attributes = _attribute_values(entity)
        if query and query not in " ".join(attributes.values()).casefold():
            continue
        signals.append(
            {
                "tracked_entity_uid": entity.get("trackedEntity"),
                "org_unit_uid": entity.get("orgUnit"),
                "signal_id": attributes["signal_id"],
                "title": attributes["title"],
                "source": attributes["source"],
                "created_at": entity.get("createdAt"),
                "updated_at": entity.get("updatedAt"),
            }
        )
    return {"signals": signals, "pager": response.get("pager"), "dhis2_url": settings.base_url}


@app.get("/api/v1/ebs/signals/{tracked_entity_uid}")
def get_ebs_signal(tracked_entity_uid: str) -> dict:
    if os.environ.get("ONEHEALTH_EBS_READS_ENABLED", "false").lower() != "true":
        raise HTTPException(
            status_code=403,
            detail="EBS registry reads are disabled until access control is configured.",
        )
    try:
        _, client = _settings_and_client()
        with client:
            entity = client.get_tracked_entity(tracked_entity_uid)
            event_response = client.get_tracker_events(
                tracked_entity_uid=tracked_entity_uid,
                program=EBS_PROGRAM_UID,
            )
    except (ValueError, OSError, DHIS2APIError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    attributes = _attribute_values(entity)
    events = [_event_view(event) for event in _tracker_items(event_response, "events")]
    enrollments = entity.get("enrollments", [])
    return {
        "tracked_entity_uid": entity.get("trackedEntity", tracked_entity_uid),
        "org_unit_uid": entity.get("orgUnit"),
        **attributes,
        "enrollment_uid": enrollments[0].get("enrollment") if enrollments else None,
        "created_at": entity.get("createdAt"),
        "updated_at": entity.get("updatedAt"),
        "events": events,
    }


@app.post("/api/v1/ebs/signals/preview")
def preview_ebs_signal(request: EBSSignalRequest) -> dict:
    return {"mode": "PREVIEW", "bundle": _ebs_signal_bundle(request)}


@app.post("/api/v1/ebs/stages/preview")
def preview_ebs_stage(request: EBSStageRequest) -> dict:
    return {"mode": "PREVIEW", "stage": request.stage, "bundle": _ebs_stage_bundle(request)}


@app.post("/api/v1/ebs/signals")
def submit_ebs_signal(request: EBSSignalRequest) -> dict:
    if os.environ.get("ONEHEALTH_EBS_WRITES_ENABLED", "false").lower() != "true":
        raise HTTPException(
            status_code=403,
            detail="EBS writes are disabled. Preview the signal or explicitly enable live writes.",
        )
    try:
        settings = DHIS2Settings.from_env()
        with DHIS2Client(
            settings.base_url,
            api_token=settings.api_token,
            username=settings.username,
            password=settings.password,
            verify_ssl=settings.verify_ssl,
            timeout_seconds=settings.timeout_seconds,
        ) as client:
            response = client.import_tracker_bundle(_ebs_signal_bundle(request))
    except (ValueError, OSError, DHIS2APIError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"mode": "COMMITTED", "response": response}


@app.post("/api/v1/ebs/stages")
def submit_ebs_stage(request: EBSStageRequest) -> dict:
    if os.environ.get("ONEHEALTH_EBS_WRITES_ENABLED", "false").lower() != "true":
        raise HTTPException(
            status_code=403,
            detail="EBS writes are disabled. Preview the stage or explicitly enable live writes.",
        )
    try:
        settings = DHIS2Settings.from_env()
        with DHIS2Client(
            settings.base_url,
            api_token=settings.api_token,
            username=settings.username,
            password=settings.password,
            verify_ssl=settings.verify_ssl,
            timeout_seconds=settings.timeout_seconds,
        ) as client:
            response = client.import_tracker_bundle(_ebs_stage_bundle(request))
    except (ValueError, OSError, DHIS2APIError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"mode": "COMMITTED", "response": response}
