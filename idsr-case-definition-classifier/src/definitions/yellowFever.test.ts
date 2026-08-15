import { yellowFever } from './yellowFever';

describe('yellow fever', () => {
  it('suspected: met with fever + jaundice within the 2-week window', () => {
    const r = yellowFever.suspected({ suddenOnsetFever: true, jaundiceWithin2WeeksOfFeverOnset: true });
    expect(r.met).toBe(true);
  });

  it('suspected: not met with fever alone, no jaundice', () => {
    const r = yellowFever.suspected({ suddenOnsetFever: true });
    expect(r.met).toBe(false);
  });

  it('confirmed: met via lab confirmation', () => {
    expect(yellowFever.confirmed?.({ yellowFeverLabConfirmed: true }).met).toBe(true);
  });

  it('confirmed: met via epi link alone', () => {
    expect(yellowFever.confirmed?.({ epiLinkConfirmedCaseOrOutbreak: true }).met).toBe(true);
  });
});
