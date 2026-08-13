import { GeoStore, DEFAULT_ADMIN_GEO_PATH } from './geoStore';
import { CrosswalkStore, DEFAULT_CROSSWALK_PATH } from './crosswalkStore';
import {
  handleCrosswalk,
  handleDistricts,
  handleDivisions,
  handleUnionByCode,
  handleUnions,
  handleUpazilas,
} from './api';

const geo = GeoStore.fromFile(DEFAULT_ADMIN_GEO_PATH);
const crosswalk = CrosswalkStore.fromFile(DEFAULT_CROSSWALK_PATH);

describe('api handlers against real data', () => {
  it('GET /geo/division lists all 8 real divisions', () => {
    const res = handleDivisions(geo);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(8);
  });

  it('GET /geo/district?division=div_30 returns Faridpur among Dhaka\'s districts', () => {
    const res = handleDistricts(geo, 'div_30');
    expect(res.status).toBe(200);
    expect((res.body as { code: string }[]).some((d) => d.code === 'dis_3029')).toBe(true);
  });

  it('GET /geo/district with no division param is a 400', () => {
    const res = handleDistricts(geo, undefined);
    expect(res.status).toBe(400);
  });

  it('GET /geo/district?division=uni_302921175 (wrong level) is a 404', () => {
    const res = handleDistricts(geo, 'uni_302921175');
    expect(res.status).toBe(404);
  });

  it('GET /geo/upazila?district=dis_3029 returns Char Bhadrasan upazila', () => {
    const res = handleUpazilas(geo, 'dis_3029');
    expect(res.status).toBe(200);
    expect((res.body as { code: string }[]).some((u) => u.code === 'upa_302921')).toBe(true);
  });

  it('GET /geo/union?upazila=upa_302921 returns Char Bhadrasan union without geometry', () => {
    const res = handleUnions(geo, 'upa_302921');
    expect(res.status).toBe(200);
    const union = (res.body as { code: string; geometry?: string }[]).find(
      (u) => u.code === 'uni_302921175',
    );
    expect(union).toBeDefined();
    expect(union?.geometry).toBeUndefined();
  });

  it('GET /geo/union/:code omits geometry by default', () => {
    const res = handleUnionByCode(geo, 'uni_302921175', false);
    expect(res.status).toBe(200);
    expect((res.body as { geometry?: string }).geometry).toBeUndefined();
  });

  it('GET /geo/union/:code?geometry=full includes the real boundary', () => {
    const res = handleUnionByCode(geo, 'uni_302921175', true);
    expect(res.status).toBe(200);
    expect((res.body as { geometry?: string }).geometry).toContain(';');
  });

  it('GET /geo/union/:code for an unknown code is a 404', () => {
    const res = handleUnionByCode(geo, 'uni_nonexistent', false);
    expect(res.status).toBe(404);
  });

  it('GET /geo/crosswalk/div_30 resolves to the real Dhaka DHIS2 UID', () => {
    const res = handleCrosswalk(geo, crosswalk, 'div_30');
    expect(res.status).toBe(200);
    expect((res.body as { dhis2OrgUnitUid: string }).dhis2OrgUnitUid).toBe('BdDivDha001');
  });

  it('GET /geo/crosswalk/uni_302921175 (below division level) is an honest 404, not a silent miss', () => {
    const res = handleCrosswalk(geo, crosswalk, 'uni_302921175');
    expect(res.status).toBe(404);
    expect((res.body as { reason: string }).reason).toMatch(/national and division level/);
  });

  it('GET /geo/crosswalk/does_not_exist is a 404', () => {
    const res = handleCrosswalk(geo, crosswalk, 'does_not_exist');
    expect(res.status).toBe(404);
  });
});
