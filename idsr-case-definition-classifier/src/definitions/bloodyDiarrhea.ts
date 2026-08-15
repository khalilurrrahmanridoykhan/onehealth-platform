import { DiseaseDefinition, PatientInput } from '../types';
import { evaluate } from './criteria';

const SOURCE =
  "Kenya MOH IDSR Standard Case Definitions (WHO AFRO IDSR 3rd ed.): " +
  '"Suspected case: A person with diarrhoea with visible blood in stool. Confirmed case: Suspected case ' +
  'with stool culture positive for Shigella dysenteriae type 1."';

export const bloodyDiarrhea: DiseaseDefinition = {
  id: 'bloody-diarrhea',
  name: 'Diarrhoea with Blood (Shigella dysentery)',
  source: SOURCE,
  suspected: (input: PatientInput) =>
    evaluate([{ label: 'diarrhoea with visible blood in stool', met: !!input.diarrheaWithVisibleBlood }]),
  confirmed: (input: PatientInput) =>
    evaluate([{ label: 'stool culture positive for Shigella dysenteriae type 1', met: !!input.shigellaDysenteriaeType1Cultured }]),
};
