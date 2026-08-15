import { rabies } from './rabies';

describe('rabies', () => {
  it('suspected: met from an animal bite alone, with no accompanying symptoms (source says "with or without")', () => {
    const r = rabies.suspected({ animalBiteOrScratch: true });
    expect(r.met).toBe(true);
  });

  it('suspected: met from saliva contact alone', () => {
    const r = rabies.suspected({ contactWithSalivaFromSuspectedRabidAnimal: true });
    expect(r.met).toBe(true);
  });

  it('suspected: not met from symptoms alone with no exposure', () => {
    const r = rabies.suspected({ hydrophobia: true, fever: true });
    expect(r.met).toBe(false);
  });

  it('confirmed: met via viral isolation', () => {
    expect(rabies.confirmed?.({ rabiesVirusIsolated: true }).met).toBe(true);
  });
});
