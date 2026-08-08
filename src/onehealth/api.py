import csv
import io
import os
from dataclasses import asdict
from datetime import date
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from onehealth import __version__
from onehealth.auth import User, authenticate, issue_token, require_role
from onehealth.config import (
    DEFAULT_DATA_PATH,
    DEFAULT_DHIS2_MAPPING_PATH,
    DEFAULT_ENVIRONMENT_MONTHLY_PATH,
    DEFAULT_ENVIRONMENT_SUMMARY_PATH,
    DHIS2Settings,
)
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
from onehealth.services.awd_climate_correlation import build_awd_climate_correlation_report
from onehealth.services.data_trust import (
    UnknownDiseaseError,
    build_data_trust_catalog,
    build_data_trust_detail,
)
from onehealth.services.environment import load_environment_monthly, load_environment_summary
from onehealth.services.environment_trust import (
    build_environment_trust_report,
    load_environment_registry,
)
from onehealth.services.operations import (
    build_notifications,
    build_operation_item,
    operation_summary,
)
from onehealth.services.snapshot_cache import SnapshotCache, SnapshotResult
from onehealth.services.surveillance import load_surveillance_records


app = FastAPI(
    title="OneHealth Intelligence Platform API",
    version=__version__,
    description="Disease surveillance trends and explainable early-warning alerts.",
)
bearer = HTTPBearer(auto_error=False)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200)


def viewer(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> User:
    return require_role(credentials, "viewer")


def responder(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> User:
    return require_role(credentials, "responder")


def admin(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> User:
    return require_role(credentials, "admin")


@app.post("/api/v1/auth/login")
def login(request: LoginRequest) -> dict:
    try:
        user = authenticate(request.username, request.password)
    except HTTPException as local_error:
        if local_error.status_code != 401:
            raise
        try:
            settings = DHIS2Settings.from_env()
            with DHIS2Client(
                settings.base_url,
                username=request.username,
                password=request.password,
                verify_ssl=settings.verify_ssl,
                timeout_seconds=settings.timeout_seconds,
            ) as client:
                profile = client.current_user()
        except (ValueError, OSError, DHIS2APIError):
            raise HTTPException(401, "Invalid username or password") from None
        authorities = set(profile.get("authorities") or [])
        if "ALL" in authorities:
            role = "admin"
        elif {"F_PROGRAMSTAGE_ADD", "F_TRACKED_ENTITY_INSTANCE_ADD"} & authorities:
            role = "responder"
        else:
            role = "viewer"
        user = User(str(profile.get("username") or request.username), role)
    return {"access_token": issue_token(user), "token_type": "bearer", "user": {"username": user.username, "role": user.role}}


@app.get("/api/v1/auth/me")
def me(user: User = Depends(viewer)) -> dict:
    return {"username": user.username, "role": user.role}

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


def _configured_paths(name: str, fallback: Path) -> list[Path]:
    value = os.environ.get(name, "").strip()
    return (
        [Path(item.strip()) for item in value.split(",") if item.strip()]
        if value
        else [fallback]
    )


_record_snapshots: SnapshotCache[tuple] = SnapshotCache()


def _cache_seconds(name: str, default: float) -> float:
    try:
        value = float(os.environ.get(name, str(default)))
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=f"{name} must be numeric") from exc
    if value < 0:
        raise HTTPException(status_code=503, detail=f"{name} cannot be negative")
    return value


def _record_cache_key() -> tuple:
    backend = os.environ.get("ONEHEALTH_BACKEND", "csv").strip().lower()
    if backend == "csv":
        paths = _configured_paths("ONEHEALTH_DATA_PATHS", _data_path())
        return (backend, *(str(path.resolve()) for path in paths))
    if backend == "dhis2":
        mapping_paths = os.environ.get(
            "DHIS2_MAPPING_PATHS", os.environ.get("DHIS2_MAPPING_PATH", "")
        )
        return (
            backend,
            os.environ.get("DHIS2_BASE_URL", "").strip(),
            mapping_paths,
            os.environ.get("DHIS2_START_DATE", "2020-01-01"),
            os.environ.get("DHIS2_END_DATE", date.today().isoformat()),
        )
    return (backend,)


def _load_records_uncached() -> tuple:
    backend = os.environ.get("ONEHEALTH_BACKEND", "csv").strip().lower()
    if backend == "dhis2":
        try:
            settings = DHIS2Settings.from_env()
            start_date = os.environ.get("DHIS2_START_DATE", "2020-01-01")
            end_date = os.environ.get("DHIS2_END_DATE", date.today().isoformat())
            records = []
            with DHIS2Client(
                settings.base_url,
                api_token=settings.api_token,
                username=settings.username,
                password=settings.password,
                verify_ssl=settings.verify_ssl,
                timeout_seconds=settings.timeout_seconds,
            ) as client:
                for mapping_path in _configured_paths(
                    "DHIS2_MAPPING_PATHS", settings.mapping_path
                ):
                    mapping = DHIS2Mapping.from_path(mapping_path)
                    for location in mapping.locations.values():
                        response = client.get_data_values(
                            data_set=mapping.data_set_uid,
                            org_unit=location.uid,
                            start_date=start_date,
                            end_date=end_date,
                        )
                        records.extend(records_from_dhis2(response, mapping))
        except (ValueError, OSError, DHIS2APIError) as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
    elif backend == "csv":
        records = [
            record
            for path in _configured_paths("ONEHEALTH_DATA_PATHS", _data_path())
            for record in load_surveillance_records(path)
        ]
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
    return tuple(records)


def _records_snapshot() -> SnapshotResult[tuple]:
    return _record_snapshots.get_or_load(
        _record_cache_key(),
        _load_records_uncached,
        ttl_seconds=_cache_seconds("ONEHEALTH_CACHE_TTL_SECONDS", 300),
        stale_if_error_seconds=_cache_seconds(
            "ONEHEALTH_CACHE_STALE_IF_ERROR_SECONDS", 86_400
        ),
    )


def _records():
    return _records_snapshot().value


def _environment_monthly_path() -> Path:
    return Path(
        os.environ.get("ONEHEALTH_ENVIRONMENT_MONTHLY_PATH", DEFAULT_ENVIRONMENT_MONTHLY_PATH)
    )


def _environment_summary_path() -> Path:
    return Path(
        os.environ.get("ONEHEALTH_ENVIRONMENT_SUMMARY_PATH", DEFAULT_ENVIRONMENT_SUMMARY_PATH)
    )


# Deliberately a second, independent SnapshotCache instance: environment data
# never goes through the DHIS2 backend switch that governs disease records
# (see _record_cache_key/_load_records_uncached above), so its cache key and
# loader must not be entangled with that logic.
_environment_snapshots: SnapshotCache[tuple] = SnapshotCache()


def _environment_cache_key() -> tuple:
    return (str(_environment_monthly_path().resolve()), str(_environment_summary_path().resolve()))


def _load_environment_uncached() -> tuple:
    monthly = load_environment_monthly(_environment_monthly_path())
    summary = load_environment_summary(_environment_summary_path())
    if not monthly or not summary:
        raise HTTPException(
            status_code=503,
            detail="No environment data returned by the configured backend.",
        )
    return (tuple(monthly), tuple(summary))


def _environment_snapshot() -> SnapshotResult[tuple]:
    return _environment_snapshots.get_or_load(
        _environment_cache_key(),
        _load_environment_uncached,
        ttl_seconds=_cache_seconds("ONEHEALTH_CACHE_TTL_SECONDS", 300),
        stale_if_error_seconds=_cache_seconds(
            "ONEHEALTH_CACHE_STALE_IF_ERROR_SECONDS", 86_400
        ),
    )


# Correlation analysis re-runs a permutation test (a few thousand reshuffles
# per variable), so it gets its own cache rather than recomputing on every
# request -- but it is otherwise just a derived view over the same two
# already-cached snapshots above, not a new data source.
_awd_correlation_snapshots: SnapshotCache[dict] = SnapshotCache()


def _awd_correlation_cache_key() -> tuple:
    return (_record_cache_key(), _environment_cache_key())


def _load_awd_correlation_uncached() -> dict:
    monthly, _summary = _environment_snapshot().value
    return build_awd_climate_correlation_report(list(_records()), list(monthly))


def _awd_correlation_snapshot() -> SnapshotResult[dict]:
    return _awd_correlation_snapshots.get_or_load(
        _awd_correlation_cache_key(),
        _load_awd_correlation_uncached,
        ttl_seconds=_cache_seconds("ONEHEALTH_CACHE_TTL_SECONDS", 300),
        stale_if_error_seconds=_cache_seconds(
            "ONEHEALTH_CACHE_STALE_IF_ERROR_SECONDS", 86_400
        ),
    )


def _expose_snapshot_headers(response: Response, snapshot: SnapshotResult[tuple]) -> None:
    """Expose non-secret delivery state without changing the trust-report contract."""

    response.headers["X-OneHealth-Cache"] = snapshot.metadata.cache_state
    response.headers["X-OneHealth-Data-Loaded-At"] = snapshot.metadata.loaded_at


def _data_trust_detail(disease_code: str, response: Response) -> dict:
    snapshot = _records_snapshot()
    _expose_snapshot_headers(response, snapshot)
    try:
        return build_data_trust_detail(snapshot.value, disease_code)
    except UnknownDiseaseError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


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


@app.get("/api/v1/data-trust")
def data_trust_catalog(response: Response) -> list[dict]:
    """Return evidence, coverage, freshness, and quality for every programme."""

    snapshot = _records_snapshot()
    _expose_snapshot_headers(response, snapshot)
    return build_data_trust_catalog(snapshot.value)


@app.get("/api/v1/data-trust/cache/status")
def data_trust_cache_status() -> dict:
    """Report snapshot delivery health without exposing backend credentials/errors."""

    metadata = _record_snapshots.metadata(_record_cache_key())
    if metadata is None:
        return {
            "backend": os.environ.get("ONEHEALTH_BACKEND", "csv").strip().lower(),
            "cache_state": "EMPTY",
            "loaded_at": None,
            "age_seconds": None,
            "ttl_seconds": _cache_seconds("ONEHEALTH_CACHE_TTL_SECONDS", 300),
            "stale_if_error_seconds": _cache_seconds(
                "ONEHEALTH_CACHE_STALE_IF_ERROR_SECONDS", 86_400
            ),
            "degraded": False,
        }
    return {
        "backend": os.environ.get("ONEHEALTH_BACKEND", "csv").strip().lower(),
        "cache_state": metadata.cache_state,
        "loaded_at": metadata.loaded_at,
        "age_seconds": metadata.age_seconds,
        "ttl_seconds": metadata.ttl_seconds,
        "stale_if_error_seconds": metadata.stale_if_error_seconds,
        "degraded": metadata.cache_state == "STALE",
    }


@app.post("/api/v1/data-trust/cache/invalidate")
def invalidate_data_trust_cache(_user: User = Depends(admin)) -> dict:
    """Clear process-local snapshots so the next request refreshes DHIS2 data."""

    cleared = _record_snapshots.clear()
    return {"status": "invalidated", "entries_cleared": cleared}


@app.get("/api/v1/data-trust/{disease_code}")
def data_trust_detail(disease_code: str, response: Response) -> dict:
    return _data_trust_detail(disease_code, response)


@app.get("/api/v1/data-trust/{disease_code}/coverage")
def data_trust_coverage(disease_code: str, response: Response) -> dict:
    return _data_trust_detail(disease_code, response)["coverage"]


@app.get("/api/v1/data-trust/{disease_code}/freshness")
def data_trust_freshness(disease_code: str, response: Response) -> dict:
    return _data_trust_detail(disease_code, response)["freshness"]


@app.get("/api/v1/data-trust/{disease_code}/provenance")
def data_trust_provenance(disease_code: str, response: Response) -> dict:
    return _data_trust_detail(disease_code, response)["provenance"]


@app.get("/api/v1/data-trust/{disease_code}/quality")
def data_trust_quality(disease_code: str, response: Response) -> dict:
    return _data_trust_detail(disease_code, response)["quality"]


@app.get("/api/v1/environment/districts")
def environment_districts(response: Response) -> list[dict]:
    """Return the per-district climate summary for all 64 districts."""

    snapshot = _environment_snapshot()
    _expose_snapshot_headers(response, snapshot)
    _monthly, summary = snapshot.value
    return [asdict(row) for row in summary]


@app.get("/api/v1/environment/districts/{location_code}")
def environment_district(location_code: str, response: Response) -> dict:
    snapshot = _environment_snapshot()
    _expose_snapshot_headers(response, snapshot)
    _monthly, summary = snapshot.value
    normalized_code = location_code.strip().upper()
    for row in summary:
        if row.location_code == normalized_code:
            return asdict(row)
    raise HTTPException(status_code=404, detail=f"Unknown district location code: {location_code}")


@app.get("/api/v1/environment/districts/{location_code}/monthly")
def environment_district_monthly(
    location_code: str,
    response: Response,
    limit: int = Query(default=60, ge=1, le=120),
) -> list[dict]:
    snapshot = _environment_snapshot()
    _expose_snapshot_headers(response, snapshot)
    monthly, _summary = snapshot.value
    normalized_code = location_code.strip().upper()
    selected = [row for row in monthly if row.location_code == normalized_code]
    if not selected:
        raise HTTPException(status_code=404, detail=f"Unknown district location code: {location_code}")
    selected.sort(key=lambda row: row.period_start)
    return [asdict(row) for row in selected[-limit:]]


@app.get("/api/v1/environment/data-trust")
def environment_data_trust(response: Response) -> dict:
    """Return evidence, coverage, freshness, and quality for the environment dataset."""

    snapshot = _environment_snapshot()
    _expose_snapshot_headers(response, snapshot)
    monthly, summary = snapshot.value
    registry = load_environment_registry()
    return build_environment_trust_report(monthly, summary, registry)


@app.get("/api/v1/environment/awd-correlation")
def environment_awd_correlation(response: Response) -> dict:
    """Exploratory AWD-climate correlation analysis.

    Ecological-level (division-year), not causal -- see the report's own
    "limitations" and "disclaimer" fields, always returned alongside the
    numbers rather than in separate documentation only.
    """

    snapshot = _awd_correlation_snapshot()
    _expose_snapshot_headers(response, snapshot)
    return snapshot.value


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
        "total_deaths": sum(record.deaths or 0 for record in selected),
        "latest_period": latest.period_label,
        "latest_cases": latest.cases,
        "latest_deaths": latest.deaths,
        "risk_level": alert.risk_level if alert else None,
    }


@app.get("/api/v1/overview/{disease_code}")
def overview(disease_code: str, complete_only: bool = True) -> list[dict]:
    disease_records = [
        record
        for record in _records()
        if record.disease_code == disease_code.upper()
        and (record.complete_period or not complete_only)
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
                "total_deaths": sum(record.deaths or 0 for record in records),
                "latest_period": latest.period_label,
                "latest_cases": latest.cases,
                "latest_deaths": latest.deaths,
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


class EBSAssignmentRequest(BaseModel):
    responsible_officer: str = Field(min_length=2, max_length=150)
    due_date: date
    recommended_actions: str = Field(min_length=3, max_length=2000)
    response_status: str = Field(default="PLANNED", pattern="^(PLANNED|IN_PROGRESS|COMPLETED|ON_HOLD)$")


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
    _user: User = Depends(viewer),
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


def _operation_rows() -> list[dict]:
    if os.environ.get("ONEHEALTH_EBS_READS_ENABLED", "false").lower() != "true":
        raise HTTPException(status_code=403, detail="EBS registry reads are disabled")
    try:
        _, client = _settings_and_client()
        with client:
            entity_response = client.get_tracked_entities(
                program=EBS_PROGRAM_UID, page=1, page_size=100
            )
            rows = []
            for entity in _tracker_items(entity_response, "trackedEntities"):
                tracked_entity_uid = entity.get("trackedEntity")
                event_response = client.get_tracker_events(
                    tracked_entity_uid=tracked_entity_uid,
                    program=EBS_PROGRAM_UID,
                )
                events = [
                    _event_view(event)
                    for event in _tracker_items(event_response, "events")
                ]
                attributes = _attribute_values(entity)
                rows.append(build_operation_item(entity, attributes, events, today=date.today()))
    except (ValueError, OSError, DHIS2APIError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    rows.sort(key=lambda row: (row["closed"], not row["overdue"], row["due_date"] or "9999", row["signal_id"]))
    return rows


@app.get("/api/v1/ebs/operations")
def ebs_operations(
    status: str = Query(default="ALL", pattern="^(ALL|OPEN|OVERDUE|DUE_SOON|UNASSIGNED|CLOSED)$"),
    officer: str | None = Query(default=None, max_length=150),
    _user: User = Depends(viewer),
) -> dict:
    all_rows = _operation_rows()
    rows = all_rows
    if status == "OPEN":
        rows = [row for row in rows if not row["closed"]]
    elif status == "OVERDUE":
        rows = [row for row in rows if row["overdue"]]
    elif status == "DUE_SOON":
        rows = [row for row in rows if row["due_state"] in {"DUE_TODAY", "DUE_SOON"}]
    elif status == "UNASSIGNED":
        rows = [row for row in rows if not row["closed"] and not row["responsible_officer"]]
    elif status == "CLOSED":
        rows = [row for row in rows if row["closed"]]
    if officer:
        rows = [row for row in rows if (row["responsible_officer"] or "").casefold() == officer.casefold()]
    return {
        "signals": rows,
        "summary": operation_summary(all_rows),
        "filtered_count": len(rows),
        "generated_at": date.today().isoformat(),
    }


@app.get("/api/v1/ebs/notifications")
def ebs_notifications(_user: User = Depends(viewer)) -> dict:
    notifications = build_notifications(_operation_rows(), today=date.today())
    return {
        "notifications": notifications,
        "unread_count": len(notifications),
        "generated_at": date.today().isoformat(),
    }


@app.post("/api/v1/ebs/operations/{tracked_entity_uid}/assignment")
def assign_ebs_operation(
    tracked_entity_uid: str,
    request: EBSAssignmentRequest,
    _user: User = Depends(responder),
) -> dict:
    if os.environ.get("ONEHEALTH_EBS_WRITES_ENABLED", "false").lower() != "true":
        raise HTTPException(status_code=403, detail="EBS writes are disabled")
    if request.due_date < date.today() and request.response_status != "COMPLETED":
        raise HTTPException(status_code=422, detail="Due date cannot be in the past for an active response")
    try:
        _, client = _settings_and_client()
        with client:
            entity = client.get_tracked_entity(tracked_entity_uid)
            enrollments = entity.get("enrollments") or []
            if not enrollments:
                raise HTTPException(status_code=409, detail="Signal has no active DHIS2 enrollment")
            bundle = build_stage_event(
                stage="response",
                enrollment_uid=enrollments[0]["enrollment"],
                org_unit_uid=entity["orgUnit"],
                occurred_on=date.today(),
                values={
                    "recommended_actions": request.recommended_actions,
                    "responsible_officer": request.responsible_officer,
                    "due_date": request.due_date.isoformat(),
                    "response_status": request.response_status,
                },
            )
            result = client.import_tracker_bundle(bundle)
    except HTTPException:
        raise
    except (ValueError, OSError, KeyError, DHIS2APIError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "mode": "COMMITTED",
        "tracked_entity_uid": tracked_entity_uid,
        "event_uid": bundle["events"][0]["event"],
        "officer": request.responsible_officer,
        "due_date": request.due_date.isoformat(),
        "response": result,
    }


@app.get("/api/v1/ebs/reports/situation.csv")
def ebs_situation_report(_user: User = Depends(viewer)) -> Response:
    rows = _operation_rows()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Signal ID", "Title", "Source", "Stage", "Risk", "Officer", "Due date", "Due state", "Response status", "Recommended actions", "Closed", "Updated at"])
    for row in rows:
        writer.writerow([
            row["signal_id"], row["title"], row["source"], row["latest_stage"],
            row["risk_level"], row["responsible_officer"], row["due_date"],
            row["due_state"], row["response_status"], row["recommended_actions"],
            row["closed"], row["updated_at"],
        ])
    filename = f"onehealth-ebs-situation-{date.today().isoformat()}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/v1/ebs/signals/{tracked_entity_uid}")
def get_ebs_signal(tracked_entity_uid: str, _user: User = Depends(viewer)) -> dict:
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
def submit_ebs_signal(request: EBSSignalRequest, _user: User = Depends(responder)) -> dict:
    if os.environ.get("ONEHEALTH_EBS_WRITES_ENABLED", "false").lower() != "true":
        raise HTTPException(
            status_code=403,
            detail="EBS writes are disabled. Preview the signal or explicitly enable live writes.",
        )
    try:
        settings = DHIS2Settings.from_env()
        bundle = _ebs_signal_bundle(request)
        with DHIS2Client(
            settings.base_url,
            api_token=settings.api_token,
            username=settings.username,
            password=settings.password,
            verify_ssl=settings.verify_ssl,
            timeout_seconds=settings.timeout_seconds,
        ) as client:
            response = client.import_tracker_bundle(bundle)
    except (ValueError, OSError, DHIS2APIError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "mode": "COMMITTED",
        "tracked_entity_uid": bundle["trackedEntities"][0]["trackedEntity"],
        "enrollment_uid": bundle["enrollments"][0]["enrollment"],
        "event_uid": bundle["events"][0]["event"],
        "response": response,
    }


@app.post("/api/v1/ebs/stages")
def submit_ebs_stage(request: EBSStageRequest, _user: User = Depends(responder)) -> dict:
    if os.environ.get("ONEHEALTH_EBS_WRITES_ENABLED", "false").lower() != "true":
        raise HTTPException(
            status_code=403,
            detail="EBS writes are disabled. Preview the stage or explicitly enable live writes.",
        )
    try:
        settings = DHIS2Settings.from_env()
        bundle = _ebs_stage_bundle(request)
        with DHIS2Client(
            settings.base_url,
            api_token=settings.api_token,
            username=settings.username,
            password=settings.password,
            verify_ssl=settings.verify_ssl,
            timeout_seconds=settings.timeout_seconds,
        ) as client:
            response = client.import_tracker_bundle(bundle)
    except (ValueError, OSError, DHIS2APIError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "mode": "COMMITTED",
        "stage": request.stage,
        "enrollment_uid": request.enrollment_uid,
        "event_uid": bundle["events"][0]["event"],
        "response": response,
    }
