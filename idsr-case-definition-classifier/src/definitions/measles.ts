import { DiseaseDefinition, PatientInput } from '../types';
import { evaluate } from './criteria';

const SOURCE =
  "Kenya MOH IDSR Standard Case Definitions (WHO AFRO IDSR 3rd ed.): " +
  '"Suspected case: Any person with fever and maculopapular (non-vesicular) generalized rash and any one of ' +
  'the following: Cough coryza or conjunctivitis (red eyes) or any person in whom a clinician suspects ' +
  'measles. Confirmed case: A suspected case with laboratory confirmation (positive IgM antibody) measles ' +
  'infection or with epidemiological link to confirmed cases in an outbreak."';

export const measles: DiseaseDefinition = {
  id: 'measles',
  name: 'Measles',
  source: SOURCE,
  suspected: (input: PatientInput) => {
    // The source has two independent suspected-case routes: the classic
    // clinical triad, OR a standalone clinician-override ("any person in
    // whom a clinician suspects measles"). Both routes are real and neither
    // is "stronger" than the other, so this is one OR'd criterion, not a
    // separate tier.
    const clinicalTriad =
      !!input.fever && !!input.maculopapularRash && (!!input.cough || !!input.coryza || !!input.conjunctivitis);
    const clinicianOverride = !!input.clinicianSuspectsMeasles;

    return evaluate([
      {
        label:
          'fever + maculopapular rash + (cough/coryza/conjunctivitis), OR a clinician directly suspects measles',
        met: clinicalTriad || clinicianOverride,
      },
    ]);
  },
  confirmed: (input: PatientInput) =>
    evaluate([
      {
        label: 'measles IgM positive, or epidemiologically linked to a confirmed outbreak case',
        met: !!input.measlesIgmPositive || !!input.epiLinkConfirmedCaseOrOutbreak,
      },
    ]),
};
