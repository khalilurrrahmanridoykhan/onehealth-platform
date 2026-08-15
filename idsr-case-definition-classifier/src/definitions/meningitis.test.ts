import { meningitis } from './meningitis';

describe('meningococcal meningitis', () => {
  it('suspected: met with fever above rectal threshold + neck stiffness', () => {
    const r = meningitis.suspected({ suddenOnsetFever: true, feverRectalC: 39.0, neckStiffness: true });
    expect(r.met).toBe(true);
  });

  it('suspected: met with fever above axillary threshold + altered consciousness', () => {
    const r = meningitis.suspected({ suddenOnsetFever: true, feverAxillaryC: 38.2, alteredConsciousness: true });
    expect(r.met).toBe(true);
  });

  it('suspected: not met if fever is below both thresholds (boundary case)', () => {
    const r = meningitis.suspected({ suddenOnsetFever: true, feverAxillaryC: 38.0, neckStiffness: true });
    expect(r.met).toBe(false); // source says ">38.0", exactly 38.0 does not qualify
  });

  it('suspected: not met with fever alone, no meningeal sign', () => {
    const r = meningitis.suspected({ suddenOnsetFever: true, feverRectalC: 39.0 });
    expect(r.met).toBe(false);
    expect(r.missingCriteria).toContain('neck stiffness, altered consciousness, or other meningeal signs');
  });

  it('confirmed: met with CSF/blood isolation', () => {
    expect(meningitis.confirmed?.({ nMeningitidisIsolatedCsfOrBlood: true }).met).toBe(true);
  });
});
