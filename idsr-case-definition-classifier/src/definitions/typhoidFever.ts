import { DiseaseDefinition, PatientInput } from '../types';
import { evaluate } from './criteria';

const SOURCE =
  "Kenya MOH IDSR Standard Case Definitions (WHO AFRO IDSR 3rd ed.): " +
  '"Suspected case: Any person with gradual onset of steadily increasing and then persistently high fever ' +
  'and any of the following: Chills, malaise, headache, sore throat, cough, abdominal pain and constipation ' +
  'or diarrhea. Confirmed case: Suspected case confirmed by isolation of Salmonella typhi from stool, ' +
  'blood, bone marrow, or bowel fluid."';

export const typhoidFever: DiseaseDefinition = {
  id: 'typhoid-fever',
  name: 'Typhoid Fever',
  source: SOURCE,
  suspected: (input: PatientInput) =>
    evaluate([
      { label: 'gradual onset, steadily increasing then persistently high fever', met: !!input.gradualOnsetPersistentHighFever },
      {
        label: 'chills, malaise, headache, sore throat, cough, abdominal pain, or constipation/diarrhea',
        met:
          !!input.chills ||
          !!input.malaise ||
          !!input.headache ||
          !!input.soreThroat ||
          !!input.cough ||
          !!input.abdominalPain ||
          !!input.constipationOrDiarrhea,
      },
    ]),
  confirmed: (input: PatientInput) =>
    evaluate([
      { label: 'Salmonella typhi isolated from stool, blood, bone marrow, or bowel fluid', met: !!input.salmonellaTyphiIsolated },
    ]),
};
