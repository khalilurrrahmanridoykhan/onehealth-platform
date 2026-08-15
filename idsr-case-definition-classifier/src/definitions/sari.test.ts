import { sari } from './sari';

describe('SARI', () => {
  it('suspected: met via the clinical route (age >=5, severely ill, fever, cough, shortness of breath)', () => {
    const r = sari.suspected({
      ageYears: 30,
      severelyIll: true,
      suddenOnsetFever: true,
      cough: true,
      shortnessOfBreath: true,
    });
    expect(r.met).toBe(true);
  });

  it('suspected: sore throat substitutes for cough (source says "cough or sore throat")', () => {
    const r = sari.suspected({
      ageYears: 30,
      severelyIll: true,
      suddenOnsetFever: true,
      soreThroat: true,
      shortnessOfBreath: true,
    });
    expect(r.met).toBe(true);
  });

  it('suspected: met via the death route alone, with nothing else filled in', () => {
    const r = sari.suspected({ diedOfUnexplainedRespiratoryIllness: true });
    expect(r.met).toBe(true);
  });

  it('suspected: not met without shortness of breath (clinical route incomplete)', () => {
    const r = sari.suspected({ ageYears: 30, severelyIll: true, suddenOnsetFever: true, cough: true });
    expect(r.met).toBe(false);
  });

  it('has no confirmed tier at all, matching the source', () => {
    expect(sari.confirmed).toBeUndefined();
  });
});
