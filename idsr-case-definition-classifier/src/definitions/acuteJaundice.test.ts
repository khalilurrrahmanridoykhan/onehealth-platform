import { acuteJaundice } from './acuteJaundice';

describe('acute jaundice', () => {
  it('suspected: met with jaundice onset within 14 days, fever not required', () => {
    const r = acuteJaundice.suspected({ jaundice: true, jaundiceOnsetDays: 5 });
    expect(r.met).toBe(true);
  });

  it('suspected: not met with jaundice onset beyond 14 days (boundary: day 15)', () => {
    const r = acuteJaundice.suspected({ jaundice: true, jaundiceOnsetDays: 15 });
    expect(r.met).toBe(false);
  });

  it('confirmed: met via etiological lab confirmation', () => {
    expect(acuteJaundice.confirmed?.({ etiologicalLabConfirmedJaundice: true }).met).toBe(true);
  });
});
