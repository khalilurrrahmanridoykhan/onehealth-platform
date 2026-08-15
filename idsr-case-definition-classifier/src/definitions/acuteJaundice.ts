import { DiseaseDefinition, PatientInput } from '../types';
import { evaluate } from './criteria';

const SOURCE =
  "Kenya MOH IDSR Standard Case Definitions (WHO AFRO IDSR 3rd ed.): " +
  '"Suspected case: Any person presenting with acute onset (within 14 days) of yellowness of the eyes/skin ' +
  'with or without fever. Confirmed case: A suspected case that has an etiological laboratory confirmation ' +
  'e.g. viral hepatitis, aflatoxicosis."';

export const acuteJaundice: DiseaseDefinition = {
  id: 'acute-jaundice',
  name: 'Acute Jaundice',
  source: SOURCE,
  suspected: (input: PatientInput) =>
    evaluate([
      {
        label: 'yellowness of eyes/skin, onset within 14 days',
        met: !!input.jaundice && (input.jaundiceOnsetDays ?? 99) <= 14,
      },
    ]),
  confirmed: (input: PatientInput) =>
    evaluate([{ label: 'etiological lab confirmation (e.g. viral hepatitis, aflatoxicosis)', met: !!input.etiologicalLabConfirmedJaundice }]),
};
