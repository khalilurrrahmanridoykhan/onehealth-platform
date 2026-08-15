import { bloodyDiarrhea } from './bloodyDiarrhea';

describe('bloody diarrhea (Shigella dysentery)', () => {
  it('suspected: met with visible blood in stool', () => {
    expect(bloodyDiarrhea.suspected({ diarrheaWithVisibleBlood: true }).met).toBe(true);
  });

  it('suspected: not met with plain diarrhea (no visible blood)', () => {
    expect(bloodyDiarrhea.suspected({ diarrhea: true }).met).toBe(false);
  });

  it('confirmed: met via positive stool culture', () => {
    expect(bloodyDiarrhea.confirmed?.({ shigellaDysenteriaeType1Cultured: true }).met).toBe(true);
  });
});
