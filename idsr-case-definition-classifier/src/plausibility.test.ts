/**
 * A real-world plausibility pass, in the same spirit as the Farrington
 * outbreak detector's Omicron-wave check: does this classifier actually
 * work against something grounded in a real, documented event, not just
 * hand-built synthetic fixtures?
 *
 * Honest caveat, stated here rather than glossed over: WHO's own outbreak
 * reporting (Disease Outbreak News, situation reports) publishes aggregate
 * case counts and epidemiological summaries, not itemized per-patient
 * symptom checklists -- there is no public "here is exactly what patient
 * #4127 reported" dataset to import directly. So each case below is a
 * realistic, textbook-consistent clinical presentation for the disease,
 * deliberately grounded in a real, cited, currently-ongoing or recent
 * outbreak rather than an arbitrary made-up scenario -- a lighter-weight
 * check than the data-heavy sibling projects' verification passes, and
 * presented as such.
 */
import { classifyAgainst } from './classify';
import { cholera } from './definitions/cholera';
import { measles } from './definitions/measles';
import { meningitis } from './definitions/meningitis';

describe('real-world plausibility pass', () => {
  it('classifies a textbook cholera presentation as suspected, grounded in the 2025 multi-country cholera outbreak (614,828 cases across 33 countries, WHO epidemiological update #33, 27 Jan 2026)', () => {
    const result = classifyAgainst(
      {
        ageYears: 28,
        acuteWateryDiarrhea: true,
        diarrheaEpisodesPer24h: 6,
        vomiting: true,
      },
      cholera,
    );
    expect(result.tier).toBe('suspected');
  });

  it('classifies a textbook measles presentation as suspected, grounded in the real 2025 global resurgence (108,074 confirmed cases globally as of July 2025, WHO DON #561 -- the largest measles year in the US since 1991)', () => {
    const result = classifyAgainst(
      {
        fever: true,
        maculopapularRash: true,
        cough: true,
        coryza: true,
        conjunctivitis: true,
      },
      measles,
    );
    expect(result.tier).toBe('suspected');
  });

  it('classifies a textbook meningococcal meningitis presentation as suspected, grounded in the real 2026 Kent, UK meningitis B outbreak (21 confirmed N. meningitidis serogroup B cases)', () => {
    const result = classifyAgainst(
      {
        suddenOnsetFever: true,
        feverAxillaryC: 39.2,
        neckStiffness: true,
        alteredConsciousness: true,
      },
      meningitis,
    );
    expect(result.tier).toBe('suspected');
  });

  it('does NOT classify a plausible but genuinely unrelated presentation (a common cold) as any of the three diseases above -- a real negative control', () => {
    const commonCold = { cough: true, coryza: true, soreThroat: true };
    expect(classifyAgainst(commonCold, cholera).tier).toBeNull();
    expect(classifyAgainst(commonCold, measles).tier).toBeNull(); // no fever, no rash
    expect(classifyAgainst(commonCold, meningitis).tier).toBeNull();
  });
});
