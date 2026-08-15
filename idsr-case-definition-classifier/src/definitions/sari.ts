import { DiseaseDefinition, PatientInput } from '../types';
import { evaluate } from './criteria';

const SOURCE =
  "Kenya MOH IDSR Standard Case Definitions (WHO AFRO IDSR 3rd ed.): " +
  '"Severe acute respiratory infection (persons ≥ 5 years old): Any severely ill person presenting with ' +
  'manifestations of acute (7 days) lower respiratory infection with: Sudden onset of fever (>38ºC) and ' +
  'Cough or sore throat and Shortness of breath, or difficulty breathing. With or without Clinical or ' +
  'radiographic findings of pneumonia. OR Any person who died of an unexplained respiratory illness."';

export const sari: DiseaseDefinition = {
  id: 'sari',
  name: 'Severe Acute Respiratory Infection (SARI)',
  source: SOURCE,
  // No distinct "confirmed" tier exists in the source for this condition --
  // deliberately not defined here (see DiseaseDefinition.confirmed's own
  // doc comment) rather than invented.
  suspected: (input: PatientInput) => {
    const clinicalRoute =
      (input.ageYears ?? 5) >= 5 &&
      !!input.severelyIll &&
      !!input.suddenOnsetFever &&
      (input.cough || input.soreThroat) &&
      !!input.shortnessOfBreath;
    const deathRoute = !!input.diedOfUnexplainedRespiratoryIllness;

    return evaluate([
      {
        label:
          'age >=5y, severely ill, sudden fever (>38C), (cough or sore throat), and shortness of breath -- ' +
          'OR died of an unexplained respiratory illness',
        met: !!clinicalRoute || deathRoute,
      },
    ]);
  },
};
