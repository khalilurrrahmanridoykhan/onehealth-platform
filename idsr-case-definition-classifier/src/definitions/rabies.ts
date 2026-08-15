import { DiseaseDefinition, PatientInput } from '../types';
import { evaluate } from './criteria';

const SOURCE =
  "Kenya MOH IDSR Standard Case Definitions (WHO AFRO IDSR 3rd ed.): " +
  '"Suspected case: A person who has an animal bite or scratch or contact with saliva from a suspected ' +
  'rabid animal with or without the following: headache, neck pain, nausea, fever, fear of water, anxiety, ' +
  'agitation, abnormal tingling sensations or pain at the wound site. Confirmed: A suspected case that is ' +
  'laboratory confirmed by isolation of rabies virus."';

export const rabies: DiseaseDefinition = {
  id: 'rabies',
  name: 'Rabies',
  source: SOURCE,
  suspected: (input: PatientInput) =>
    // The accompanying symptom list is explicitly "with or without" in the
    // source -- i.e. not required. Only the exposure itself is a real
    // requirement.
    evaluate([
      {
        label: 'animal bite/scratch, or contact with saliva from a suspected rabid animal',
        met: !!input.animalBiteOrScratch || !!input.contactWithSalivaFromSuspectedRabidAnimal,
      },
    ]),
  confirmed: (input: PatientInput) =>
    evaluate([{ label: 'rabies virus isolated', met: !!input.rabiesVirusIsolated }]),
};
