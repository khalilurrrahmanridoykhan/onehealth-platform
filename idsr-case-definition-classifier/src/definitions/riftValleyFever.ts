import { DiseaseDefinition, PatientInput } from '../types';
import { evaluate } from './criteria';

const SOURCE =
  "Kenya MOH IDSR Standard Case Definitions (WHO AFRO IDSR 3rd ed.): " +
  '"Suspected case: A person with an acute febrile illness (axillary temperature >37.5C or oral/anal ' +
  'temperature of >38C) of more than 48 hours duration that does not respond to antibiotic or antimalarial ' +
  'therapy, and is associated with abrupt onset of any 1 or more of the following: Exhaustion, backache, ' +
  'muscle pains, headache (often severe), discomfort in the eyes when exposed to light, and nausea/vomiting. ' +
  'With: Direct contact with sick or dead animal or its products and/or Recent travel [...] to an area ' +
  '[...] where RVF virus activity is suspected/confirmed. And/or: Nausea/vomiting, diarrhea or abdominal ' +
  'pain with 1 or more of [severe pallor/low Hb, thrombocytopenia, kidney failure signs, bleeding signs, ' +
  'clinical jaundice]. Confirmed case: [...] positive for anti-RVF IgM ELISA antibodies or [...] RT-PCR."';

/**
 * A documented interpretation call: the source's own "With: [exposure] ...
 * And/or: [severe complications]" structure is genuinely ambiguous natural
 * language, not a clean boolean expression. Read here as: the core febrile
 * illness picture, PLUS EITHER a real exposure link OR a severe systemic
 * complications picture (the "and/or" read as an inclusive-or between those
 * two blocks, not a strict requirement for both). This is the single most
 * interpretive call made across all 18 definitions in this project -- flagged
 * here rather than silently resolved.
 */
export const riftValleyFever: DiseaseDefinition = {
  id: 'rift-valley-fever',
  name: 'Rift Valley Fever',
  source: SOURCE,
  suspected: (input: PatientInput) => {
    const feverMeetsThreshold = (input.feverAxillaryC ?? 0) > 37.5 || (input.feverC ?? 0) > 38.0;
    const coreIllness =
      feverMeetsThreshold &&
      (input.feverDurationHours ?? 0) > 48 &&
      !!input.unresponsiveToAntibioticOrAntimalarial &&
      (!!input.exhaustion ||
        !!input.backache ||
        !!input.musclePains ||
        !!input.headache ||
        !!input.photophobia ||
        !!input.nauseaVomiting);

    const exposureLink = !!input.contactWithSickOrDeadAnimal || !!input.recentTravelToRvfArea;

    const severeComplicationsBlock =
      (!!input.nauseaVomiting || !!input.diarrhea || !!input.abdominalPain) &&
      (!!input.severePallor ||
        (input.hemoglobinGdL ?? 99) < 8 ||
        (input.plateletCountPerMm3 ?? 999999) < 100_000 || // source's "100x10^9/dL" converts to 100,000/mm3, same threshold as dengue's
        !!input.kidneyFailureSigns ||
        (input.creatinineUmolL ?? 0) > 150 ||
        !!input.reducedUrineOutput ||
        !!input.edema ||
        !!input.bleedingIntoSkinOrFromPuncture ||
        !!input.unnaturalVaginalBleeding ||
        !!input.clinicalJaundice);

    return evaluate([
      { label: 'acute febrile illness (>37.5C axillary/>38C oral-anal), >48h, unresponsive to antibiotic/antimalarial, with >=1 abrupt-onset systemic sign', met: coreIllness },
      { label: 'exposure link (animal contact or travel to an RVF-affected area), OR a severe systemic complications picture', met: exposureLink || severeComplicationsBlock },
    ]);
  },
  confirmed: (input: PatientInput) =>
    evaluate([{ label: 'anti-RVF IgM ELISA positive, or RT-PCR positive', met: !!input.rvfIgmOrPcrPositive }]),
};
