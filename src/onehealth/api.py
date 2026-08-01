import os
from dataclasses import asdict
from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query

from onehealth import __version__
from onehealth.config import DEFAULT_DATA_PATH, DHIS2Settings
from onehealth.dhis2 import DHIS2APIError, DHIS2Client, DHIS2Mapping
from onehealth.dhis2.sync import records_from_dhis2
from onehealth.services.alerts import generate_latest_alert
from onehealth.services.surveillance import load_surveillance_records


app = FastAPI(
    title="OneHealth Intelligence Platform API",
    version=__version__,
    description="Disease surveillance trends and explainable early-warning alerts.",
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
