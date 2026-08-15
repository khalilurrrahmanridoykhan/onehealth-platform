import { DiseaseDefinition, PatientInput } from '../types';
import { evaluate } from './criteria';

const SOURCE =
  "Kenya MOH IDSR Standard Case Definitions (WHO AFRO IDSR 3rd ed.): " +
  '"Suspected case: A patient age 5 years or more, presenting with acute, profuse, effortless watery ' +
  'diarrhoea (3 or more times within 24 hours). If there is a cholera epidemic, a suspected case is any ' +
  'person age 2 years and above with acute watery diarrhoea, with or without vomiting. Confirmed Case: A ' +
  'suspected case in which vibrio cholera O1 or O139 has been isolated in the stool, or is epidemiologically ' +
  'linked to a confirmed case."';

export const cholera: DiseaseDefinition = {
  id: 'cholera',
  name: 'Cholera',
  source: SOURCE,
  suspected: (input: PatientInput) => {
    // Two parallel routes, as written in the source: the non-epidemic route
    // (age >=5, >=3 episodes/24h) and the epidemic route (age >=2, no
    // episode-count threshold, vomiting optional).
    const nonEpidemicRoute =
      (input.ageYears ?? -1) >= 5 &&
      !!input.acuteWateryDiarrhea &&
      (input.diarrheaEpisodesPer24h ?? 0) >= 3;
    const epidemicRoute =
      !!input.choleraEpidemicDeclared &&
      (input.ageYears ?? -1) >= 2 &&
      !!input.acuteWateryDiarrhea;

    return evaluate([
      {
        label: 'age >=5y with acute watery diarrhoea >=3x/24h, OR (epidemic) age >=2y with acute watery diarrhoea',
        met: nonEpidemicRoute || epidemicRoute,
      },
    ]);
  },
  confirmed: (input: PatientInput) =>
    evaluate([
      {
        label: 'V. cholerae O1/O139 isolated in stool, or epidemiologically linked to a confirmed case',
        met: !!input.vCholeraeO1O139IsolatedStool || !!input.epiLinkConfirmedCaseOrOutbreak,
      },
    ]),
};
