"""Evidence provenance, coverage, freshness, and quality reporting for the
read-only Environment (climate) module.

This is a parallel structure to services/data_trust.py, not an extension of
it: climate metrics are not case-count data (temperature can legitimately be
negative), and the environment registry describes one dataset, not a list of
diseases, so it is not wired into load_evidence_registry() or the diseases
catalog.
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterable, Mapping
from datetime import date
from pathlib import Path
from typing import Any

from onehealth.models import EnvironmentDistrictSummary, EnvironmentMonthlyRecord


PROJECT_ROOT = Path(__file__).resolve().parents[3]

QUALITY_STATUSES = {"PASS", "WARNING", "FAIL"}
CAPABILITY_KEYS = {"alerts", "forecast", "automated_refresh", "district_data", "disease_correlation"}

# Crosswalk entries whose source district name was ambiguous and resolved by
# best-effort judgement rather than an authoritative source. Surfaced as a
# standing WARNING rather than silently passing quality checks.
UNVERIFIED_LOCATION_CODES = {"BD-D-CHAPAINAWABGANJ"}


class EnvironmentRegistryError(ValueError):
    """Raised when the environment registry is missing or structurally invalid."""


def _default_registry_path() -> Path:
    configured = os.environ.get("ONEHEALTH_ENVIRONMENT_REGISTRY_PATH", "").strip()
    if configured:
        return Path(configured)
    source_tree_path = PROJECT_ROOT / "data" / "environment_registry.json"
    container_path = Path.cwd() / "data" / "environment_registry.json"
    return source_tree_path if source_tree_path.is_file() else container_path


DEFAULT_ENVIRONMENT_REGISTRY_PATH = _default_registry_path()


def load_environment_registry(
    path: Path = DEFAULT_ENVIRONMENT_REGISTRY_PATH,
) -> dict[str, Any]:
    """Load and validate the single environment dataset declaration."""
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise EnvironmentRegistryError(f"Could not load environment registry: {path}") from exc

    if payload.get("schema_version") != 1 or not isinstance(payload.get("environment"), dict):
        raise EnvironmentRegistryError("Environment registry must use schema_version 1")

    repository_url = payload.get("repository_url")
    if not isinstance(repository_url, str) or not repository_url:
        raise EnvironmentRegistryError("Environment registry repository_url is required")

    entry = dict(payload["environment"])
    required = {
        "metric", "evidence_type", "freshness_mode", "expected_update_days",
        "expected_location_codes", "allowed_data_statuses", "license", "doi",
        "sources", "capabilities", "limitations",
    }
    if not required.issubset(entry):
        raise EnvironmentRegistryError("Environment declaration is missing required fields")

    metric = entry["metric"]
    if not isinstance(metric, dict) or set(metric) != {"label", "unit"}:
        raise EnvironmentRegistryError("Environment metric must contain label and unit")
    if set(entry["capabilities"]) != CAPABILITY_KEYS or not all(
        isinstance(value, bool) for value in entry["capabilities"].values()
    ):
        raise EnvironmentRegistryError("Environment capabilities must contain five boolean flags")
    if not entry["expected_location_codes"] or not all(
        isinstance(value, str) and value for value in entry["expected_location_codes"]
    ):
        raise EnvironmentRegistryError("Environment expected_location_codes must be non-empty")
    if not isinstance(entry["limitations"], list) or not all(
        isinstance(value, str) and value for value in entry["limitations"]
    ):
        raise EnvironmentRegistryError("Environment limitations must be a list of text values")

    entry["repository_url"] = repository_url
    return entry


def _check(code: str, status: str, message: str) -> dict[str, str]:
    if status not in QUALITY_STATUSES:  # pragma: no cover - internal invariant
        raise ValueError(f"Invalid quality status: {status}")
    return {"code": code, "status": status, "message": message}


def _coverage(monthly: list[EnvironmentMonthlyRecord], summary: list[EnvironmentDistrictSummary]) -> dict[str, Any]:
    return {
        "start_date": min((r.period_start for r in monthly), default=None) and min(r.period_start for r in monthly).isoformat(),
        "end_date": max((r.period_end for r in monthly), default=None) and max(r.period_end for r in monthly).isoformat(),
        "record_count": len(monthly),
        "location_count": len({r.location_code for r in summary}),
        "period_types": sorted({r.period_type for r in monthly}),
        "complete_periods": sum(r.complete_period for r in monthly),
        "partial_periods": sum(not r.complete_period for r in monthly),
    }


def _freshness(monthly: list[EnvironmentMonthlyRecord], declaration: Mapping[str, Any], as_of: date) -> dict[str, Any]:
    latest = max((r.period_end for r in monthly), default=None)
    age_days = (as_of - latest).days if latest is not None else None
    status = "HISTORICAL" if latest is not None else "UNKNOWN"
    return {
        "status": status,
        "latest_period_end": latest.isoformat() if latest is not None else None,
        "age_days": age_days,
        "expected_update_days": declaration["expected_update_days"],
        "as_of": as_of.isoformat(),
    }


def _provenance(declaration: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "sources": [dict(source) for source in declaration["sources"]],
        "license": declaration["license"],
        "repository_url": declaration["repository_url"],
        "doi": declaration["doi"],
    }


def _quality(
    monthly: list[EnvironmentMonthlyRecord],
    summary: list[EnvironmentDistrictSummary],
    declaration: Mapping[str, Any],
) -> dict[str, Any]:
    checks: list[dict[str, str]] = []

    checks.append(
        _check(
            "records_present",
            "PASS" if monthly and summary else "FAIL",
            f"{len(monthly)} monthly records and {len(summary)} district summaries are available."
            if monthly and summary
            else "No environment records are available.",
        )
    )

    observed_locations = {r.location_code for r in summary}
    missing_locations = sorted(set(declaration["expected_location_codes"]) - observed_locations)
    checks.append(
        _check(
            "declared_location_coverage",
            "PASS" if not missing_locations else "WARNING",
            "All 64 declared districts are represented."
            if not missing_locations
            else "No records for declared districts: " + ", ".join(missing_locations) + ".",
        )
    )

    all_months = {r.period_label for r in monthly}
    locations_with_gaps = sorted(
        {r.location_code for r in monthly}
        - {
            code
            for code in {r.location_code for r in monthly}
            if {r.period_label for r in monthly if r.location_code == code} == all_months
        }
    )
    checks.append(
        _check(
            "period_continuity",
            "PASS" if not locations_with_gaps else "WARNING",
            "Every district reports the same set of months."
            if not locations_with_gaps
            else f"{len(locations_with_gaps)} districts are missing one or more months present elsewhere.",
        )
    )

    invalid_values = sum(r.total_precip_mm < 0 or r.extreme_heat_days < 0 for r in monthly)
    invalid_values += sum(
        r.mean_annual_precip_mm < 0 or r.mean_annual_extreme_heat_days < 0 for r in summary
    )
    checks.append(
        _check(
            "nonnegative_precipitation_and_heat_days",
            "PASS" if invalid_values == 0 else "FAIL",
            "Precipitation and extreme-heat-day counts are within allowed ranges."
            if invalid_values == 0
            else f"{invalid_values} records contain a negative precipitation or heat-day value.",
        )
    )

    monthly_keys = [(r.location_code, r.period_label) for r in monthly]
    monthly_duplicates = len(monthly_keys) - len(set(monthly_keys))
    summary_locations = [r.location_code for r in summary]
    summary_duplicates = len(summary_locations) - len(set(summary_locations))
    duplicate_count = monthly_duplicates + summary_duplicates
    checks.append(
        _check(
            "duplicate_records",
            "PASS" if duplicate_count == 0 else "FAIL",
            "No duplicate district-period records were found."
            if duplicate_count == 0
            else f"{duplicate_count} duplicate district-period records were found.",
        )
    )

    missing_provenance = sum(not r.source_name or not r.source_url for r in monthly)
    missing_provenance += sum(not r.source_name or not r.source_url for r in summary)
    checks.append(
        _check(
            "source_provenance",
            "PASS" if missing_provenance == 0 else "FAIL",
            "Every record names and links its source."
            if missing_provenance == 0
            else f"{missing_provenance} records are missing a source name or URL.",
        )
    )

    unverified_present = sorted(observed_locations & UNVERIFIED_LOCATION_CODES)
    checks.append(
        _check(
            "unverified_crosswalk_entries",
            "PASS" if not unverified_present else "WARNING",
            "No district identifiers rely on an unverified name resolution."
            if not unverified_present
            else "These districts rely on an unverified crosswalk resolution and should be "
            "spot-checked: " + ", ".join(unverified_present) + ".",
        )
    )

    statuses = {check["status"] for check in checks}
    status = "FAIL" if "FAIL" in statuses else "WARNING" if "WARNING" in statuses else "PASS"
    return {
        "status": status,
        "checks": checks,
        "issue_count": sum(check["status"] != "PASS" for check in checks),
    }


def build_environment_trust_report(
    monthly: Iterable[EnvironmentMonthlyRecord],
    summary: Iterable[EnvironmentDistrictSummary],
    declaration: Mapping[str, Any],
    *,
    as_of: date | None = None,
) -> dict[str, Any]:
    """Build a JSON-serializable trust report for the environment dataset."""
    monthly_records = list(monthly)
    summary_records = list(summary)
    assessment_date = as_of or date.today()
    return {
        "metric": dict(declaration["metric"]),
        "evidence_type": declaration["evidence_type"],
        "coverage": _coverage(monthly_records, summary_records),
        "freshness": _freshness(monthly_records, declaration, assessment_date),
        "provenance": _provenance(declaration),
        "quality": _quality(monthly_records, summary_records, declaration),
        "capabilities": dict(declaration["capabilities"]),
        "limitations": list(declaration["limitations"]),
    }
