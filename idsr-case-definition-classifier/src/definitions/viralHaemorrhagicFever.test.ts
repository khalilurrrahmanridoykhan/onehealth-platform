import { viralHaemorrhagicFever } from './viralHaemorrhagicFever';

describe('viral haemorrhagic fever syndrome', () => {
  it('suspected: met with fever <3 weeks + severely ill + 2 haemorrhagic signs + no predisposing factors', () => {
    const r = viralHaemorrhagicFever.suspected({
      fever: true,
      feverDurationDays: 10,
      severelyIll: true,
      epistaxis: true,
      haematemesis: true,
      noKnownPredisposingFactorsForBleeding: true,
    });
    expect(r.met).toBe(true);
  });

  it('suspected: not met with only 1 haemorrhagic sign', () => {
    const r = viralHaemorrhagicFever.suspected({
      fever: true,
      feverDurationDays: 10,
      severelyIll: true,
      epistaxis: true,
      noKnownPredisposingFactorsForBleeding: true,
    });
    expect(r.met).toBe(false);
  });

  it('suspected: not met beyond the 3-week window (boundary: 21 days)', () => {
    const r = viralHaemorrhagicFever.suspected({
      fever: true,
      feverDurationDays: 21,
      severelyIll: true,
      epistaxis: true,
      haematemesis: true,
      noKnownPredisposingFactorsForBleeding: true,
    });
    expect(r.met).toBe(false);
  });

  it('confirmed: met via lab confirmation or epi link', () => {
    expect(viralHaemorrhagicFever.confirmed?.({ vhfLabConfirmed: true }).met).toBe(true);
    expect(viralHaemorrhagicFever.confirmed?.({ epiLinkConfirmedCaseOrOutbreak: true }).met).toBe(true);
  });
});
