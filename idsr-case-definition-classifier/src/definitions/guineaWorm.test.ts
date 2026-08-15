import { guineaWorm } from './guineaWorm';

describe('guinea worm disease', () => {
  it('suspected: met with a lesion + living in a high-risk area', () => {
    const r = guineaWorm.suspected({ skinLesionBlisterOrBoil: true, livesInHighRiskGuineaWormArea: true });
    expect(r.met).toBe(true);
  });

  it('suspected: met with a lesion + travel history instead of residence', () => {
    const r = guineaWorm.suspected({ skinLesionBlisterOrBoil: true, travelToGuineaWormEndemicArea: true });
    expect(r.met).toBe(true);
  });

  it('suspected: not met without a lesion, even with residence in a high-risk area', () => {
    const r = guineaWorm.suspected({ livesInHighRiskGuineaWormArea: true });
    expect(r.met).toBe(false);
  });

  it('confirmed: requires the worm to have actually emerged, not just a lesion', () => {
    expect(guineaWorm.confirmed?.({ skinLesionBlisterOrBoil: true }).met).toBe(false);
    expect(guineaWorm.confirmed?.({ skinLesionBlisterOrBoil: true, wormEmergedFromLesion: true }).met).toBe(true);
  });
});
