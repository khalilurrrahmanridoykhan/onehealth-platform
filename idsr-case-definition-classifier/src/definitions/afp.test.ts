import { afp } from './afp';

describe('AFP (polio)', () => {
  it('suspected: met for a 10-year-old with sudden non-traumatic limb weakness', () => {
    const r = afp.suspected({ suddenOnsetLimbWeaknessOrFloppiness: true, limbWeaknessDueToTrauma: false, ageYears: 10 });
    expect(r.met).toBe(true);
  });

  it('suspected: not met at age 15 (boundary: source says "less than 15 years")', () => {
    const r = afp.suspected({ suddenOnsetLimbWeaknessOrFloppiness: true, ageYears: 15 });
    expect(r.met).toBe(false);
  });

  it('suspected: not met if the weakness is due to trauma', () => {
    const r = afp.suspected({ suddenOnsetLimbWeaknessOrFloppiness: true, limbWeaknessDueToTrauma: true, ageYears: 5 });
    expect(r.met).toBe(false);
  });

  it('suspected: an adult still qualifies via the clinician-suspects-polio route', () => {
    const r = afp.suspected({ ageYears: 40, clinicianSuspectsPolio: true });
    expect(r.met).toBe(true);
  });

  it('confirmed: met via poliovirus isolation', () => {
    expect(afp.confirmed?.({ poliovirusIsolatedStool: true }).met).toBe(true);
  });
});
