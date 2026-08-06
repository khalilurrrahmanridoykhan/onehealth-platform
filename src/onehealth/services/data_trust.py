"""Evidence provenance, coverage, freshness, and quality reporting.

The trust report deliberately derives record-level facts from normalized
``SurveillanceRecord`` objects. The registry supplies only programme semantics
and explicitly declared capabilities; it is not a second source of case data.
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterable, Mapping
from datetime import date
from pathlib import Path
from typing import Any

from onehealth.models import SurveillanceRecord


PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _default_registry_path() -> Path:
    configured = os.environ.get("ONEHEALTH_EVIDENCE_REGISTRY_PATH", "").strip()
    if configured:
        return Path(configured)
    source_tree_path = PROJECT_ROOT / "data" / "evidence_registry.json"
    container_path = Path.cwd() / "data" / "evidence_registry.json"
    return source_tree_path if source_tree_path.is_file() else container_path


DEFAULT_EVIDENCE_REGISTRY_PATH = _default_registry_path()
QUALITY_STATUSES = {"PASS", "WARNING", "FAIL"}
FRESHNESS_MODES = {"operational", "historical"}
CAPABILITY_KEYS = {"alerts", "forecast", "automated_refresh", "district_data"}


class EvidenceRegistryError(ValueError):
    """Raised when the evidence registry is missing or structurally invalid."""


class UnknownDiseaseError(LookupError):
    """Raised when a disease code is absent from the evidence registry."""


def load_evidence_registry(
    path: Path = DEFAULT_EVIDENCE_REGISTRY_PATH,
) -> dict[str, dict[str, Any]]:
    """Load and validate programme declarations, keyed by disease code."""
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise EvidenceRegistryError(f"Could not load evidence registry: {path}") from exc

    if payload.get("schema_version") != 1 or not isinstance(payload.get("diseases"), list):
        raise EvidenceRegistryError("Evidence registry must use schema_version 1")

    repository_url = payload.get("repository_url")
    if not isinstance(repository_url, str) or not repository_url:
        raise EvidenceRegistryError("Evidence registry repository_url is required")

    registry: dict[str, dict[str, Any]] = {}
    required = {
        "disease_code",
        "disease_name",
        "metric",
        "evidence_type",
        "freshness_mode",
        "expected_update_days",
        "expected_location_codes",
        "allowed_data_statuses",
        "license",
        "doi",
        "capabilities",
        "limitations",
    }
    for raw_entry in payload["diseases"]:
        if not isinstance(raw_entry, dict) or not required.issubset(raw_entry):
            raise EvidenceRegistryError("Every disease declaration must contain all required fields")
        entry = dict(raw_entry)
        code = entry["disease_code"]
        if not isinstance(code, str) or not code or code != code.upper():
            raise EvidenceRegistryError("Disease codes must be non-empty uppercase strings")
        if code in registry:
            raise EvidenceRegistryError(f"Duplicate evidence declaration: {code}")
        metric = entry["metric"]
        if not isinstance(metric, dict) or set(metric) != {"label", "unit"}:
            raise EvidenceRegistryError(f"{code} metric must contain label and unit")
        if entry["freshness_mode"] not in FRESHNESS_MODES:
            raise EvidenceRegistryError(f"{code} has an invalid freshness_mode")
        expected_days = entry["expected_update_days"]
        if expected_days is not None and (
            not isinstance(expected_days, int) or isinstance(expected_days, bool) or expected_days <= 0
        ):
            raise EvidenceRegistryError(f"{code} expected_update_days must be positive or null")
        if entry["freshness_mode"] == "historical" and expected_days is not None:
            raise EvidenceRegistryError(f"{code} historical evidence cannot have an update interval")
        if set(entry["capabilities"]) != CAPABILITY_KEYS or not all(
            isinstance(value, bool) for value in entry["capabilities"].values()
        ):
            raise EvidenceRegistryError(f"{code} capabilities must contain four boolean flags")
        if not entry["expected_location_codes"] or not all(
            isinstance(value, str) and value for value in entry["expected_location_codes"]
        ):
            raise EvidenceRegistryError(f"{code} expected_location_codes must be non-empty")
        if not entry["allowed_data_statuses"] or not all(
            isinstance(value, str) and value for value in entry["allowed_data_statuses"]
        ):
            raise EvidenceRegistryError(f"{code} allowed_data_statuses must be non-empty")
        if not isinstance(entry["limitations"], list) or not all(
            isinstance(value, str) and value for value in entry["limitations"]
        ):
            raise EvidenceRegistryError(f"{code} limitations must be a list of text values")
        entry["repository_url"] = repository_url
        registry[code] = entry
    return registry


def _check(code: str, status: str, message: str) -> dict[str, str]:
    if status not in QUALITY_STATUSES:  # pragma: no cover - internal invariant
        raise ValueError(f"Invalid quality status: {status}")
    return {"code": code, "status": status, "message": message}


def _coverage(records: list[SurveillanceRecord]) -> dict[str, Any]:
    return {
        "start_date": min((record.period_start for record in records), default=None).isoformat()
        if records
        else None,
        "end_date": max((record.period_end for record in records), default=None).isoformat()
        if records
        else None,
        "record_count": len(records),
        "location_count": len({record.location_code for record in records}),
        "location_levels": sorted({record.location_level for record in records}),
        "period_types": sorted({record.period_type for record in records}),
        "complete_periods": sum(record.complete_period for record in records),
        "partial_periods": sum(not record.complete_period for record in records),
    }


def _freshness(
    records: list[SurveillanceRecord], declaration: Mapping[str, Any], as_of: date
) -> dict[str, Any]:
    latest = max((record.period_end for record in records), default=None)
    age_days = (as_of - latest).days if latest is not None else None
    expected_days = declaration["expected_update_days"]
    if latest is None:
        status = "UNKNOWN"
    elif declaration["freshness_mode"] == "historical":
        status = "HISTORICAL"
    elif expected_days is None:
        status = "UNKNOWN"
    else:
        status = "CURRENT" if age_days is not None and age_days <= expected_days else "STALE"
    return {
        "status": status,
        "latest_period_end": latest.isoformat() if latest is not None else None,
        "age_days": age_days,
        "expected_update_days": expected_days,
        "as_of": as_of.isoformat(),
    }


def _provenance(
    records: list[SurveillanceRecord], declaration: Mapping[str, Any]
) -> dict[str, Any]:
    sources = sorted(
        {
            (record.source_name, record.source_url)
            for record in records
            if record.source_name or record.source_url
        }
    )
    return {
        "sources": [{"name": name, "url": url} for name, url in sources],
        "license": declaration["license"],
        "repository_url": declaration["repository_url"],
        "doi": declaration["doi"],
    }


def _quality(
    records: list[SurveillanceRecord], declaration: Mapping[str, Any], as_of: date
) -> dict[str, Any]:
    code = declaration["disease_code"]
    checks: list[dict[str, str]] = []

    checks.append(
        _check(
            "records_present",
            "PASS" if records else "FAIL",
            f"{len(records)} normalized records are available."
            if records
            else "No normalized records are available.",
        )
    )

    identity_errors = sum(
        record.disease_code != code or record.disease_name != declaration["disease_name"]
        for record in records
    )
    checks.append(
        _check(
            "disease_identity",
            "PASS" if identity_errors == 0 else "FAIL",
            "All record disease identifiers match the evidence declaration."
            if identity_errors == 0
            else f"{identity_errors} records have mismatched disease identifiers.",
        )
    )

    invalid_periods = sum(record.period_start > record.period_end for record in records)
    checks.append(
        _check(
            "period_ranges",
            "PASS" if invalid_periods == 0 else "FAIL",
            "All reporting period ranges are valid."
            if invalid_periods == 0
            else f"{invalid_periods} records have a start date after the end date.",
        )
    )

    invalid_values = sum(
        record.cases < 0
        or (record.deaths is not None and record.deaths < 0)
        or (record.population is not None and record.population <= 0)
        or (record.incidence_per_100k is not None and record.incidence_per_100k < 0)
        for record in records
    )
    checks.append(
        _check(
            "nonnegative_values",
            "PASS" if invalid_values == 0 else "FAIL",
            "All counts, denominators, and rates are within allowed ranges."
            if invalid_values == 0
            else f"{invalid_values} records contain invalid negative values or denominators.",
        )
    )

    keys = [
        (record.period_start, record.period_end, record.location_code, record.period_type)
        for record in records
    ]
    duplicate_count = len(keys) - len(set(keys))
    checks.append(
        _check(
            "duplicate_records",
            "PASS" if duplicate_count == 0 else "FAIL",
            "No duplicate period-location records were found."
            if duplicate_count == 0
            else f"{duplicate_count} duplicate period-location records were found.",
        )
    )

    missing_provenance = sum(not record.source_name or not record.source_url for record in records)
    checks.append(
        _check(
            "source_provenance",
            "PASS" if missing_provenance == 0 else "FAIL",
            "Every record names and links its source."
            if missing_provenance == 0
            else f"{missing_provenance} records are missing a source name or URL.",
        )
    )

    allowed_statuses = set(declaration["allowed_data_statuses"])
    unexpected_statuses = sorted({record.data_status for record in records} - allowed_statuses)
    checks.append(
        _check(
            "evidence_semantics",
            "PASS" if not unexpected_statuses else "FAIL",
            "All data-status values preserve the declared evidence semantics."
            if not unexpected_statuses
            else "Unexpected data-status values: " + ", ".join(unexpected_statuses) + ".",
        )
    )

    partial_count = sum(not record.complete_period for record in records)
    checks.append(
        _check(
            "period_completeness",
            "PASS" if partial_count == 0 else "WARNING",
            "All normalized records represent complete source periods."
            if partial_count == 0
            else f"{partial_count} partial-period records are retained and must be excluded from alerts.",
        )
    )

    observed_locations = {record.location_code for record in records}
    missing_locations = sorted(set(declaration["expected_location_codes"]) - observed_locations)
    checks.append(
        _check(
            "declared_location_coverage",
            "PASS" if not missing_locations else "WARNING",
            "All locations declared for this evidence source are represented."
            if not missing_locations
            else "No records are available for declared locations: " + ", ".join(missing_locations) + ".",
        )
    )

    future_periods = sum(record.period_end > as_of for record in records)
    checks.append(
        _check(
            "future_periods",
            "PASS" if future_periods == 0 else "WARNING",
            "No reporting period ends after the assessment date."
            if future_periods == 0
            else f"{future_periods} reporting periods end after the assessment date.",
        )
    )

    statuses = {check["status"] for check in checks}
    status = "FAIL" if "FAIL" in statuses else "WARNING" if "WARNING" in statuses else "PASS"
    return {
        "status": status,
        "checks": checks,
        "issue_count": sum(check["status"] != "PASS" for check in checks),
    }


def build_data_trust_detail(
    records: Iterable[SurveillanceRecord],
    disease_code: str,
    *,
    as_of: date | None = None,
    registry: Mapping[str, Mapping[str, Any]] | None = None,
    registry_path: Path = DEFAULT_EVIDENCE_REGISTRY_PATH,
) -> dict[str, Any]:
    """Build a JSON-serializable trust detail for one declared programme."""
    normalized_code = disease_code.strip().upper()
    declarations = registry if registry is not None else load_evidence_registry(registry_path)
    try:
        declaration = declarations[normalized_code]
    except KeyError as exc:
        raise UnknownDiseaseError(f"Unknown disease code: {normalized_code}") from exc

    assessment_date = as_of or date.today()
    disease_records = [
        record for record in records if record.disease_code.upper() == normalized_code
    ]
    return {
        "disease_code": declaration["disease_code"],
        "disease_name": declaration["disease_name"],
        "metric": dict(declaration["metric"]),
        "evidence_type": declaration["evidence_type"],
        "coverage": _coverage(disease_records),
        "freshness": _freshness(disease_records, declaration, assessment_date),
        "provenance": _provenance(disease_records, declaration),
        "quality": _quality(disease_records, declaration, assessment_date),
        "capabilities": dict(declaration["capabilities"]),
        "limitations": list(declaration["limitations"]),
    }


def build_data_trust_catalog(
    records: Iterable[SurveillanceRecord],
    *,
    as_of: date | None = None,
    registry_path: Path = DEFAULT_EVIDENCE_REGISTRY_PATH,
) -> list[dict[str, Any]]:
    """Build trust details for every declared programme, including missing data."""
    all_records = list(records)
    registry = load_evidence_registry(registry_path)
    return [
        build_data_trust_detail(
            all_records, code, as_of=as_of, registry=registry, registry_path=registry_path
        )
        for code in registry
    ]
