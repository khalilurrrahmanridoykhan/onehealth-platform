import { DiseaseDefinition, PatientInput } from '../types';
import { evaluate } from './criteria';

const SOURCE =
  "Kenya MOH IDSR Standard Case Definitions (WHO AFRO IDSR 3rd ed.): " +
  '"Suspected case: Any person with sudden onset of fever (>38.5ºC rectal or 38.0ºC axillary) and one of the ' +
  'following signs: neck stiffness, altered consciousness or other meningeal signs. Confirmed case: A ' +
  'suspected case confirmed by isolation of N. meningitidis from CSF or blood."';

export const meningitis: DiseaseDefinition = {
  id: 'meningococcal-meningitis',
  name: 'Meningococcal Meningitis',
  source: SOURCE,
  suspected: (input: PatientInput) => {
    const feverMeetsThreshold =
      !!input.suddenOnsetFever &&
      ((input.feverRectalC ?? 0) > 38.5 || (input.feverAxillaryC ?? 0) > 38.0);
    return evaluate([
      { label: 'sudden onset fever (>38.5C rectal or >38.0C axillary)', met: feverMeetsThreshold },
      {
        label: 'neck stiffness, altered consciousness, or other meningeal signs',
        met: !!input.neckStiffness || !!input.alteredConsciousness || !!input.otherMeningealSigns,
      },
    ]);
  },
  confirmed: (input: PatientInput) =>
    evaluate([{ label: 'N. meningitidis isolated from CSF or blood', met: !!input.nMeningitidisIsolatedCsfOrBlood }]),
};
