import { anthrax } from './anthrax';

describe('anthrax', () => {
  it('suspected: cutaneous form + animal exposure link', () => {
    const r = anthrax.suspected({ cutaneousLesionEschar: true, epiLinkAnimalCase: true });
    expect(r.met).toBe(true);
  });

  it('suspected: GI form (abdominal distress + fever) + exposure link', () => {
    const r = anthrax.suspected({
      abdominalDistress: true,
      nauseaVomiting: true,
      anorexia: true,
      fever: true,
      epiLinkAnimalCase: true,
    });
    expect(r.met).toBe(true);
  });

  it('suspected: not met without the animal exposure link, even with a clear cutaneous lesion', () => {
    const r = anthrax.suspected({ cutaneousLesionEschar: true });
    expect(r.met).toBe(false);
    expect(r.missingCriteria).toContain(
      'epidemiological link to a confirmed/suspected animal case or contaminated animal product',
    );
  });

  it('confirmed: met via tissue isolation', () => {
    expect(anthrax.confirmed?.({ bAnthracisIsolatedFromTissue: true }).met).toBe(true);
  });
});
