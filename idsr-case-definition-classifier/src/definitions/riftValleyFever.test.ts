import { riftValleyFever } from './riftValleyFever';

describe('rift valley fever', () => {
  it('suspected: met via the animal-exposure route', () => {
    const r = riftValleyFever.suspected({
      feverAxillaryC: 38.0,
      feverDurationHours: 72,
      unresponsiveToAntibioticOrAntimalarial: true,
      headache: true,
      contactWithSickOrDeadAnimal: true,
    });
    expect(r.met).toBe(true);
  });

  it('suspected: met via the severe-complications route, with no animal exposure at all', () => {
    const r = riftValleyFever.suspected({
      feverAxillaryC: 38.0,
      feverDurationHours: 72,
      unresponsiveToAntibioticOrAntimalarial: true,
      headache: true,
      nauseaVomiting: true,
      hemoglobinGdL: 6,
    });
    expect(r.met).toBe(true);
  });

  it('suspected: not met if the fever does not clear either temperature threshold', () => {
    const r = riftValleyFever.suspected({
      feverAxillaryC: 37.0,
      feverDurationHours: 72,
      unresponsiveToAntibioticOrAntimalarial: true,
      headache: true,
      contactWithSickOrDeadAnimal: true,
    });
    expect(r.met).toBe(false);
  });

  it('suspected: not met with neither an exposure link nor a severe-complications picture', () => {
    const r = riftValleyFever.suspected({
      feverAxillaryC: 38.0,
      feverDurationHours: 72,
      unresponsiveToAntibioticOrAntimalarial: true,
      headache: true,
    });
    expect(r.met).toBe(false);
  });

  it('confirmed: met via IgM ELISA or RT-PCR', () => {
    expect(riftValleyFever.confirmed?.({ rvfIgmOrPcrPositive: true }).met).toBe(true);
  });
});
