#!/usr/bin/env python3
"""Build the native DHIS2 AWD ecological-estimates dashboard."""
import json
from pathlib import Path

DIVISIONS=["BdDivBar001","BdDivCtg001","BdDivDha001","BdDivKhu001","BdDivMym001","BdDivRaj001","BdDivRan001","BdDivSyl001"]
PERIODS=[str(year) for year in range(2014,2025)]
def dim(name,ids,kind): return {"dimension":name,"items":[{"id":uid,"dimensionItemType":kind} for uid in ids]}
def viz(uid,name,kind,dx_ids,columns,rows,filters,org_units,periods):
 return {"id":uid,"name":name,"type":kind,"publicAccess":"rw------","showData":kind!="STACKED_COLUMN","hideEmptyRows":True,"hideEmptyColumns":True,"showDimensionLabels":True,"columns":columns,"rows":rows,"filters":filters,"dataDimensionItems":[{"dataDimensionItemType":"DATA_ELEMENT","dataElement":{"id":v}} for v in dx_ids],"organisationUnits":[{"id":v} for v in org_units],"periods":[{"id":v} for v in periods],"relativePeriods":{}}
def item(uid,obj,kind,x,y,w,h):
 r={"id":uid,"i":uid,"type":kind,"x":x,"y":y,"w":w,"h":h,"width":w,"height":h}; r["map" if kind=="MAP" else "visualization"]={"id":obj}; return r
def build():
 dxn=dim("dx",["OhAwdNatC01"],"DATA_ELEMENT"); dxd=dim("dx",["OhAwdDivC01"],"DATA_ELEMENT")
 pea=dim("pe",PERIODS,"PERIOD"); pel=dim("pe",["2024"],"PERIOD"); oun=dim("ou",["BdOrgUnit01"],"ORGANISATION_UNIT"); oud=dim("ou",DIVISIONS,"ORGANISATION_UNIT"); oul=dim("ou",["LEVEL-2","BdOrgUnit01"],"ORGANISATION_UNIT")
 visualizations=[
  viz("OhAwdTrend1","AWD National Annual Estimated Cases — 2014–2024","LINE",["OhAwdNatC01"],[pea],[dxn],[oun],["BdOrgUnit01"],PERIODS),
  viz("OhAwdLatest","Latest National AWD Estimated Cases — 2024","SINGLE_VALUE",["OhAwdNatC01"],[dxn],[],[pel,oun],["BdOrgUnit01"],["2024"]),
  viz("OhAwdTotal1","Cumulative AWD Estimated Cases — 2014–2024","SINGLE_VALUE",["OhAwdNatC01"],[dxn],[],[pea,oun],["BdOrgUnit01"],PERIODS),
  viz("OhAwdDivBar","AWD Estimated Cases by Division — 2024","BAR",["OhAwdDivC01"],[oud],[dxd],[pel],DIVISIONS,["2024"]),
  viz("OhAwdBurden","Division AWD Estimated Burden — 2014–2024","STACKED_COLUMN",["OhAwdDivC01"],[pea],[oud],[dxd],DIVISIONS,PERIODS),
  viz("OhAwdTable1","AWD Division Annual Estimates Table","PIVOT_TABLE",["OhAwdDivC01"],[pea],[oud],[dxd],DIVISIONS,PERIODS)]
 view={"layer":"thematic","name":"AWD annual estimated cases by division — 2024","columns":[dxd],"rows":[oul],"filters":[pel],"organisationUnits":[{"id":"BdOrgUnit01"}],"organisationUnitLevels":[2],"periods":[{"id":"2024"}],"classes":5,"method":2,"colorLow":"#d1fae5","colorHigh":"#7f1d1d","colorScale":"#d1fae5,#fef3c7,#f59e0b,#ef4444,#7f1d1d","opacity":1,"labels":False,"thematicMapType":"CHOROPLETH","aggregationType":"DEFAULT","noDataColor":"#d1d5db"}
 maps=[{"id":"OhAwdMap001","name":"AWD Division Estimated Burden Map — 2024","publicAccess":"rw------","basemap":"osmLight","zoom":6,"latitude":23.7,"longitude":90.35,"mapViews":[view]}]
 items=[item("OhAwdItem01","OhAwdLatest","VISUALIZATION",0,0,20,8),item("OhAwdItem02","OhAwdTotal1","VISUALIZATION",20,0,40,8),item("OhAwdItem03","OhAwdTrend1","VISUALIZATION",0,8,60,16),item("OhAwdItem04","OhAwdMap001","MAP",0,24,30,18),item("OhAwdItem05","OhAwdDivBar","VISUALIZATION",30,24,30,18),item("OhAwdItem06","OhAwdBurden","VISUALIZATION",0,42,60,16),item("OhAwdItem07","OhAwdTable1","VISUALIZATION",0,58,60,14)]
 return {"visualizations":visualizations,"maps":maps,"dashboards":[{"id":"OhAwdDash01","name":"OneHealth AWD Ecological Estimates","description":"Literature-derived ecological AWD estimates for research demonstration. Division values use published proxy weights and are not authenticated live EWARS observations.","publicAccess":"rw------","dashboardItems":items}]}
if __name__=="__main__":
 target=Path("dhis2/metadata/awd_dashboard.json"); target.write_text(json.dumps(build(),indent=2)+"\n",encoding="utf-8"); print(f"Wrote {target}")
