import { DiseaseDefinition, PatientInput } from '../types';
import { evaluate } from './criteria';

const SOURCE =
  "Kenya MOH IDSR Standard Case Definitions (WHO AFRO IDSR 3rd ed.): " +
  '"Dengue Fever Suspected case: Any person with acute febrile illness of 2-7 days duration with 2 or more ' +
  'of the following: headache, retro-orbital pain, myalgia, arthralgia, rash, haemorrhagic manifestations, ' +
  'leucopenia. Dengue Fever Confirmed case: A suspected case with laboratory confirmation... Dengue ' +
  'Haemorrhagic Fever: A probable or confirmed case of dengue with bleeding tendencies as evidenced by one ' +
  'or more of [...]; and thrombocytopenia (100 000 cells or less per mm3) and evidence of plasma leakage ' +
  '[...]. Dengue Shock Syndrome: All the above criteria, plus evidence of circulatory failure [...]."';

// The source is a real escalating ladder (DF -> DHF -> DSS), but DHF and DSS
// are each their own standalone case definitions built on top of the
// previous one -- not simply a stronger "probable"/"confirmed" tier of the
// same case definition the way most other diseases in this source are
// structured. Modeled as three separate DiseaseDefinitions for that reason,
// the same design choice made for malaria's uncomplicated/severe split.

export const dengueFever: DiseaseDefinition = {
  id: 'dengue-fever',
  name: 'Dengue Fever',
  source: SOURCE,
  suspected: (input: PatientInput) => {
    const durationOk = (input.feverDurationDays ?? -1) >= 2 && (input.feverDurationDays ?? 99) <= 7;
    const signCount = [
      input.headache,
      input.retroOrbitalPain,
      input.musclePains, // myalgia
      input.arthralgia,
      input.rash,
      input.hemorrhagicOrPurpuricRash, // stands in for "haemorrhagic manifestations"
      input.leucopenia,
    ].filter(Boolean).length;

    return evaluate([
      { label: 'acute febrile illness, 2-7 days duration', met: !!input.fever && durationOk },
      { label: '>=2 of: headache, retro-orbital pain, myalgia, arthralgia, rash, haemorrhagic manifestations, leucopenia', met: signCount >= 2 },
    ]);
  },
  confirmed: (input: PatientInput) =>
    evaluate([{ label: 'lab confirmation (IgM, rising IgG, PCR, or viral isolation)', met: !!input.dengueLabConfirmed }]),
};

export const dengueHaemorrhagicFever: DiseaseDefinition = {
  id: 'dengue-haemorrhagic-fever',
  name: 'Dengue Haemorrhagic Fever',
  source: SOURCE,
  suspected: (input: PatientInput) => {
    const isDengue = dengueFever.suspected(input).met || (dengueFever.confirmed?.(input).met ?? false);
    const bleedingEvidence =
      !!input.positiveTourniquetTest ||
      !!input.petechiaeEcchymosesPurpura ||
      !!input.bleedingMucosaGiOrInjectionSite ||
      !!input.haematemesis;
    const thrombocytopenia = (input.plateletCountPerMm3 ?? 999999) <= 100000;
    const plasmaLeak =
      !!input.hematocritRise20PercentForAgeSex ||
      !!input.hematocritDrop20PercentAfterFluidReplacement ||
      !!input.plasmaLeakSigns;

    return evaluate([
      { label: 'is a probable or confirmed dengue fever case', met: isDengue },
      { label: 'bleeding tendency (tourniquet test, petechiae/purpura, mucosal/GI bleeding, or haematemesis)', met: bleedingEvidence },
      { label: 'thrombocytopenia (<=100,000/mm3)', met: thrombocytopenia },
      { label: 'evidence of plasma leakage', met: plasmaLeak },
    ]);
  },
};

export const dengueShockSyndrome: DiseaseDefinition = {
  id: 'dengue-shock-syndrome',
  name: 'Dengue Shock Syndrome',
  source: SOURCE,
  suspected: (input: PatientInput) => {
    const isDhf = dengueHaemorrhagicFever.suspected(input).met;
    const circulatoryFailure =
      !!input.rapidWeakPulse &&
      ((input.pulsePressureMmHg ?? 999) <= 20 || !!input.hypotensionForAge) &&
      !!input.coldClammySkin &&
      !!input.alteredMentalStatus;

    return evaluate([
      { label: 'meets Dengue Haemorrhagic Fever criteria', met: isDhf },
      {
        label: 'circulatory failure (rapid weak pulse + narrow pulse pressure/hypotension + cold clammy skin + altered mental status)',
        met: circulatoryFailure,
      },
    ]);
  },
};
