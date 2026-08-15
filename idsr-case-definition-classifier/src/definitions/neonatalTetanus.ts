import { DiseaseDefinition, PatientInput } from '../types';
import { evaluate } from './criteria';

const SOURCE =
  "Kenya MOH IDSR Standard Case Definitions (WHO AFRO IDSR 3rd ed.): " +
  '"Suspected case: Any newborn with a normal ability to suck and cry during the first two days of life, ' +
  'and who, between the 3rd and 28th day of life, cannot suck normally, and becomes stiff or has ' +
  'convulsions or both. Confirmed case: Same as for suspected case."';

export const neonatalTetanus: DiseaseDefinition = {
  id: 'neonatal-tetanus',
  name: 'Neonatal Tetanus',
  source: SOURCE,
  suspected: (input: PatientInput) => {
    const inWindow = (input.ageDays ?? -1) >= 3 && (input.ageDays ?? -1) <= 28;
    return evaluate([
      { label: 'normal suck/cry during first 2 days of life', met: !!input.normalSuckCryFirst2Days },
      { label: 'currently between day 3 and day 28 of life', met: inWindow },
      { label: 'cannot suck normally (in that window)', met: !!input.cannotSuckNormallyAfterDay3 },
      { label: 'stiffness or convulsions', met: !!input.stiffness || !!input.convulsions },
    ]);
  },
  // Source: "Confirmed case: Same as for suspected case" -- no separate lab
  // criterion exists (or is required) for this condition.
  confirmed: (input: PatientInput) => neonatalTetanus.suspected(input),
};
