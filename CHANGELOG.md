# Changelog

All notable changes to this project will be documented here.

The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned

- Live DHIS2 validation and EBS Tracker metadata

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
- Customized responsive React and TypeScript surveillance dashboard
- National and division filters, summary cards, trend chart, risk panel, and comparison table
- Consolidated disease overview API and configurable CORS policy
- Locked frontend dependencies, component tests, production build, and CI job
- Interactive Bangladesh division risk map with linked dashboard filtering
- GeoJSON attribution and stable ISO-based division joins
- EBS workflow schema and custom signal-preview workspace
- Write-disabled-by-default API boundary for DHIS2 Tracker signal submission
- Verification, risk assessment, investigation, response, and closure preview forms
- DHIS2-compatible follow-up stage event API with required-field validation
- DHIS2 Tracker entity and event read client
- Saved EBS signal search, detail, and event-history dashboard
- Disabled-by-default registry read boundary pending access control

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
