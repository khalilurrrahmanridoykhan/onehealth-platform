.PHONY: install data test reproduce serve

PYTHON ?= python3
DENGUE_SOURCE ?= data/raw/dengue_daily_2026.csv
DENGUE_OUTPUT ?= data/processed/dengue_weekly.csv

install:
	$(PYTHON) -m pip install -e '.[dev]'

data:
	$(PYTHON) scripts/import_dengue.py $(DENGUE_SOURCE) --output $(DENGUE_OUTPUT)

test:
	$(PYTHON) -m pytest -q

reproduce: install data test

serve:
	$(PYTHON) -m uvicorn onehealth.api:app --reload

