# Contributing

Thank you for helping improve the OneHealth Intelligence Platform.

## Ways to contribute

- Report reproducible bugs
- Improve tests or documentation
- Propose surveillance data mappings
- Review epidemiological assumptions
- Add well-documented disease ingestion adapters
- Improve accessibility, localization, or dashboard design

## Development setup

```bash
git clone https://github.com/khalilurrrahmanridoykhan/onehealth-platform.git
cd onehealth-platform
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
pytest
```

## Workflow

1. Search existing issues before opening a new one.
2. Create a focused branch from `main`.
3. Keep changes small and explain public-health or technical assumptions.
4. Add or update tests for behavioral changes.
5. Run `pytest` locally.
6. Open a pull request using the repository template.

## Data requirements

- Never commit identifiable patient data or protected health information.
- Prefer public, aggregate, documented datasets for examples.
- Record the source name, URL, access date, aggregation level, and limitations.
- Distinguish observed, estimated, modelled, and synthetic data.
- Do not describe a research threshold as an official outbreak definition.

## Code style

- Support Python 3.11 or newer.
- Add type annotations to new public functions.
- Keep ingestion, domain logic, and HTTP routes separate.
- Raise clear validation errors at data boundaries.
- Use stable codes for diseases and locations.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

