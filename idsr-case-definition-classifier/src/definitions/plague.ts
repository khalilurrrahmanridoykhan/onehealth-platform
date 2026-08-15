import { DiseaseDefinition, PatientInput } from '../types';
import { evaluate } from './criteria';

const SOURCE =
  "Kenya MOH IDSR Standard Case Definitions (WHO AFRO IDSR 3rd ed.): " +
  '"Suspected case: Any person with sudden onset of fever, chills, headache, severe malaise, prostration ' +
  'and painful swelling of lymph nodes, or cough with blood stained sputum, chest pain, and difficulty in ' +
  'breathing. Confirmed case: Suspected case confirmed by isolation of Yersinia pestis from blood or ' +
  'aspiration of buboes, or epidemiologic link to confirmed cases or outbreak."';

export const plague: DiseaseDefinition = {
  id: 'plague',
  name: 'Plague',
  source: SOURCE,
  suspected: (input: PatientInput) => {
    // Two clinical presentations (bubonic-like vs. pneumonic-like), joined
    // by "or" in the source.
    const bubonicRoute =
      !!input.suddenOnsetFever &&
      !!input.chills &&
      !!input.headache &&
      !!input.severeMalaise &&
      !!input.prostration &&
      !!input.painfulLymphNodeSwelling;
    const pneumonicRoute = !!input.bloodStainedSputumCough && !!input.chestPain && !!input.shortnessOfBreath;

    return evaluate([
      {
        label:
          'sudden fever+chills+headache+severe malaise+prostration+painful lymph node swelling -- ' +
          'OR cough with blood-stained sputum+chest pain+difficulty breathing',
        met: bubonicRoute || pneumonicRoute,
      },
    ]);
  },
  confirmed: (input: PatientInput) =>
    evaluate([
      {
        label: 'Yersinia pestis isolated from blood/bubo aspirate, or epidemiologic link to a confirmed case/outbreak',
        met: !!input.yPestisIsolated || !!input.epiLinkConfirmedCaseOrOutbreak,
      },
    ]),
};
