#!/usr/bin/env python3
"""Build deterministic native DHIS2 Japanese encephalitis dashboard."""

import json
from pathlib import Path

SITES = ["BdDivCtg001", "BdDivKhu001", "BdDivRaj001", "BdDivRan001"]
PERIODS = [str(year) for year in range(2007, 2017)]


def dim(name, ids, kind):
    return {"dimension": name, "items": [{"id": uid, "dimensionItemType": kind} for uid in ids]}


def viz(uid, name, kind, dx_ids, columns, rows, filters, org_units, periods):
    return {"id": uid, "name": name, "type": kind, "publicAccess": "rw------", "showData": kind != "STACKED_COLUMN", "hideEmptyRows": True, "hideEmptyColumns": True, "showDimensionLabels": True, "columns": columns, "rows": rows, "filters": filters, "dataDimensionItems": [{"dataDimensionItemType": "DATA_ELEMENT", "dataElement": {"id": value}} for value in dx_ids], "organisationUnits": [{"id": value} for value in org_units], "periods": [{"id": value} for value in periods], "relativePeriods": {}}


def item(uid, object_uid, x, y, w, h):
    return {"id": uid, "i": uid, "type": "VISUALIZATION", "x": x, "y": y, "w": w, "h": h, "width": w, "height": h, "visualization": {"id": object_uid}}


def build():
    dx_nat = dim("dx", ["OhJeNatC001"], "DATA_ELEMENT")
    dx_site = dim("dx", ["OhJeDivC001"], "DATA_ELEMENT")
    pe_all = dim("pe", PERIODS, "PERIOD")
    pe_latest = dim("pe", ["2016"], "PERIOD")
    ou_nat = dim("ou", ["BdOrgUnit01"], "ORGANISATION_UNIT")
    ou_sites = dim("ou", SITES, "ORGANISATION_UNIT")
    visualizations = [
        viz("OhJeTrend01", "JE Annual Confirmed Cases — 2007–2016", "LINE", ["OhJeNatC001"], [pe_all], [dx_nat], [ou_nat], ["BdOrgUnit01"], PERIODS),
        viz("OhJeLatest1", "Latest JE Confirmed Cases — 2016 Partial", "SINGLE_VALUE", ["OhJeNatC001"], [dx_nat], [], [pe_latest, ou_nat], ["BdOrgUnit01"], ["2016"]),
        viz("OhJeTotal01", "Total JE Confirmed Cases — 2007–2016", "SINGLE_VALUE", ["OhJeNatC001"], [dx_nat], [], [pe_all, ou_nat], ["BdOrgUnit01"], PERIODS),
        viz("OhJeSites01", "JE Cases by Sentinel Site — 2007–2016", "STACKED_COLUMN", ["OhJeDivC001"], [pe_all], [ou_sites], [dx_site], SITES, PERIODS),
        viz("OhJeBurden1", "Cumulative JE Burden by Sentinel Site", "BAR", ["OhJeDivC001"], [ou_sites], [dx_site], [pe_all], SITES, PERIODS),
        viz("OhJeTable01", "JE Annual Sentinel Surveillance Table", "PIVOT_TABLE", ["OhJeDivC001"], [pe_all], [ou_sites], [dx_site], SITES, PERIODS),
    ]
    dashboard_items = [
        item("OhJeItem001", "OhJeLatest1", 0, 0, 20, 8),
        item("OhJeItem002", "OhJeTotal01", 20, 0, 40, 8),
        item("OhJeItem003", "OhJeTrend01", 0, 8, 60, 16),
        item("OhJeItem004", "OhJeSites01", 0, 24, 30, 18),
        item("OhJeItem005", "OhJeBurden1", 30, 24, 30, 18),
        item("OhJeItem006", "OhJeTable01", 0, 42, 60, 14),
    ]
    return {"visualizations": visualizations, "dashboards": [{"id": "OhJeDash001", "name": "OneHealth Japanese Encephalitis Sentinel Surveillance", "description": "Historical hospital-based sentinel surveillance from Paul et al. (2020). The 2016 period covers January-July only. Site records represent sentinel hospitals, not population-wide division incidence.", "publicAccess": "rw------", "dashboardItems": dashboard_items}]}


if __name__ == "__main__":
    target = Path("dhis2/metadata/je_dashboard.json")
    target.write_text(json.dumps(build(), indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {target}")
