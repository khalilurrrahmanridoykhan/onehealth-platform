#!/usr/bin/env python3
"""Build deterministic native DHIS2 HPAI dashboard metadata."""

import json
from pathlib import Path

DIVISIONS = ["BdDivBar001", "BdDivCtg001", "BdDivDha001", "BdDivKhu001",
             "BdDivRaj001", "BdDivRan001", "BdDivSyl001"]
PERIODS = [f"{year}S{semester}" for year in range(2020, 2025) for semester in (1, 2)] + ["2025S1"]
LATEST = "2025S1"


def dim(name, ids, kind):
    return {"dimension": name, "items": [{"id": uid, "dimensionItemType": kind} for uid in ids]}


def viz(uid, name, kind, columns, rows, filters, data_element, org_units, periods):
    return {
        "id": uid, "name": name, "type": kind, "publicAccess": "rw------",
        "showData": kind != "STACKED_COLUMN", "hideEmptyRows": True,
        "hideEmptyColumns": True, "showDimensionLabels": True,
        "columns": columns, "rows": rows, "filters": filters,
        "dataDimensionItems": [{"dataDimensionItemType": "DATA_ELEMENT",
                                "dataElement": {"id": data_element}}],
        "organisationUnits": [{"id": value} for value in org_units],
        "periods": [{"id": value} for value in periods], "relativePeriods": {},
    }


def item(uid, object_uid, kind, x, y, width, height):
    result = {"id": uid, "i": uid, "type": kind, "x": x, "y": y,
              "w": width, "h": height, "width": width, "height": height}
    result["map" if kind == "MAP" else "visualization"] = {"id": object_uid}
    return result


def build():
    dx_nat = dim("dx", ["OhHpaiNat01"], "DATA_ELEMENT")
    dx_div = dim("dx", ["OhHpaiOut01"], "DATA_ELEMENT")
    ou_nat = dim("ou", ["BdOrgUnit01"], "ORGANISATION_UNIT")
    ou_div = dim("ou", DIVISIONS, "ORGANISATION_UNIT")
    ou_level = dim("ou", ["LEVEL-2", "BdOrgUnit01"], "ORGANISATION_UNIT")
    pe_all, pe_latest = dim("pe", PERIODS, "PERIOD"), dim("pe", [LATEST], "PERIOD")
    visualizations = [
        viz("OhHpaiTrend", "HPAI National Outbreak Trend", "LINE", [dx_nat], [pe_all], [ou_nat], "OhHpaiNat01", ["BdOrgUnit01"], PERIODS),
        viz("OhHpaiDiv01", "HPAI Outbreaks by Division — 2025 S1", "COLUMN", [ou_div], [dx_div], [pe_latest], "OhHpaiOut01", DIVISIONS, [LATEST]),
        viz("OhHpaiKpi01", "Latest National Reported HPAI Outbreaks", "SINGLE_VALUE", [dx_nat], [], [pe_latest, ou_nat], "OhHpaiNat01", ["BdOrgUnit01"], [LATEST]),
        viz("OhHpaiTot01", "Reported HPAI Outbreaks — 2020–2025", "SINGLE_VALUE", [dx_nat], [], [pe_all, ou_nat], "OhHpaiNat01", ["BdOrgUnit01"], PERIODS),
        viz("OhHpaiStack", "Division HPAI Outbreak Burden", "STACKED_COLUMN", [ou_div], [dx_div, pe_all], [], "OhHpaiOut01", DIVISIONS, PERIODS),
        viz("OhHpaiTable", "HPAI Division-Semester Surveillance Table", "PIVOT_TABLE", [pe_all], [ou_div, dx_div], [], "OhHpaiOut01", DIVISIONS, PERIODS),
    ]
    map_view = {
        "layer": "thematic", "name": "HPAI outbreaks — 2025 S1", "columns": [dx_div],
        "rows": [ou_level], "filters": [pe_latest], "organisationUnits": [{"id":"BdOrgUnit01"}],
        "organisationUnitLevels": [2], "periods": [{"id":LATEST}], "classes": 5,
        "method": 2, "colorLow": "#fde68a", "colorHigh": "#7f1d1d",
        "colorScale": "#fde68a,#f59e0b,#f97316,#dc2626,#7f1d1d", "opacity": 1,
        "labels": False, "thematicMapType": "CHOROPLETH", "aggregationType": "DEFAULT",
        "noDataColor": "#d1d5db",
    }
    maps = [{"id":"OhHpaiMap01", "name":"HPAI Division Outbreak Map — 2025 S1",
             "publicAccess":"rw------", "basemap":"osmLight", "zoom":6,
             "latitude":23.7, "longitude":90.35, "mapViews":[map_view]}]
    dashboard_items = [
        item("OhHpaiIt001", "OhHpaiKpi01", "VISUALIZATION", 0, 0, 30, 8),
        item("OhHpaiIt002", "OhHpaiTot01", "VISUALIZATION", 30, 0, 30, 8),
        item("OhHpaiIt003", "OhHpaiTrend", "VISUALIZATION", 0, 8, 30, 14),
        item("OhHpaiIt004", "OhHpaiDiv01", "VISUALIZATION", 30, 8, 30, 14),
        item("OhHpaiIt005", "OhHpaiMap01", "MAP", 0, 22, 30, 18),
        item("OhHpaiIt006", "OhHpaiStack", "VISUALIZATION", 30, 22, 30, 18),
        item("OhHpaiIt007", "OhHpaiTable", "VISUALIZATION", 0, 40, 60, 14),
    ]
    return {"visualizations": visualizations, "maps": maps, "dashboards": [{
        "id":"OhHpaiDash1", "name":"OneHealth HPAI Surveillance",
        "description":"Native DHIS2 HPAI outbreak surveillance dashboard for Bangladesh",
        "publicAccess":"rw------", "dashboardItems":dashboard_items,
    }]}


if __name__ == "__main__":
    target = Path("dhis2/metadata/hpai_dashboard.json")
    target.write_text(json.dumps(build(), indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {target}")
