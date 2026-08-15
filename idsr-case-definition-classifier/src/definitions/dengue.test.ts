import { dengueFever, dengueHaemorrhagicFever, dengueShockSyndrome } from './dengue';

describe('dengue fever', () => {
  it('suspected: fever 2-7 days + 2 of the sign list', () => {
    const r = dengueFever.suspected({ fever: true, feverDurationDays: 4, headache: true, arthralgia: true });
    expect(r.met).toBe(true);
  });

  it('suspected: not met with only 1 of the sign list', () => {
    const r = dengueFever.suspected({ fever: true, feverDurationDays: 4, headache: true });
    expect(r.met).toBe(false);
  });

  it('suspected: not met outside the 2-7 day window (boundary: day 8)', () => {
    const r = dengueFever.suspected({ fever: true, feverDurationDays: 8, headache: true, arthralgia: true });
    expect(r.met).toBe(false);
  });

  it('confirmed: met via lab confirmation', () => {
    expect(dengueFever.confirmed?.({ dengueLabConfirmed: true }).met).toBe(true);
  });
});

describe('dengue haemorrhagic fever', () => {
  const dengueCase = { fever: true, feverDurationDays: 4, headache: true, arthralgia: true };

  it('suspected: met when built on a suspected dengue case + bleeding + thrombocytopenia + plasma leak', () => {
    const r = dengueHaemorrhagicFever.suspected({
      ...dengueCase,
      positiveTourniquetTest: true,
      plateletCountPerMm3: 90_000,
      plasmaLeakSigns: true,
    });
    expect(r.met).toBe(true);
  });

  it('suspected: not met without an underlying dengue fever case', () => {
    const r = dengueHaemorrhagicFever.suspected({
      positiveTourniquetTest: true,
      plateletCountPerMm3: 90_000,
      plasmaLeakSigns: true,
    });
    expect(r.met).toBe(false);
  });

  it('suspected: not met if platelet count is above the 100,000/mm3 threshold', () => {
    const r = dengueHaemorrhagicFever.suspected({
      ...dengueCase,
      positiveTourniquetTest: true,
      plateletCountPerMm3: 150_000,
      plasmaLeakSigns: true,
    });
    expect(r.met).toBe(false);
  });
});

describe('dengue shock syndrome', () => {
  const dhfCase = {
    fever: true,
    feverDurationDays: 4,
    headache: true,
    arthralgia: true,
    positiveTourniquetTest: true,
    plateletCountPerMm3: 90_000,
    plasmaLeakSigns: true,
  };

  it('suspected: met when DHF criteria plus circulatory failure are present', () => {
    const r = dengueShockSyndrome.suspected({
      ...dhfCase,
      rapidWeakPulse: true,
      pulsePressureMmHg: 15,
      coldClammySkin: true,
      alteredMentalStatus: true,
    });
    expect(r.met).toBe(true);
  });

  it('suspected: not met without circulatory failure, even with full DHF criteria', () => {
    const r = dengueShockSyndrome.suspected(dhfCase);
    expect(r.met).toBe(false);
  });
});
