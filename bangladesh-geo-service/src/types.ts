export type AdminLevel = 'division' | 'district' | 'upazila' | 'union';

export interface AdminUnit {
  code: string; // e.g. "div_30", "dis_1004", "upa_100409", "uni_100409109"
  level: AdminLevel;
  name: string;
  parentCode: string | null;
  latitude: number;
  longitude: number;
  /** Union-level only: XForms geoshape string, "lat lon alt acc;...;lat lon alt acc" (closed ring). */
  geometry?: string;
}

export interface CrosswalkEntry {
  geoCode: string; // AdminUnit.code, division-level only today
  dhis2OrgUnitUid: string;
  dhis2OrgUnitName: string;
  /** Source disease mapping file(s) this UID was confirmed against, e.g. ["dengue", "measles"]. */
  confirmedInMappings: string[];
}
