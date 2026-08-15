import { DiseaseDefinition, PatientInput } from '../types';
import { evaluate } from './criteria';

const SOURCE =
  "Kenya MOH IDSR Standard Case Definitions (WHO AFRO IDSR 3rd ed.): " +
  '"Suspected case: Any person with acute onset fever followed by jaundice within two weeks of onset of ' +
  'first symptoms. Hemorrhagic manifestations and renal failure may occur. Confirmed case: A suspected case ' +
  'with laboratory confirmation (positive IgM antibody or viral isolation) or epidemiologic link to ' +
  'confirmed cases or outbreaks."';

export const yellowFever: DiseaseDefinition = {
  id: 'yellow-fever',
  name: 'Yellow Fever',
  source: SOURCE,
  suspected: (input: PatientInput) =>
    evaluate([
      { label: 'acute onset fever', met: !!input.suddenOnsetFever || !!input.fever },
      { label: 'jaundice within 2 weeks of fever onset', met: !!input.jaundiceWithin2WeeksOfFeverOnset },
    ]),
  confirmed: (input: PatientInput) =>
    evaluate([
      {
        label: 'lab confirmation (IgM positive or viral isolation), or epi link to confirmed cases/outbreak',
        met: !!input.yellowFeverLabConfirmed || !!input.epiLinkConfirmedCaseOrOutbreak,
      },
    ]),
};
