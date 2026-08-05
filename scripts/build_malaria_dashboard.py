#!/usr/bin/env python3
"""Build native DHIS2 national confirmed-malaria dashboard."""
import json
from pathlib import Path
PERIODS=[str(y) for y in range(2015,2025)]
def dim(n,ids,k): return {"dimension":n,"items":[{"id":u,"dimensionItemType":k} for u in ids]}
def viz(uid,name,kind,columns,rows,filters,periods): return {"id":uid,"name":name,"type":kind,"publicAccess":"rw------","showData":True,"hideEmptyRows":True,"hideEmptyColumns":True,"showDimensionLabels":True,"columns":columns,"rows":rows,"filters":filters,"dataDimensionItems":[{"dataDimensionItemType":"DATA_ELEMENT","dataElement":{"id":"OhMalNatC01"}}],"organisationUnits":[{"id":"BdOrgUnit01"}],"periods":[{"id":p} for p in periods],"relativePeriods":{}}
def item(uid,obj,x,y,w,h): return {"id":uid,"i":uid,"type":"VISUALIZATION","x":x,"y":y,"w":w,"h":h,"width":w,"height":h,"visualization":{"id":obj}}
def build():
 dx=dim("dx",["OhMalNatC01"],"DATA_ELEMENT"); pea=dim("pe",PERIODS,"PERIOD"); pel=dim("pe",["2024"],"PERIOD"); recent=dim("pe",[str(y) for y in range(2020,2025)],"PERIOD"); ou=dim("ou",["BdOrgUnit01"],"ORGANISATION_UNIT")
 v=[viz("OhMalLatest","Latest Confirmed Malaria Cases — 2024","SINGLE_VALUE",[dx],[],[pel,ou],["2024"]),viz("OhMalTotal1","Cumulative Confirmed Malaria Cases — 2015–2024","SINGLE_VALUE",[dx],[],[pea,ou],PERIODS),viz("OhMalTrend1","Confirmed Malaria Cases — 2015–2024","LINE",[pea],[dx],[ou],PERIODS),viz("OhMalRecent","Recent Confirmed Malaria Cases — 2020–2024","COLUMN",[recent],[dx],[ou],[str(y) for y in range(2020,2025)]),viz("OhMalTable1","Confirmed Malaria Annual Table","PIVOT_TABLE",[pea],[dx],[ou],PERIODS)]
 items=[item("OhMalItem01","OhMalLatest",0,0,20,8),item("OhMalItem02","OhMalTotal1",20,0,40,8),item("OhMalItem03","OhMalTrend1",0,8,60,18),item("OhMalItem04","OhMalRecent",0,26,30,16),item("OhMalItem05","OhMalTable1",30,26,30,16)]
 return {"visualizations":v,"dashboards":[{"id":"OhMalDash01","name":"OneHealth Malaria Confirmed Case Surveillance","description":"National annual confirmed malaria cases from WHO GHO. Public source series has national resolution; no subnational values are inferred.","publicAccess":"rw------","dashboardItems":items}]}
if __name__=="__main__":
 t=Path("dhis2/metadata/malaria_dashboard.json"); t.write_text(json.dumps(build(),indent=2)+"\n",encoding="utf-8"); print(f"Wrote {t}")
