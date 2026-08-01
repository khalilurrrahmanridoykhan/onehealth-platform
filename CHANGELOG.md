# Changelog

All notable changes to this project will be documented here.

The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned

- Live DHIS2 validation and EBS Tracker metadata
- Customized React surveillance dashboard
- Division-level dengue mapping

### Added

- DHIS2 Web API client with token and basic authentication
- Aggregate dengue metadata package and configurable UID mapping
- Preview, dry-run, and committed data-value synchronization modes
- Duplicate-period protection and synchronization reporting
- DHIS2-backed reads for existing trend and alert endpoints
- Mocked DHIS2 integration tests
- Division-level dengue ingestion for all eight Bangladesh divisions
- Stable internal national and division location codes
- Location discovery, filtering, summaries, and division-specific alerts
- DHIS2 organization-unit mapping placeholders for all supported locations
- Six-stage DHIS2 EBS Tracker metadata package
- EBS signal enrollment and follow-up event payload builders
- Explicit preview and commit workflow for Tracker signals
- Tracker metadata, linkage, UID, and HTTP integration tests

## [0.1.0] - 2026-08-01

### Added

- Dengue daily CSV ingestion and validation
- ISO weekly aggregation
- Normalized surveillance records with provenance
- Partial-week detection
- Explainable four-week baseline alerts
- FastAPI health, disease, trend, and alert endpoints
- Automated tests

[Unreleased]: https://github.com/khalilurrrahmanridoykhan/onehealth-platform/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/khalilurrrahmanridoykhan/onehealth-platform/releases/tag/v0.1.0
