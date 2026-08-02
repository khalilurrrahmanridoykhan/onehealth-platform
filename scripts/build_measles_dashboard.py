#!/usr/bin/env python3
"""Build deterministic DHIS2 native Measles dashboard metadata."""

import json
from pathlib import Path


DIVISIONS = [
    "BdDivBar001", "BdDivCtg001", "BdDivDha001", "BdDivKhu001",
    "BdDivMym001", "BdDivRaj001", "BdDivRan001", "BdDivSyl001",
]
PERIODS = [f"2026W{week}" for week in range(15, 23)]


def items(ids: list[str], item_type: str) -> list[dict]:
    return [{"id": uid, "dimensionItemType": item_type} for uid in ids]


def dimension(name: str, ids: list[str], item_type: str) -> dict:
    return {"dimension": name, "items": items(ids, item_type)}


def visualization(uid: str, name: str, chart_type: str, columns: list[dict],
                  rows: list[dict], filters: list[dict], description: str) -> dict:
    return {
        "id": uid, "name": name, "description": description, "type": chart_type,
        "publicAccess": "rw------", "showData": chart_type != "STACKED_COLUMN",
        "hideEmptyRows": True, "hideEmptyColumns": True,
        "showDimensionLabels": True, "columns": columns, "rows": rows,
        "filters": filters,
        "dataDimensionItems": [{"dataDimensionItemType": "DATA_ELEMENT",
                                "dataElement": {"id": "OhMslNat001" if uid in {
                                    "OhMslTrend1", "OhMslKpi001", "OhMslYtd001"
                                } else "OhMslCase01"}}],
        "organisationUnits": [{"id": uid} for uid in (
            ["BdOrgUnit01"] if uid in {"OhMslTrend1", "OhMslKpi001", "OhMslYtd001"}
            else DIVISIONS
        )],
        "periods": [{"id": period} for period in (
            ["2026W22"] if uid in {"OhMslDiv001", "OhMslKpi001"} else PERIODS
        )],
        "relativePeriods": {},
    }


def dashboard_item(uid: str, object_uid: str, item_type: str, x: int, y: int,
                   width: int, height: int) -> dict:
    item = {
        "id": uid, "i": uid, "type": item_type, "x": x, "y": y,
        "w": width, "h": height, "width": width, "height": height,
        "minH": 6 if height <= 8 else 8,
    }
    item["map" if item_type == "MAP" else "visualization"] = {"id": object_uid}
    return item


def build() -> dict:
    dx_national = dimension("dx", ["OhMslNat001"], "DATA_ELEMENT")
    dx_division = dimension("dx", ["OhMslCase01"], "DATA_ELEMENT")
    ou_national = dimension("ou", ["BdOrgUnit01"], "ORGANISATION_UNIT")
    ou_divisions = dimension("ou", DIVISIONS, "ORGANISATION_UNIT")
    pe_all = dimension("pe", PERIODS, "PERIOD")
    pe_latest = dimension("pe", ["2026W22"], "PERIOD")

    visualizations = [
        visualization("OhMslTrend1", "OneHealth Measles Weekly Trend", "LINE",
                      [dx_national], [pe_all], [ou_national],
                      "National weekly suspected measles cases, complete weeks 15–22 of 2026"),
        visualization("OhMslDiv001", "Measles Cases by Division — Week 22", "COLUMN",
                      [ou_divisions], [dx_division], [pe_latest],
                      "Source-available division suspected measles cases for week 22 of 2026"),
        visualization("OhMslKpi001", "Latest National Suspected Measles Cases", "SINGLE_VALUE",
                      [dx_national], [], [pe_latest, ou_national],
                      "National suspected measles cases for week 22 of 2026"),
        visualization("OhMslYtd001", "National Suspected Measles Cases — Weeks 15–22", "SINGLE_VALUE",
                      [dx_national], [], [pe_all, ou_national],
                      "Cumulative national suspected measles cases across complete weeks 15–22"),
        visualization("OhMslStack1", "Division Measles Burden — Complete Reporting Weeks", "STACKED_COLUMN",
                      [ou_divisions], [dx_division, pe_all], [],
                      "Weekly composition of suspected measles cases across source-available divisions"),
        visualization("OhMslTable1", "Measles Division Weekly Surveillance Table", "PIVOT_TABLE",
                      [pe_all], [ou_divisions, dx_division], [],
                      "Auditable weekly division suspected measles case table"),
    ]

    map_view = {
        "layer": "thematic", "name": "Measles suspected cases — Week 22",
        "columns": [dx_division], "rows": [ou_divisions], "filters": [pe_latest],
        "organisationUnits": [{"id": uid} for uid in DIVISIONS],
        "periods": [{"id": "2026W22"}], "classes": 5, "method": 2,
        "colorLow": "fff5eb", "colorHigh": "b42318", "opacity": 0.85,
        "labels": True, "thematicMapType": "CHOROPLETH",
        "aggregationType": "DEFAULT", "noDataColor": "d7e2de",
    }
    maps = [{
        "id": "OhMslMap001", "name": "Measles Division Case Map — Week 22",
        "description": "Native DHIS2 thematic map of source-available division measles cases",
        "publicAccess": "rw------",
        "basemap": json.dumps({"id": "osmLight", "opacity": 1, "hidden": False}),
        "zoom": 6,
        "latitude": 23.7, "longitude": 90.35, "mapViews": [map_view],
    }]

    dashboard_items = [
        dashboard_item("OhMslItem01", "OhMslKpi001", "VISUALIZATION", 0, 0, 30, 8),
        dashboard_item("OhMslItem02", "OhMslYtd001", "VISUALIZATION", 30, 0, 30, 8),
        dashboard_item("OhMslItem03", "OhMslTrend1", "VISUALIZATION", 0, 8, 30, 14),
        dashboard_item("OhMslItem04", "OhMslDiv001", "VISUALIZATION", 30, 8, 30, 14),
        dashboard_item("OhMslItem05", "OhMslMap001", "MAP", 0, 22, 30, 18),
        dashboard_item("OhMslItem06", "OhMslStack1", "VISUALIZATION", 30, 22, 30, 18),
        dashboard_item("OhMslItem07", "OhMslTable1", "VISUALIZATION", 0, 40, 60, 14),
    ]
    return {
        "visualizations": visualizations, "maps": maps,
        "dashboards": [{
            "id": "OhMslDash01", "name": "OneHealth Measles Surveillance",
            "description": "Native DHIS2 Measles surveillance dashboard for Bangladesh",
            "publicAccess": "rw------", "dashboardItems": dashboard_items,
        }],
    }


if __name__ == "__main__":
    target = Path("dhis2/metadata/measles_dashboard.json")
    target.write_text(json.dumps(build(), indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {target}")
