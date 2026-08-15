import { classifyAgainst, classifyAll } from './classify';
import { cholera } from './definitions/cholera';

describe('classifyAgainst', () => {
  it('tier is null when not even suspected criteria are met', () => {
    const r = classifyAgainst({}, cholera);
    expect(r.tier).toBeNull();
  });

  it('tier is "suspected" when suspected criteria are met but confirmed are not', () => {
    const r = classifyAgainst({ ageYears: 5, acuteWateryDiarrhea: true, diarrheaEpisodesPer24h: 3 }, cholera);
    expect(r.tier).toBe('suspected');
  });

  it('tier is "confirmed" only when BOTH suspected and confirmed criteria are met -- never confirmed alone', () => {
    // Lab isolation without the clinical picture: the source's own "A
    // suspected case in which..." wording makes confirmed dependent on
    // suspected, so this should NOT read as confirmed.
    const r = classifyAgainst({ vCholeraeO1O139IsolatedStool: true }, cholera);
    expect(r.tier).toBeNull();

    const full = classifyAgainst(
      { ageYears: 5, acuteWateryDiarrhea: true, diarrheaEpisodesPer24h: 3, vCholeraeO1O139IsolatedStool: true },
      cholera,
    );
    expect(full.tier).toBe('confirmed');
  });
});

describe('classifyAll', () => {
  it('returns every definition that matches at "suspected" or higher, not just the first', () => {
    // A record built to plausibly match both measles and SARI at once.
    const results = classifyAll({
      fever: true,
      maculopapularRash: true,
      cough: true,
      ageYears: 30,
      severelyIll: true,
      suddenOnsetFever: true,
      shortnessOfBreath: true,
    });
    const ids = results.map((r) => r.diseaseId);
    expect(ids).toContain('measles');
    expect(ids).toContain('sari');
  });

  it('returns an empty array for a blank patient record', () => {
    expect(classifyAll({})).toEqual([]);
  });
});
