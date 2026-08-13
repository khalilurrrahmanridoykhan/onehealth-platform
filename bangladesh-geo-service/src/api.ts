import { GeoStore } from './geoStore';
import { CrosswalkStore } from './crosswalkStore';

export interface ApiResponse {
  status: number;
  body: unknown;
}

function omitGeometry<T extends { geometry?: string }>(unit: T): Omit<T, 'geometry'> {
  const { geometry: _geometry, ...rest } = unit;
  return rest;
}

export function handleDivisions(geo: GeoStore): ApiResponse {
  return { status: 200, body: geo.divisions() };
}

export function handleDistricts(geo: GeoStore, divisionCode: string | undefined): ApiResponse {
  if (!divisionCode) return { status: 400, body: { error: 'query param "division" is required' } };
  const division = geo.get(divisionCode);
  if (!division || division.level !== 'division') {
    return { status: 404, body: { error: `unknown division code "${divisionCode}"` } };
  }
  return { status: 200, body: geo.childrenOf(divisionCode) };
}

export function handleUpazilas(geo: GeoStore, districtCode: string | undefined): ApiResponse {
  if (!districtCode) return { status: 400, body: { error: 'query param "district" is required' } };
  const district = geo.get(districtCode);
  if (!district || district.level !== 'district') {
    return { status: 404, body: { error: `unknown district code "${districtCode}"` } };
  }
  return { status: 200, body: geo.childrenOf(districtCode) };
}

export function handleUnions(geo: GeoStore, upazilaCode: string | undefined): ApiResponse {
  if (!upazilaCode) return { status: 400, body: { error: 'query param "upazila" is required' } };
  const upazila = geo.get(upazilaCode);
  if (!upazila || upazila.level !== 'upazila') {
    return { status: 404, body: { error: `unknown upazila code "${upazilaCode}"` } };
  }
  // Geometry omitted from list responses -- each union's boundary is several KB;
  // fetch /geo/union/:code?geometry=full for one union's full shape.
  return { status: 200, body: geo.childrenOf(upazilaCode).map(omitGeometry) };
}

export function handleUnionByCode(geo: GeoStore, code: string, includeGeometry: boolean): ApiResponse {
  const union = geo.get(code);
  if (!union || union.level !== 'union') {
    return { status: 404, body: { error: `unknown union code "${code}"` } };
  }
  return { status: 200, body: includeGeometry ? union : omitGeometry(union) };
}

export function handleCrosswalk(geo: GeoStore, crosswalk: CrosswalkStore, code: string): ApiResponse {
  const unit = geo.get(code);
  if (!unit) {
    return { status: 404, body: { error: `unknown admin code "${code}"` } };
  }
  if (unit.level !== 'division') {
    return {
      status: 404,
      body: {
        error: `no DHIS2 crosswalk for "${code}" (${unit.level} level)`,
        reason:
          'The OneHealth DHIS2 instance only has organisation units at national and division level today. ' +
          'District/upazila/union-level organisation units have not been created in DHIS2, so there is nothing ' +
          'real to crosswalk to below division level yet.',
      },
    };
  }
  const entry = crosswalk.get(code);
  if (!entry) {
    return { status: 404, body: { error: `division "${code}" has no crosswalk entry` } };
  }
  return { status: 200, body: entry };
}
