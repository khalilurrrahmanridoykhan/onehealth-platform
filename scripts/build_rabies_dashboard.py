#!/usr/bin/env python3
"""Build native DHIS2 national human-rabies mortality dashboard."""
import json
from pathlib import Path

PERIODS=[str(y) for y in range(2015,2025)]
def dim(n,ids,k): return {"dimension":n,"items":[{"id":u,"dimensionItemType":k} for u in ids]}
def viz(uid,name,kind,columns,rows,filters,periods):
 return {"id":uid,"name":name,"type":kind,"publicAccess":"rw------","showData":True,"hideEmptyRows":True,"hideEmptyColumns":True,"showDimensionLabels":True,"columns":columns,"rows":rows,"filters":filters,"dataDimensionItems":[{"dataDimensionItemType":"DATA_ELEMENT","dataElement":{"id":"OhRabNatD01"}}],"organisationUnits":[{"id":"BdOrgUnit01"}],"periods":[{"id":p} for p in periods],"relativePeriods":{}}
def item(uid,obj,x,y,w,h): return {"id":uid,"i":uid,"type":"VISUALIZATION","x":x,"y":y,"w":w,"h":h,"width":w,"height":h,"visualization":{"id":obj}}
def build():
 dx=dim("dx",["OhRabNatD01"],"DATA_ELEMENT"); pea=dim("pe",PERIODS,"PERIOD"); pel=dim("pe",["2024"],"PERIOD"); post=dim("pe",[str(y) for y in range(2020,2025)],"PERIOD"); ou=dim("ou",["BdOrgUnit01"],"ORGANISATION_UNIT")
 v=[viz("OhRabLatest","Latest Reported Human Rabies Deaths — 2024","SINGLE_VALUE",[dx],[],[pel,ou],["2024"]),viz("OhRabTotal1","Cumulative Reported Rabies Deaths — 2015–2024","SINGLE_VALUE",[dx],[],[pea,ou],PERIODS),viz("OhRabTrend1","Human Rabies Reported Deaths — 2015–2024","LINE",[pea],[dx],[ou],PERIODS),viz("OhRabPost01","Post-2020 Reported Rabies Deaths","COLUMN",[post],[dx],[ou],[str(y) for y in range(2020,2025)]),viz("OhRabTable1","Human Rabies Annual Mortality Table","PIVOT_TABLE",[pea],[dx],[ou],PERIODS)]
 items=[item("OhRabItem01","OhRabLatest",0,0,20,8),item("OhRabItem02","OhRabTotal1",20,0,40,8),item("OhRabItem03","OhRabTrend1",0,8,60,18),item("OhRabItem04","OhRabPost01",0,26,30,16),item("OhRabItem05","OhRabTable1",30,26,30,16)]
 return {"visualizations":v,"dashboards":[{"id":"OhRabDash01","name":"OneHealth Human Rabies Mortality Surveillance","description":"National annual reported human rabies deaths from WHO GHO indicator NTD_RAB2. No division or district values are inferred.","publicAccess":"rw------","dashboardItems":items}]}
if __name__=="__main__":
 t=Path("dhis2/metadata/rabies_dashboard.json"); t.write_text(json.dumps(build(),indent=2)+"\n",encoding="utf-8"); print(f"Wrote {t}")
