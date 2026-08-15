import { measles } from './measles';

describe('measles', () => {
  it('suspected: clinical triad met (fever + rash + cough)', () => {
    const r = measles.suspected({ fever: true, maculopapularRash: true, cough: true });
    expect(r.met).toBe(true);
  });

  it('suspected: not met with fever + rash but none of cough/coryza/conjunctivitis, and no clinician override', () => {
    const r = measles.suspected({ fever: true, maculopapularRash: true });
    expect(r.met).toBe(false);
    expect(r.missingCriteria.length).toBe(1);
  });

  it('suspected: clinician-override route works even without the classic triad', () => {
    const r = measles.suspected({ clinicianSuspectsMeasles: true });
    expect(r.met).toBe(true);
  });

  it('confirmed: met via lab IgM', () => {
    expect(measles.confirmed?.({ measlesIgmPositive: true }).met).toBe(true);
  });

  it('confirmed: met via epi link even without lab confirmation', () => {
    expect(measles.confirmed?.({ epiLinkConfirmedCaseOrOutbreak: true }).met).toBe(true);
  });
});
