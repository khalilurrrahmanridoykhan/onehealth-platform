import { malariaSevere, malariaUncomplicated } from './malaria';

describe('malaria (uncomplicated)', () => {
  it('suspected: fever + clinical diagnosis + no severe signs', () => {
    const r = malariaUncomplicated.suspected({ fever: true, diagnosedClinicallyAsMalaria: true });
    expect(r.met).toBe(true);
  });

  it('suspected: not met if severe-disease signs are present (that belongs to the severe category instead)', () => {
    const r = malariaUncomplicated.suspected({ fever: true, diagnosedClinicallyAsMalaria: true, signsOfSevereDisease: true });
    expect(r.met).toBe(false);
  });

  it('confirmed: met via a positive blood film', () => {
    expect(malariaUncomplicated.confirmed?.({ fever: true, malariaBloodFilmOrTestPositive: true }).met).toBe(true);
  });
});

describe('malaria (severe)', () => {
  it('suspected: met when hospitalized with severe febrile disease and organ dysfunction', () => {
    const r = malariaSevere.suspected({ hospitalized: true, fever: true, signsOfSevereDisease: true });
    expect(r.met).toBe(true);
  });

  it('suspected: not met if not hospitalized', () => {
    const r = malariaSevere.suspected({ fever: true, signsOfSevereDisease: true });
    expect(r.met).toBe(false);
  });

  it('confirmed: met via lab-confirmed parasitaemia plus severe signs', () => {
    const r = malariaSevere.confirmed?.({ plasmodiumParasitaemiaConfirmed: true, signsOfSevereDisease: true });
    expect(r?.met).toBe(true);
  });
});
