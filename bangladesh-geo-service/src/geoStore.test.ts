import { GeoStore, DEFAULT_ADMIN_GEO_PATH } from './geoStore';

// Loads the real, checked-in data/admin-geo.json (generated from the
// bangladesh-admin-boundary-xlsform project's validated choices sheet) --
// not a synthetic fixture, the actual shipped dataset.
const geo = GeoStore.fromFile(DEFAULT_ADMIN_GEO_PATH);

describe('GeoStore against real admin-geo.json', () => {
  it('has exactly 8 divisions', () => {
    expect(geo.divisions()).toHaveLength(8);
  });

  it('resolves the real Dhaka -> Faridpur -> Char Bhadrasan chain', () => {
    const division = geo.get('div_30');
    expect(division?.name).toBe('Dhaka');

    const districts = geo.childrenOf('div_30');
    const faridpur = districts.find((d) => d.code === 'dis_3029');
    expect(faridpur?.name).toBe('Faridpur');

    const upazilas = geo.childrenOf('dis_3029');
    const charBhadrasanUpazila = upazilas.find((u) => u.code === 'upa_302921');
    expect(charBhadrasanUpazila?.name).toBe('Char Bhadrasan');

    const unions = geo.childrenOf('upa_302921');
    const charBhadrasanUnion = unions.find((u) => u.code === 'uni_302921175');
    expect(charBhadrasanUnion?.name).toBe('Char Bhadrasan');
  });

  it('matches the field-verified KoboCollect coordinates for Char Bhadrasan union', () => {
    // Confirmed live in KoboCollect on Android: lat 23.571876, lon 89.9895.
    const union = geo.get('uni_302921175');
    expect(union?.latitude).toBeCloseTo(23.571876, 5);
    expect(union?.longitude).toBeCloseTo(89.9895, 5);
  });

  it('gives Char Bhadrasan union a closed-ring geoshape', () => {
    const union = geo.get('uni_302921175');
    expect(union?.geometry).toBeDefined();
    const points = union!.geometry!.split(';');
    expect(points.length).toBeGreaterThan(2);
    expect(points[0]).toBe(points[points.length - 1]);
  });

  it('returns undefined for an unknown code', () => {
    expect(geo.get('uni_does_not_exist')).toBeUndefined();
  });

  it('returns an empty array for a code with no children', () => {
    expect(geo.childrenOf('uni_302921175')).toEqual([]);
  });
});
