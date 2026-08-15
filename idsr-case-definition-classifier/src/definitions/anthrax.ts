import { DiseaseDefinition, PatientInput } from '../types';
import { evaluate } from './criteria';

const SOURCE =
  "Kenya MOH IDSR Standard Case Definitions (WHO AFRO IDSR 3rd ed.): " +
  '"Suspected case: Any person with an acute onset illness characterized by any of the following clinical ' +
  'forms: Cutaneous form: Skin lesion evolving over 1 to 6 days from a papular through a vesicular stage, ' +
  'to a depressed black eschar invariably accompanied by oedema... Gastro-intestinal form: Abdominal ' +
  'distress characterized by nausea, vomiting, anorexia and followed by fever. Pulmonary (inhalation): ' +
  'There is brief prodrome resembling acute viral respiratory illness, followed by rapid onset of hypoxia, ' +
  'dyspnoea and high temperature. AND has an epidemiological link to confirmed or suspected animal cases or ' +
  'contaminated animal products. Confirmed case: ...laboratory-confirmed by isolation of B. anthracis from ' +
  'an affected tissue or site."';

export const anthrax: DiseaseDefinition = {
  id: 'anthrax',
  name: 'Anthrax',
  source: SOURCE,
  suspected: (input: PatientInput) => {
    const cutaneousForm = !!input.cutaneousLesionEschar;
    const giForm = !!input.abdominalDistress && (!!input.nauseaVomiting || !!input.vomiting) && !!input.anorexia && !!input.fever;
    const pulmonaryForm = !!input.pulmonaryProdromeThenHypoxia;

    return evaluate([
      {
        label: 'one of: cutaneous eschar lesion / GI form (abdominal distress + fever) / pulmonary form (prodrome then hypoxia)',
        met: cutaneousForm || giForm || pulmonaryForm,
      },
      {
        label: 'epidemiological link to a confirmed/suspected animal case or contaminated animal product',
        met: !!input.epiLinkAnimalCase,
      },
    ]);
  },
  confirmed: (input: PatientInput) =>
    evaluate([{ label: 'B. anthracis isolated from an affected tissue/site', met: !!input.bAnthracisIsolatedFromTissue }]),
};
