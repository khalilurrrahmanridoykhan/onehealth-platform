import { DiseaseDefinition } from '../types';
import { afp } from './afp';
import { anthrax } from './anthrax';
import { acuteJaundice } from './acuteJaundice';
import { bloodyDiarrhea } from './bloodyDiarrhea';
import { cholera } from './cholera';
import { dengueFever, dengueHaemorrhagicFever, dengueShockSyndrome } from './dengue';
import { guineaWorm } from './guineaWorm';
import { malariaSevere, malariaUncomplicated } from './malaria';
import { measles } from './measles';
import { meningitis } from './meningitis';
import { neonatalTetanus } from './neonatalTetanus';
import { plague } from './plague';
import { rabies } from './rabies';
import { riftValleyFever } from './riftValleyFever';
import { sari } from './sari';
import { typhoidFever } from './typhoidFever';
import { viralHaemorrhagicFever } from './viralHaemorrhagicFever';
import { yellowFever } from './yellowFever';

export const ALL_DEFINITIONS: DiseaseDefinition[] = [
  afp,
  anthrax,
  cholera,
  dengueFever,
  dengueHaemorrhagicFever,
  dengueShockSyndrome,
  guineaWorm,
  malariaUncomplicated,
  malariaSevere,
  measles,
  meningitis,
  neonatalTetanus,
  plague,
  riftValleyFever,
  sari,
  viralHaemorrhagicFever,
  yellowFever,
  acuteJaundice,
  bloodyDiarrhea,
  rabies,
  typhoidFever,
];
