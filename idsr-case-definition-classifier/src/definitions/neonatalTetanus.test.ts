import { neonatalTetanus } from './neonatalTetanus';

describe('neonatal tetanus', () => {
  it('suspected: met for a day-10 newborn who sucked/cried normally at first, now stiff', () => {
    const r = neonatalTetanus.suspected({
      normalSuckCryFirst2Days: true,
      ageDays: 10,
      cannotSuckNormallyAfterDay3: true,
      stiffness: true,
    });
    expect(r.met).toBe(true);
  });

  it('suspected: not met outside the day-3-to-28 window (boundary: day 29)', () => {
    const r = neonatalTetanus.suspected({
      normalSuckCryFirst2Days: true,
      ageDays: 29,
      cannotSuckNormallyAfterDay3: true,
      convulsions: true,
    });
    expect(r.met).toBe(false);
  });

  it('confirmed: identical to suspected per the source ("same as for suspected case")', () => {
    const input = { normalSuckCryFirst2Days: true, ageDays: 10, cannotSuckNormallyAfterDay3: true, convulsions: true };
    expect(neonatalTetanus.confirmed?.(input).met).toBe(neonatalTetanus.suspected(input).met);
  });
});
