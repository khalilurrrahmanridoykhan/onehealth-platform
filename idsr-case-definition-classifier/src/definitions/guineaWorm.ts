import { DiseaseDefinition, PatientInput } from '../types';
import { evaluate } from './criteria';

const SOURCE =
  "Kenya MOH IDSR Standard Case Definitions (WHO AFRO IDSR 3rd ed.): " +
  '"Suspected case: A person presenting with a skin lesion or lesions (blister or a boil) living in a high ' +
  'risk area for Guinea Worm Disease or having history of travel to a Guinea Worm Disease endemic area. ' +
  'Confirmed case: A person presenting with a skin lesion or lesions (blister or boil) with emergence of ' +
  'one or more guinea worms from the blister or boil."';

export const guineaWorm: DiseaseDefinition = {
  id: 'guinea-worm',
  name: 'Guinea Worm Disease (Dracunculiasis)',
  source: SOURCE,
  suspected: (input: PatientInput) =>
    evaluate([
      { label: 'skin lesion (blister or boil)', met: !!input.skinLesionBlisterOrBoil },
      {
        label: 'lives in a high-risk area, or has travel history to an endemic area',
        met: !!input.livesInHighRiskGuineaWormArea || !!input.travelToGuineaWormEndemicArea,
      },
    ]),
  confirmed: (input: PatientInput) =>
    evaluate([
      { label: 'skin lesion (blister or boil)', met: !!input.skinLesionBlisterOrBoil },
      { label: 'one or more guinea worms emerged from the lesion', met: !!input.wormEmergedFromLesion },
    ]),
};
