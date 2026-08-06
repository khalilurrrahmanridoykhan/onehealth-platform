"""Filesystem-backed review gate for normalized surveillance datasets.

The gate deliberately has no DHIS2 dependency.  It creates an immutable-in-
practice staging package, records deterministic quality findings, and requires
an explicit reviewer acknowledgement of the dataset SHA-256 before another
process may use the file for synchronization.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import re
import tempfile
import uuid
from dataclasses import asdict, dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from onehealth.services.ingestion import CSV_FIELDS


SCHEMA_VERSION = 1
AWAITING_REVIEW = "awaiting_review"
APPROVED = "approved"
DATA_FILENAME = "dataset.csv"
MANIFEST_FILENAME = "manifest.json"
QUALITY_REPORT_FILENAME = "quality-report.json"
APPROVAL_FILENAME = "approval.json"

ALLOWED_PERIOD_TYPES = {"daily", "weekly", "monthly", "six_monthly", "annual"}
ALLOWED_LOCATION_LEVELS = {"national", "division", "district", "upazila"}
BOOLEAN_VALUES = {"true", "false"}
CODE_PATTERN = re.compile(r"^[A-Z][A-Z0-9_-]*$")


class IngestionGateError(ValueError):
    """Raised when a staging package is invalid or not approved."""


@dataclass(frozen=True, slots=True)
class QualityIssue:
    code: str
    message: str
    severity: str
    line: int | None = None
    field: str | None = None


@dataclass(frozen=True, slots=True)
class QualityReport:
    schema_version: int
    checked_at: str
    passed: bool
    row_count: int
    error_count: int
    warning_count: int
    disease_codes: tuple[str, ...]
    location_levels: tuple[str, ...]
    period_start: str | None
    period_end: str | None
    incomplete_period_count: int
    issues: tuple[QualityIssue, ...]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class StagedDataset:
    package_id: str
    package_path: Path
    dataset_path: Path
    sha256: str
    status: str
    quality_report: QualityReport


@dataclass(frozen=True, slots=True)
class ApprovedDataset:
    package_id: str
    package_path: Path
    dataset_path: Path
    sha256: str
    reviewer: str
    approved_at: str


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _issue(
    issues: list[QualityIssue],
    code: str,
    message: str,
    *,
    severity: str = "error",
    line: int | None = None,
    field: str | None = None,
) -> None:
    issues.append(
        QualityIssue(
            code=code,
            message=message,
            severity=severity,
            line=line,
            field=field,
        )
    )


def _parse_date(
    value: str, field: str, line: int, issues: list[QualityIssue]
) -> date | None:
    try:
        return date.fromisoformat(value)
    except ValueError:
        _issue(
            issues,
            "invalid_date",
            f"{field} must use ISO YYYY-MM-DD format",
            line=line,
            field=field,
        )
        return None


def _parse_non_negative_number(
    value: str,
    field: str,
    line: int,
    issues: list[QualityIssue],
    *,
    integer: bool,
    optional: bool,
) -> int | float | None:
    if value == "":
        if not optional:
            _issue(
                issues,
                "missing_value",
                f"{field} is required",
                line=line,
                field=field,
            )
        return None
    try:
        number = int(value) if integer else float(value)
    except ValueError:
        _issue(
            issues,
            "invalid_number",
            f"{field} must be a {'whole number' if integer else 'number'}",
            line=line,
            field=field,
        )
        return None
    if number < 0 or (field == "population" and number == 0):
        constraint = "greater than zero" if field == "population" else "zero or greater"
        _issue(
            issues,
            "number_out_of_range",
            f"{field} must be {constraint}",
            line=line,
            field=field,
        )
    return number


def _validate_period(
    row: dict[str, str],
    start: date | None,
    end: date | None,
    complete_period: bool,
    line: int,
    issues: list[QualityIssue],
) -> None:
    if start and end and end < start:
        _issue(
            issues,
            "invalid_period_bounds",
            "period_end cannot be before period_start",
            line=line,
            field="period_end",
        )
        return

    period_type = row["period_type"].strip().lower()
    expected_days = {"daily": 0, "weekly": 6}
    if start and end and period_type in expected_days:
        actual_days = (end - start).days
        if actual_days != expected_days[period_type]:
            _issue(
                issues,
                "period_length_mismatch",
                f"{period_type} period must span {expected_days[period_type] + 1} day(s)",
                line=line,
                field="period_end",
            )
    if start and end and period_type == "annual" and complete_period:
        if start != date(start.year, 1, 1) or end != date(start.year, 12, 31):
            _issue(
                issues,
                "period_length_mismatch",
                "annual period must cover the complete calendar year",
                line=line,
                field="period_end",
            )


def assess_normalized_csv(content: bytes) -> QualityReport:
    """Return a deterministic quality report without modifying any files."""

    issues: list[QualityIssue] = []
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        _issue(issues, "invalid_encoding", "CSV must be UTF-8 encoded")
        return _quality_report(issues=issues)

    reader = csv.DictReader(io.StringIO(text, newline=""))
    headers = reader.fieldnames
    if not headers:
        _issue(issues, "missing_header", "CSV header is required")
        return _quality_report(issues=issues)
    if len(headers) != len(set(headers)):
        _issue(issues, "duplicate_header", "CSV contains duplicate column names")

    missing = [field for field in CSV_FIELDS if field not in headers]
    unexpected = [field for field in headers if field not in CSV_FIELDS]
    if missing:
        _issue(
            issues,
            "missing_columns",
            f"Missing required columns: {', '.join(missing)}",
        )
    if unexpected:
        _issue(
            issues,
            "unexpected_columns",
            "Unexpected columns are blocked to reduce accidental disclosure: "
            + ", ".join(unexpected),
        )
    if missing or unexpected or len(headers) != len(set(headers)):
        return _quality_report(issues=issues)

    row_count = 0
    disease_codes: set[str] = set()
    disease_names: dict[str, str] = {}
    location_levels: set[str] = set()
    dates: list[date] = []
    incomplete_period_count = 0
    seen: set[tuple[str, str, str]] = set()
    required_text = (
        "disease_code",
        "disease_name",
        "period_type",
        "period_label",
        "location_code",
        "location_name",
        "location_level",
        "data_status",
        "source_name",
        "source_url",
    )

    for line, raw_row in enumerate(reader, start=2):
        row_count += 1
        row = {field: (raw_row.get(field) or "").strip() for field in CSV_FIELDS}
        for field in required_text:
            if not row[field]:
                _issue(
                    issues,
                    "missing_value",
                    f"{field} is required",
                    line=line,
                    field=field,
                )

        disease_code = row["disease_code"]
        if disease_code:
            disease_codes.add(disease_code)
            if not CODE_PATTERN.fullmatch(disease_code):
                _issue(
                    issues,
                    "invalid_disease_code",
                    "disease_code must be an uppercase stable identifier",
                    line=line,
                    field="disease_code",
                )
            previous_name = disease_names.setdefault(disease_code, row["disease_name"])
            if previous_name != row["disease_name"]:
                _issue(
                    issues,
                    "inconsistent_disease_name",
                    f"{disease_code} is associated with multiple disease names",
                    line=line,
                    field="disease_name",
                )

        period_type = row["period_type"].lower()
        if period_type and period_type not in ALLOWED_PERIOD_TYPES:
            _issue(
                issues,
                "invalid_period_type",
                f"period_type must be one of {', '.join(sorted(ALLOWED_PERIOD_TYPES))}",
                line=line,
                field="period_type",
            )
        location_level = row["location_level"].lower()
        if location_level:
            location_levels.add(location_level)
            if location_level not in ALLOWED_LOCATION_LEVELS:
                _issue(
                    issues,
                    "invalid_location_level",
                    "location_level must be one of "
                    + ", ".join(sorted(ALLOWED_LOCATION_LEVELS)),
                    line=line,
                    field="location_level",
                )

        complete = row["complete_period"].lower()
        if complete not in BOOLEAN_VALUES:
            _issue(
                issues,
                "invalid_boolean",
                "complete_period must be True or False",
                line=line,
                field="complete_period",
            )
        elif complete == "false":
            incomplete_period_count += 1

        start = _parse_date(row["period_start"], "period_start", line, issues)
        end = _parse_date(row["period_end"], "period_end", line, issues)
        if start:
            dates.append(start)
        if end:
            dates.append(end)
        _validate_period(row, start, end, complete == "true", line, issues)

        _parse_non_negative_number(
            row["cases"], "cases", line, issues, integer=True, optional=False
        )
        _parse_non_negative_number(
            row["deaths"], "deaths", line, issues, integer=True, optional=True
        )
        _parse_non_negative_number(
            row["population"], "population", line, issues, integer=True, optional=True
        )
        _parse_non_negative_number(
            row["incidence_per_100k"],
            "incidence_per_100k",
            line,
            issues,
            integer=False,
            optional=True,
        )

        source_url = row["source_url"]
        parsed_url = urlparse(source_url)
        if source_url and not (parsed_url.scheme in {"http", "https"} and parsed_url.netloc):
            _issue(
                issues,
                "invalid_source_url",
                "source_url must be an absolute HTTP(S) URL",
                line=line,
                field="source_url",
            )

        key = (disease_code, row["location_code"], row["period_label"])
        if all(key):
            if key in seen:
                _issue(
                    issues,
                    "duplicate_record",
                    f"Duplicate disease/location/period key: {' / '.join(key)}",
                    line=line,
                )
            seen.add(key)

    if row_count == 0:
        _issue(issues, "empty_dataset", "CSV must contain at least one data row")

    return _quality_report(
        issues=issues,
        row_count=row_count,
        disease_codes=disease_codes,
        location_levels=location_levels,
        dates=dates,
        incomplete_period_count=incomplete_period_count,
    )


def _quality_report(
    *,
    issues: list[QualityIssue],
    row_count: int = 0,
    disease_codes: set[str] | None = None,
    location_levels: set[str] | None = None,
    dates: list[date] | None = None,
    incomplete_period_count: int = 0,
) -> QualityReport:
    errors = sum(issue.severity == "error" for issue in issues)
    warnings = sum(issue.severity == "warning" for issue in issues)
    observed_dates = dates or []
    return QualityReport(
        schema_version=SCHEMA_VERSION,
        checked_at=_utc_now(),
        passed=errors == 0,
        row_count=row_count,
        error_count=errors,
        warning_count=warnings,
        disease_codes=tuple(sorted(disease_codes or set())),
        location_levels=tuple(sorted(location_levels or set())),
        period_start=min(observed_dates).isoformat() if observed_dates else None,
        period_end=max(observed_dates).isoformat() if observed_dates else None,
        incomplete_period_count=incomplete_period_count,
        issues=tuple(issues),
    )


def _write_json_atomic(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_name, path)
    except BaseException:
        try:
            Path(temporary_name).unlink()
        except FileNotFoundError:
            pass
        raise


def _read_json(path: Path, label: str) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise IngestionGateError(f"Missing {label}: {path}") from exc
    except json.JSONDecodeError as exc:
        raise IngestionGateError(f"Invalid {label}: {path}") from exc
    if not isinstance(payload, dict):
        raise IngestionGateError(f"Invalid {label}: expected a JSON object")
    return payload


def _safe_package_path(package_path: Path) -> Path:
    resolved = package_path.resolve()
    if not resolved.is_dir():
        raise IngestionGateError(f"Staging package does not exist: {package_path}")
    return resolved


def stage_normalized_csv(source: Path, staging_root: Path) -> StagedDataset:
    """Copy a normalized CSV into a new review package and record its digest."""

    source = source.resolve()
    if not source.is_file():
        raise IngestionGateError(f"Normalized CSV does not exist: {source}")
    if source.suffix.lower() != ".csv":
        raise IngestionGateError("Only normalized CSV files can be staged")

    content = source.read_bytes()
    digest = sha256_bytes(content)
    quality = assess_normalized_csv(content)
    package_id = (
        datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        + f"-{digest[:12]}-{uuid.uuid4().hex[:8]}"
    )
    package_path = staging_root.resolve() / package_id
    package_path.mkdir(parents=True, exist_ok=False)
    dataset_path = package_path / DATA_FILENAME
    dataset_path.write_bytes(content)

    quality_path = package_path / QUALITY_REPORT_FILENAME
    _write_json_atomic(quality_path, quality.to_dict())
    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "packageId": package_id,
        "status": AWAITING_REVIEW,
        "createdAt": _utc_now(),
        "sourceFilename": source.name,
        "datasetFile": DATA_FILENAME,
        "qualityReportFile": QUALITY_REPORT_FILENAME,
        "sha256": digest,
        "byteSize": len(content),
        "qualityReportSha256": sha256_file(quality_path),
        "qualityPassed": quality.passed,
    }
    _write_json_atomic(package_path / MANIFEST_FILENAME, manifest)
    return StagedDataset(
        package_id=package_id,
        package_path=package_path,
        dataset_path=dataset_path,
        sha256=digest,
        status=AWAITING_REVIEW,
        quality_report=quality,
    )


def approve_staged_dataset(
    package_path: Path,
    *,
    reviewer: str,
    expected_sha256: str,
    note: str | None = None,
) -> ApprovedDataset:
    """Approve a quality-passing package after an explicit digest comparison."""

    package_path = _safe_package_path(package_path)
    manifest_path = package_path / MANIFEST_FILENAME
    manifest = _read_json(manifest_path, "manifest")
    if manifest.get("status") != AWAITING_REVIEW:
        raise IngestionGateError(
            f"Package status must be {AWAITING_REVIEW}; found {manifest.get('status')!r}"
        )
    reviewer = reviewer.strip()
    if not reviewer:
        raise IngestionGateError("Reviewer identity is required")
    expected_sha256 = expected_sha256.strip().lower()
    if not re.fullmatch(r"[0-9a-f]{64}", expected_sha256):
        raise IngestionGateError("Expected SHA-256 must contain 64 hexadecimal characters")

    dataset_path = package_path / str(manifest.get("datasetFile", DATA_FILENAME))
    actual_sha256 = sha256_file(dataset_path)
    recorded_sha256 = str(manifest.get("sha256", "")).lower()
    if actual_sha256 != recorded_sha256:
        raise IngestionGateError("Staged dataset checksum no longer matches its manifest")
    if actual_sha256 != expected_sha256:
        raise IngestionGateError("Reviewer-provided checksum does not match staged dataset")

    quality_path = package_path / str(
        manifest.get("qualityReportFile", QUALITY_REPORT_FILENAME)
    )
    actual_quality_sha256 = sha256_file(quality_path)
    if actual_quality_sha256 != manifest.get("qualityReportSha256"):
        raise IngestionGateError("Quality report checksum no longer matches its manifest")
    quality = _read_json(quality_path, "quality report")
    if quality.get("passed") is not True or manifest.get("qualityPassed") is not True:
        raise IngestionGateError("A dataset with quality errors cannot be approved")

    approved_at = _utc_now()
    approval = {
        "schemaVersion": SCHEMA_VERSION,
        "packageId": manifest.get("packageId"),
        "status": APPROVED,
        "reviewer": reviewer,
        "approvedAt": approved_at,
        "sha256": actual_sha256,
        "qualityReportSha256": actual_quality_sha256,
        "note": note.strip() if note and note.strip() else None,
    }
    approval_path = package_path / APPROVAL_FILENAME
    _write_json_atomic(approval_path, approval)
    manifest["status"] = APPROVED
    manifest["approvalFile"] = APPROVAL_FILENAME
    manifest["approvalSha256"] = sha256_file(approval_path)
    manifest["approvedAt"] = approved_at
    manifest["approvedBy"] = reviewer
    _write_json_atomic(manifest_path, manifest)

    return ApprovedDataset(
        package_id=str(manifest.get("packageId")),
        package_path=package_path,
        dataset_path=dataset_path,
        sha256=actual_sha256,
        reviewer=reviewer,
        approved_at=approved_at,
    )


def require_approved_dataset(package_path: Path) -> ApprovedDataset:
    """Verify the approval chain and return the only file safe for downstream use."""

    package_path = _safe_package_path(package_path)
    manifest = _read_json(package_path / MANIFEST_FILENAME, "manifest")
    if manifest.get("status") != APPROVED:
        raise IngestionGateError(
            f"Package is not approved; current status is {manifest.get('status')!r}"
        )

    dataset_path = package_path / str(manifest.get("datasetFile", DATA_FILENAME))
    quality_path = package_path / str(
        manifest.get("qualityReportFile", QUALITY_REPORT_FILENAME)
    )
    approval_path = package_path / str(manifest.get("approvalFile", APPROVAL_FILENAME))
    dataset_sha256 = sha256_file(dataset_path)
    quality_sha256 = sha256_file(quality_path)
    approval_sha256 = sha256_file(approval_path)
    if dataset_sha256 != manifest.get("sha256"):
        raise IngestionGateError("Approved dataset checksum verification failed")
    if quality_sha256 != manifest.get("qualityReportSha256"):
        raise IngestionGateError("Approved quality report checksum verification failed")
    if approval_sha256 != manifest.get("approvalSha256"):
        raise IngestionGateError("Approval receipt checksum verification failed")

    quality = _read_json(quality_path, "quality report")
    approval = _read_json(approval_path, "approval receipt")
    if quality.get("passed") is not True:
        raise IngestionGateError("Approved package has a failing quality report")
    if approval.get("status") != APPROVED:
        raise IngestionGateError("Approval receipt is not approved")
    if approval.get("packageId") != manifest.get("packageId"):
        raise IngestionGateError("Approval receipt package ID does not match manifest")
    if approval.get("sha256") != dataset_sha256:
        raise IngestionGateError("Approval receipt dataset checksum verification failed")
    if approval.get("qualityReportSha256") != quality_sha256:
        raise IngestionGateError("Approval receipt quality checksum verification failed")

    reviewer = str(approval.get("reviewer", "")).strip()
    approved_at = str(approval.get("approvedAt", "")).strip()
    if not reviewer or not approved_at:
        raise IngestionGateError("Approval receipt is missing reviewer audit fields")
    return ApprovedDataset(
        package_id=str(manifest.get("packageId")),
        package_path=package_path,
        dataset_path=dataset_path,
        sha256=dataset_sha256,
        reviewer=reviewer,
        approved_at=approved_at,
    )
