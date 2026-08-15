import { DiseaseDefinition, PatientInput } from '../types';
import { evaluate } from './criteria';

const SOURCE =
  "Kenya MOH IDSR Standard Case Definitions (WHO AFRO IDSR 3rd ed.): " +
  '"Uncomplicated malaria: Any person with fever or history of fever within 24 hours without signs of ' +
  'severe disease (vital organ dysfunction) and is diagnosed clinically as malaria. Confirmed uncomplicated ' +
  'malaria: ...with laboratory confirmation of diagnosis by malaria blood film or other diagnostic test for ' +
  'malaria parasites. Unconfirmed severe malaria: Any person hospitalized with severe febrile disease with ' +
  'accompanying vital organ dysfunction diagnosed clinically. Confirmed severe malaria: Any person with ' +
  'Plasmodium parasitaemia as confirmed by laboratory tests, with accompanying symptoms and signs of severe ' +
  'disease (vital organ dysfunction) diagnosed clinically or through laboratory."';

// The source presents malaria as two parallel severity categories
// (uncomplicated vs. severe), each independently split into a clinical and
// a lab-confirmed tier -- a real 2x2 shape, not a single suspected ->
// probable -> confirmed ladder. Forcing it into this project's usual
// two/three-tier DiseaseDefinition would lose that structure, so it's
// modeled as two separate definitions instead, each still using the
// standard suspected/confirmed shape faithfully for its own severity band.

export const malariaUncomplicated: DiseaseDefinition = {
  id: 'malaria-uncomplicated',
  name: 'Malaria (Uncomplicated)',
  source: SOURCE,
  suspected: (input: PatientInput) =>
    evaluate([
      { label: 'fever or history of fever within 24 hours', met: !!input.fever || !!input.feverDurationHours },
      { label: 'no signs of severe disease (vital organ dysfunction)', met: !input.signsOfSevereDisease },
      { label: 'diagnosed clinically as malaria', met: !!input.diagnosedClinicallyAsMalaria },
    ]),
  confirmed: (input: PatientInput) =>
    evaluate([
      { label: 'fever or history of fever within 24 hours', met: !!input.fever || !!input.feverDurationHours },
      { label: 'malaria blood film or other parasite test positive', met: !!input.malariaBloodFilmOrTestPositive },
    ]),
};

export const malariaSevere: DiseaseDefinition = {
  id: 'malaria-severe',
  name: 'Malaria (Severe)',
  source: SOURCE,
  suspected: (input: PatientInput) =>
    evaluate([
      { label: 'hospitalized with severe febrile disease', met: !!input.hospitalized && !!input.fever },
      { label: 'vital organ dysfunction, diagnosed clinically', met: !!input.signsOfSevereDisease },
    ]),
  confirmed: (input: PatientInput) =>
    evaluate([
      { label: 'Plasmodium parasitaemia lab-confirmed', met: !!input.plasmodiumParasitaemiaConfirmed },
      {
        label: 'accompanying symptoms/signs of severe disease (vital organ dysfunction)',
        met: !!input.signsOfSevereDisease,
      },
    ]),
};
