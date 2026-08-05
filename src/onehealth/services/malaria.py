import csv
from datetime import date
from pathlib import Path
from onehealth.services.measles import HEADER

SOURCE_NAME="WHO Global Health Observatory — confirmed malaria cases"

def normalize_malaria(source_path:Path,output:Path)->int:
 rows=[]
 with source_path.open(encoding="utf-8-sig",newline="") as handle:
  for source in csv.DictReader(handle):
   year=int(source["year"]); rows.append({"disease_code":"MALARIA","disease_name":"Malaria","period_start":date(year,1,1).isoformat(),"period_end":date(year,12,31).isoformat(),"period_type":"annual","period_label":str(year),"location_code":"BD","location_name":"Bangladesh","location_level":"national","cases":int(source["confirmed_cases"]),"deaths":"","population":"","incidence_per_100k":"","data_status":"who_reported_confirmed_cases","source_name":SOURCE_NAME,"source_url":source["source_url"],"complete_period":"True"})
 output.parent.mkdir(parents=True,exist_ok=True)
 with output.open("w",encoding="utf-8",newline="") as handle:
  writer=csv.DictWriter(handle,fieldnames=HEADER,lineterminator="\n"); writer.writeheader(); writer.writerows(rows)
 return len(rows)
