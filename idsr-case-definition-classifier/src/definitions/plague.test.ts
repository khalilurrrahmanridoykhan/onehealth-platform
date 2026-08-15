import { plague } from './plague';

describe('plague', () => {
  it('suspected: met via the bubonic-like route', () => {
    const r = plague.suspected({
      suddenOnsetFever: true,
      chills: true,
      headache: true,
      severeMalaise: true,
      prostration: true,
      painfulLymphNodeSwelling: true,
    });
    expect(r.met).toBe(true);
  });

  it('suspected: met via the pneumonic-like route, without any lymph node involvement', () => {
    const r = plague.suspected({ bloodStainedSputumCough: true, chestPain: true, shortnessOfBreath: true });
    expect(r.met).toBe(true);
  });

  it('suspected: not met with only some of the bubonic-route signs and none of the pneumonic route', () => {
    const r = plague.suspected({ suddenOnsetFever: true, chills: true, headache: true });
    expect(r.met).toBe(false);
  });

  it('confirmed: met via isolation, or via epi link alone', () => {
    expect(plague.confirmed?.({ yPestisIsolated: true }).met).toBe(true);
    expect(plague.confirmed?.({ epiLinkConfirmedCaseOrOutbreak: true }).met).toBe(true);
  });
});
