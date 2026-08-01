.PHONY: install data test frontend-install frontend-test frontend-build reproduce serve frontend-dev dhis2-preview

PYTHON ?= python3
DENGUE_SOURCE ?= data/raw/dengue_daily_2026.csv
DENGUE_DIVISION_SOURCE ?= data/raw/dengue_weekly_division_2026.csv
DENGUE_OUTPUT ?= data/processed/dengue_weekly.csv

install:
	$(PYTHON) -m pip install -e '.[dev]'

data:
	$(PYTHON) scripts/import_dengue.py $(DENGUE_SOURCE) --division-source $(DENGUE_DIVISION_SOURCE) --output $(DENGUE_OUTPUT)

test:
	$(PYTHON) -m pytest -q

frontend-install:
	cd frontend && npm ci

frontend-test:
	cd frontend && npm test

frontend-build:
	cd frontend && npm run build

reproduce: install data test frontend-install frontend-test frontend-build

serve:
	$(PYTHON) -m uvicorn onehealth.api:app --reload

frontend-dev:
	cd frontend && npm run dev

dhis2-preview:
	$(PYTHON) scripts/sync_dhis2.py --preview
