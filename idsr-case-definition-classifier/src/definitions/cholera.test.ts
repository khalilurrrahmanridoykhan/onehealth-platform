import { cholera } from './cholera';

describe('cholera', () => {
  it('suspected: non-epidemic route met at age 5+ with >=3 watery stools/24h', () => {
    const r = cholera.suspected({ ageYears: 5, acuteWateryDiarrhea: true, diarrheaEpisodesPer24h: 3 });
    expect(r.met).toBe(true);
  });

  it('suspected: not met at age 4 outside an epidemic (misses the age-5 threshold)', () => {
    const r = cholera.suspected({ ageYears: 4, acuteWateryDiarrhea: true, diarrheaEpisodesPer24h: 5 });
    expect(r.met).toBe(false);
  });

  it('suspected: epidemic route met at age 2 without an episode-count threshold', () => {
    const r = cholera.suspected({ ageYears: 2, choleraEpidemicDeclared: true, acuteWateryDiarrhea: true });
    expect(r.met).toBe(true);
  });

  it('suspected: age 1 fails even during a declared epidemic', () => {
    const r = cholera.suspected({ ageYears: 1, choleraEpidemicDeclared: true, acuteWateryDiarrhea: true });
    expect(r.met).toBe(false);
  });

  it('confirmed: met with lab isolation', () => {
    const r = cholera.confirmed?.({ vCholeraeO1O139IsolatedStool: true });
    expect(r?.met).toBe(true);
  });

  it('confirmed: not met without lab isolation or epi link', () => {
    const r = cholera.confirmed?.({});
    expect(r?.met).toBe(false);
  });
});
