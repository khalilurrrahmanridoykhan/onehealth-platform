import csv
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from onehealth.services.ingestion import CSV_FIELDS
from onehealth.services.ingestion_gate import (
    AWAITING_REVIEW,
    IngestionGateError,
    approve_staged_dataset,
    require_approved_dataset,
    sha256_file,
    stage_normalized_csv,
)


def write_normalized_csv(path: Path, **overrides: str) -> None:
    row = {
        "disease_code": "DENGUE",
        "disease_name": "Dengue",
        "period_start": "2026-01-05",
        "period_end": "2026-01-11",
        "period_type": "weekly",
        "period_label": "2026-W02",
        "location_code": "BD",
        "location_name": "Bangladesh",
        "location_level": "national",
        "cases": "70",
        "deaths": "",
        "population": "",
        "incidence_per_100k": "",
        "data_status": "observed",
        "source_name": "DGHS",
        "source_url": "https://example.test/source",
        "complete_period": "True",
    }
    row.update(overrides)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerow(row)


def test_stage_creates_awaiting_review_package_and_quality_report(tmp_path: Path):
    source = tmp_path / "normalized.csv"
    write_normalized_csv(source)

    staged = stage_normalized_csv(source, tmp_path / "staging")

    assert staged.status == AWAITING_REVIEW
    assert staged.dataset_path.read_bytes() == source.read_bytes()
    assert staged.sha256 == sha256_file(source)
    assert staged.quality_report.passed is True
    assert staged.quality_report.row_count == 1
    manifest = json.loads((staged.package_path / "manifest.json").read_text())
    assert manifest["status"] == AWAITING_REVIEW
    assert manifest["qualityPassed"] is True
    assert manifest["sourceFilename"] == "normalized.csv"
    assert str(source.resolve()) not in json.dumps(manifest)


def test_quality_errors_are_recorded_and_block_approval(tmp_path: Path):
    source = tmp_path / "invalid.csv"
    write_normalized_csv(source, cases="-2")
    staged = stage_normalized_csv(source, tmp_path / "staging")

    assert staged.status == AWAITING_REVIEW
    assert staged.quality_report.passed is False
    assert any(
        issue.code == "number_out_of_range" for issue in staged.quality_report.issues
    )
    with pytest.raises(IngestionGateError, match="quality errors"):
        approve_staged_dataset(
            staged.package_path,
            reviewer="Data Steward",
            expected_sha256=staged.sha256,
        )


def test_unexpected_identifier_column_is_blocked(tmp_path: Path):
    source = tmp_path / "identifiable.csv"
    source.write_text(
        ",".join((*CSV_FIELDS, "patient_name"))
        + "\n"
        + ",".join(("" for _ in CSV_FIELDS))
        + ",Example Person\n",
        encoding="utf-8",
    )

    staged = stage_normalized_csv(source, tmp_path / "staging")

    assert staged.quality_report.passed is False
    assert staged.quality_report.issues[0].code == "unexpected_columns"


def test_approval_requires_the_reviewer_supplied_checksum(tmp_path: Path):
    source = tmp_path / "normalized.csv"
    write_normalized_csv(source)
    staged = stage_normalized_csv(source, tmp_path / "staging")

    with pytest.raises(IngestionGateError, match="Reviewer-provided checksum"):
        approve_staged_dataset(
            staged.package_path,
            reviewer="Data Steward",
            expected_sha256="0" * 64,
        )

    manifest = json.loads((staged.package_path / "manifest.json").read_text())
    assert manifest["status"] == AWAITING_REVIEW


def test_approved_package_verifies_for_downstream_use(tmp_path: Path):
    source = tmp_path / "normalized.csv"
    write_normalized_csv(source)
    staged = stage_normalized_csv(source, tmp_path / "staging")
    approved = approve_staged_dataset(
        staged.package_path,
        reviewer="Khalilur Rahman Ridoy Khan",
        expected_sha256=staged.sha256,
        note="Reviewed source and period coverage",
    )

    verified = require_approved_dataset(staged.package_path)

    assert verified == approved
    assert verified.dataset_path == staged.dataset_path
    approval = json.loads((staged.package_path / "approval.json").read_text())
    assert approval["reviewer"] == "Khalilur Rahman Ridoy Khan"
    assert approval["sha256"] == staged.sha256


def test_dataset_tampering_invalidates_approval(tmp_path: Path):
    source = tmp_path / "normalized.csv"
    write_normalized_csv(source)
    staged = stage_normalized_csv(source, tmp_path / "staging")
    approve_staged_dataset(
        staged.package_path,
        reviewer="Data Steward",
        expected_sha256=staged.sha256,
    )
    staged.dataset_path.write_text("tampered\n", encoding="utf-8")

    with pytest.raises(IngestionGateError, match="dataset checksum"):
        require_approved_dataset(staged.package_path)


def test_quality_report_tampering_invalidates_approval(tmp_path: Path):
    source = tmp_path / "normalized.csv"
    write_normalized_csv(source)
    staged = stage_normalized_csv(source, tmp_path / "staging")
    approve_staged_dataset(
        staged.package_path,
        reviewer="Data Steward",
        expected_sha256=staged.sha256,
    )
    (staged.package_path / "quality-report.json").write_text("{}\n", encoding="utf-8")

    with pytest.raises(IngestionGateError, match="quality report checksum"):
        require_approved_dataset(staged.package_path)


def test_dhis2_sync_modes_require_an_approved_package():
    environment = os.environ.copy()
    environment["PYTHONPATH"] = "src"
    result = subprocess.run(
        [sys.executable, "scripts/sync_dhis2.py", "--dry-run"],
        cwd=Path(__file__).resolve().parents[1],
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 2
    assert "--staged-package is required" in result.stderr
    assert "DHIS2_BASE_URL" not in result.stderr
