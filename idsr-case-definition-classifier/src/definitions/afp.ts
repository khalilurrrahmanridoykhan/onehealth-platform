import { DiseaseDefinition, PatientInput } from '../types';
import { evaluate } from './criteria';

const SOURCE =
  "Kenya MOH IDSR Standard Case Definitions (WHO AFRO IDSR 3rd ed.): " +
  '"Suspected case: Any case with weakness or floppiness of the limbs of sudden onset not due to trauma in ' +
  'a child less than 15 years of age, or any person of any age in whom a clinician suspects polio. ' +
  'Confirmed case: A suspected case with polio virus isolation in stool."';

export const afp: DiseaseDefinition = {
  id: 'afp-polio',
  name: 'Acute Flaccid Paralysis (Poliomyelitis)',
  source: SOURCE,
  suspected: (input: PatientInput) => {
    const childRoute =
      !!input.suddenOnsetLimbWeaknessOrFloppiness &&
      !input.limbWeaknessDueToTrauma &&
      (input.ageYears ?? 99) < 15;
    const clinicianRoute = !!input.clinicianSuspectsPolio;

    return evaluate([
      {
        label:
          'sudden-onset limb weakness/floppiness, not due to trauma, in a child <15y -- OR a clinician directly suspects polio',
        met: childRoute || clinicianRoute,
      },
    ]);
  },
  confirmed: (input: PatientInput) =>
    evaluate([{ label: 'poliovirus isolated in stool', met: !!input.poliovirusIsolatedStool }]),
};
