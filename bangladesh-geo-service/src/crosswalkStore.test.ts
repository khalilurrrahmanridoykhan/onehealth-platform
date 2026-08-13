import { CrosswalkStore, DEFAULT_CROSSWALK_PATH } from './crosswalkStore';

// Real, checked-in data/dhis2-crosswalk.json, generated from the OneHealth
// DHIS2 instance's own disease mapping files -- not a synthetic fixture.
const crosswalk = CrosswalkStore.fromFile(DEFAULT_CROSSWALK_PATH);

describe('CrosswalkStore against real dhis2-crosswalk.json', () => {
  it('resolves Dhaka to its real DHIS2 organisation unit UID', () => {
    const entry = crosswalk.get('div_30');
    expect(entry?.dhis2OrgUnitUid).toBe('BdDivDha001');
    expect(entry?.dhis2OrgUnitName).toBe('Dhaka');
  });

  it('has all 8 divisions crosswalked', () => {
    const codes = ['div_10', 'div_20', 'div_30', 'div_40', 'div_45', 'div_50', 'div_55', 'div_60'];
    for (const code of codes) {
      expect(crosswalk.get(code)).toBeDefined();
    }
  });

  it('returns undefined for a code with no crosswalk entry', () => {
    expect(crosswalk.get('dis_3029')).toBeUndefined();
  });
});
