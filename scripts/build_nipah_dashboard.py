#!/usr/bin/env python3
"""Build deterministic native DHIS2 Nipah literature-surveillance dashboard."""

import json
from pathlib import Path

DIVISIONS = ["BdDivBar001","BdDivCtg001","BdDivDha001","BdDivKhu001","BdDivMym001","BdDivRaj001","BdDivRan001"]
PERIODS = [str(year) for year in range(2001, 2025)]


def dim(name, ids, kind):
    return {"dimension":name,"items":[{"id":uid,"dimensionItemType":kind} for uid in ids]}


def viz(uid, name, kind, dx_ids, columns, rows, filters, org_units, periods):
    return {"id":uid,"name":name,"type":kind,"publicAccess":"rw------","showData":kind!="STACKED_COLUMN","hideEmptyRows":True,"hideEmptyColumns":True,"showDimensionLabels":True,"columns":columns,"rows":rows,"filters":filters,"dataDimensionItems":[{"dataDimensionItemType":"DATA_ELEMENT","dataElement":{"id":value}} for value in dx_ids],"organisationUnits":[{"id":value} for value in org_units],"periods":[{"id":value} for value in periods],"relativePeriods":{}}


def item(uid, object_uid, kind, x, y, w, h):
    result={"id":uid,"i":uid,"type":kind,"x":x,"y":y,"w":w,"h":h,"width":w,"height":h}
    result["map" if kind=="MAP" else "visualization"]={"id":object_uid}; return result


def build():
    dx_cases=dim("dx",["OhNipNatC01"],"DATA_ELEMENT"); dx_deaths=dim("dx",["OhNipNatD01"],"DATA_ELEMENT")
    dx_both=dim("dx",["OhNipNatC01","OhNipNatD01"],"DATA_ELEMENT"); dx_div=dim("dx",["OhNipDivC01"],"DATA_ELEMENT")
    pe_all=dim("pe",PERIODS,"PERIOD"); pe_latest=dim("pe",["2024"],"PERIOD"); pe_hotspot=dim("pe",["2021"],"PERIOD")
    ou_nat=dim("ou",["BdOrgUnit01"],"ORGANISATION_UNIT"); ou_div=dim("ou",DIVISIONS,"ORGANISATION_UNIT")
    ou_level=dim("ou",["LEVEL-2","BdOrgUnit01"],"ORGANISATION_UNIT")
    visualizations=[
      viz("OhNipTrend1","Nipah Annual Cases and Deaths — 2001–2024","LINE",["OhNipNatC01","OhNipNatD01"],[dx_both],[pe_all],[ou_nat],["BdOrgUnit01"],PERIODS),
      viz("OhNipCaseK1","Latest National Nipah Cases — 2024","SINGLE_VALUE",["OhNipNatC01"],[dx_cases],[],[pe_latest,ou_nat],["BdOrgUnit01"],["2024"]),
      viz("OhNipDeadK1","Latest National Nipah Deaths — 2024","SINGLE_VALUE",["OhNipNatD01"],[dx_deaths],[],[pe_latest,ou_nat],["BdOrgUnit01"],["2024"]),
      viz("OhNipTotalC","Cumulative National Nipah Cases — 2001–2024","SINGLE_VALUE",["OhNipNatC01"],[dx_cases],[],[pe_all,ou_nat],["BdOrgUnit01"],PERIODS),
      viz("OhNipTotalD","Cumulative National Nipah Deaths — 2001–2024","SINGLE_VALUE",["OhNipNatD01"],[dx_deaths],[],[pe_all,ou_nat],["BdOrgUnit01"],PERIODS),
      viz("OhNipDiv001","Division Cumulative Nipah Burden — 2001–2021","BAR",["OhNipDivC01"],[ou_div],[dx_div],[pe_hotspot],DIVISIONS,["2021"]),
      viz("OhNipTable1","Nipah Annual Cases and Deaths Table","PIVOT_TABLE",["OhNipNatC01","OhNipNatD01"],[pe_all],[dx_both],[ou_nat],["BdOrgUnit01"],PERIODS),
    ]
    map_view={"layer":"thematic","name":"Cumulative Nipah cases by division — 2001–2021","columns":[dx_div],"rows":[ou_level],"filters":[pe_hotspot],"organisationUnits":[{"id":"BdOrgUnit01"}],"organisationUnitLevels":[2],"periods":[{"id":"2021"}],"classes":5,"method":2,"colorLow":"#fde68a","colorHigh":"#7f1d1d","colorScale":"#fde68a,#f59e0b,#f97316,#dc2626,#7f1d1d","opacity":1,"labels":False,"thematicMapType":"CHOROPLETH","aggregationType":"DEFAULT","noDataColor":"#d1d5db"}
    maps=[{"id":"OhNipMap001","name":"Nipah Division Hotspot Map — 2001–2021","publicAccess":"rw------","basemap":"osmLight","zoom":6,"latitude":23.7,"longitude":90.35,"mapViews":[map_view]}]
    dashboard_items=[
      item("OhNipItem01","OhNipCaseK1","VISUALIZATION",0,0,15,8),item("OhNipItem02","OhNipDeadK1","VISUALIZATION",15,0,15,8),
      item("OhNipItem03","OhNipTotalC","VISUALIZATION",30,0,15,8),item("OhNipItem04","OhNipTotalD","VISUALIZATION",45,0,15,8),
      item("OhNipItem05","OhNipTrend1","VISUALIZATION",0,8,60,16),item("OhNipItem06","OhNipMap001","MAP",0,24,30,18),
      item("OhNipItem07","OhNipDiv001","VISUALIZATION",30,24,30,18),item("OhNipItem08","OhNipTable1","VISUALIZATION",0,42,60,14),
    ]
    return {"visualizations":visualizations,"maps":maps,"dashboards":[{"id":"OhNipDash01","name":"OneHealth Nipah Literature Surveillance","description":"Historical literature-compiled Nipah cases, deaths, and division hotspots for Bangladesh; not live surveillance","publicAccess":"rw------","dashboardItems":dashboard_items}]}


if __name__ == "__main__":
    target=Path("dhis2/metadata/nipah_dashboard.json"); target.write_text(json.dumps(build(),indent=2)+"\n",encoding="utf-8"); print(f"Wrote {target}")
