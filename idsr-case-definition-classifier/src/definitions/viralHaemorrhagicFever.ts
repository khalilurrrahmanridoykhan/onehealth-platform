import { DiseaseDefinition, PatientInput } from '../types';
import { evaluate } from './criteria';

const SOURCE =
  "Kenya MOH IDSR Standard Case Definitions (WHO AFRO IDSR 3rd ed.): " +
  '"Suspected case: Acute onset of fever of less than 3 weeks duration in a severely ill patient AND any 2 ' +
  'of the following; hemorrhagic or purpuric rash; epistaxis; haematemesis; haemoptysis; blood in stool; ' +
  'other hemorrhagic manifestations with no known predisposing factors. Confirmed case: A suspected case ' +
  'with laboratory confirmation or epidemiologic link to confirmed cases or outbreak."';

export const viralHaemorrhagicFever: DiseaseDefinition = {
  id: 'viral-haemorrhagic-fever',
  name: 'Viral Haemorrhagic Fever Syndrome',
  source: SOURCE,
  suspected: (input: PatientInput) => {
    const signCount = [
      input.hemorrhagicOrPurpuricRash,
      input.epistaxis,
      input.haematemesis,
      input.haemoptysis,
      input.bloodInStool,
      input.otherHemorrhagicManifestations,
    ].filter(Boolean).length;

    return evaluate([
      { label: 'acute onset fever, <3 weeks duration', met: !!input.fever && (input.feverDurationDays ?? 99) < 21 },
      { label: 'severely ill', met: !!input.severelyIll },
      {
        label: '>=2 of: haemorrhagic/purpuric rash, epistaxis, haematemesis, haemoptysis, blood in stool, other haemorrhagic signs',
        met: signCount >= 2,
      },
      { label: 'no known predisposing factors for the bleeding', met: !!input.noKnownPredisposingFactorsForBleeding },
    ]);
  },
  confirmed: (input: PatientInput) =>
    evaluate([
      {
        label: 'lab confirmation, or epidemiologic link to confirmed cases/outbreak',
        met: !!input.vhfLabConfirmed || !!input.epiLinkConfirmedCaseOrOutbreak,
      },
    ]),
};
