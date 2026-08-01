.PHONY: install data test reproduce serve dhis2-preview

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

reproduce: install data test

serve:
	$(PYTHON) -m uvicorn onehealth.api:app --reload

dhis2-preview:
	$(PYTHON) scripts/sync_dhis2.py --preview
