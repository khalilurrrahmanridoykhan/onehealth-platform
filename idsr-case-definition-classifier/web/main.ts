import { classifyAll } from '../src/classify';
import { ALL_DEFINITIONS } from '../src/definitions';
import { PatientInput } from '../src/types';

type FieldType = 'bool' | 'number';

interface FieldSpec {
  key: keyof PatientInput;
  label: string;
  type: FieldType;
}

interface FieldGroup {
  title: string;
  fields: FieldSpec[];
}

// Every field here mirrors src/types.ts exactly -- this demo has no logic
// of its own, it only renders a form for the real PatientInput shape and
// calls the real classifyAll() from the library. Grouped for readability,
// not by any part of the type system.
const FIELD_GROUPS: FieldGroup[] = [
  {
    title: 'Demographics',
    fields: [
      { key: 'ageYears', label: 'Age (years)', type: 'number' },
      { key: 'ageDays', label: 'Age (days, for neonates)', type: 'number' },
    ],
  },
  {
    title: 'Fever',
    fields: [
      { key: 'fever', label: 'Fever', type: 'bool' },
      { key: 'suddenOnsetFever', label: 'Sudden onset fever', type: 'bool' },
      { key: 'gradualOnsetPersistentHighFever', label: 'Gradual onset, persistently high fever', type: 'bool' },
      { key: 'feverC', label: 'Temperature (C, general)', type: 'number' },
      { key: 'feverAxillaryC', label: 'Temperature, axillary (C)', type: 'number' },
      { key: 'feverRectalC', label: 'Temperature, rectal (C)', type: 'number' },
      { key: 'feverDurationDays', label: 'Fever duration (days)', type: 'number' },
      { key: 'feverDurationHours', label: 'Fever duration (hours)', type: 'number' },
      { key: 'severelyIll', label: 'Severely ill', type: 'bool' },
      { key: 'hospitalized', label: 'Hospitalized', type: 'bool' },
    ],
  },
  {
    title: 'General / neurological',
    fields: [
      { key: 'headache', label: 'Headache', type: 'bool' },
      { key: 'neckPain', label: 'Neck pain', type: 'bool' },
      { key: 'neckStiffness', label: 'Neck stiffness', type: 'bool' },
      { key: 'alteredConsciousness', label: 'Altered consciousness', type: 'bool' },
      { key: 'otherMeningealSigns', label: 'Other meningeal signs', type: 'bool' },
      { key: 'chills', label: 'Chills', type: 'bool' },
      { key: 'malaise', label: 'Malaise', type: 'bool' },
      { key: 'severeMalaise', label: 'Severe malaise', type: 'bool' },
      { key: 'prostration', label: 'Prostration', type: 'bool' },
      { key: 'exhaustion', label: 'Exhaustion', type: 'bool' },
      { key: 'backache', label: 'Backache', type: 'bool' },
      { key: 'musclePains', label: 'Muscle pains (myalgia)', type: 'bool' },
      { key: 'arthralgia', label: 'Joint pain (arthralgia)', type: 'bool' },
      { key: 'photophobia', label: 'Discomfort in eyes when exposed to light', type: 'bool' },
    ],
  },
  {
    title: 'Respiratory',
    fields: [
      { key: 'cough', label: 'Cough', type: 'bool' },
      { key: 'coryza', label: 'Coryza (runny nose)', type: 'bool' },
      { key: 'soreThroat', label: 'Sore throat', type: 'bool' },
      { key: 'shortnessOfBreath', label: 'Shortness of breath / difficulty breathing', type: 'bool' },
      { key: 'chestPain', label: 'Chest pain', type: 'bool' },
      { key: 'bloodStainedSputumCough', label: 'Cough with blood-stained sputum', type: 'bool' },
      { key: 'diedOfUnexplainedRespiratoryIllness', label: 'Died of unexplained respiratory illness', type: 'bool' },
    ],
  },
  {
    title: 'Skin / rash / eyes',
    fields: [
      { key: 'rash', label: 'Rash', type: 'bool' },
      { key: 'maculopapularRash', label: 'Maculopapular generalized rash', type: 'bool' },
      { key: 'hemorrhagicOrPurpuricRash', label: 'Haemorrhagic or purpuric rash', type: 'bool' },
      { key: 'conjunctivitis', label: 'Conjunctivitis (red eyes)', type: 'bool' },
      { key: 'retroOrbitalPain', label: 'Retro-orbital pain', type: 'bool' },
    ],
  },
  {
    title: 'Gastrointestinal',
    fields: [
      { key: 'nauseaVomiting', label: 'Nausea / vomiting', type: 'bool' },
      { key: 'vomiting', label: 'Vomiting', type: 'bool' },
      { key: 'diarrhea', label: 'Diarrhoea', type: 'bool' },
      { key: 'acuteWateryDiarrhea', label: 'Acute watery diarrhoea', type: 'bool' },
      { key: 'diarrheaEpisodesPer24h', label: 'Diarrhoea episodes / 24h', type: 'number' },
      { key: 'diarrheaWithVisibleBlood', label: 'Diarrhoea with visible blood', type: 'bool' },
      { key: 'constipationOrDiarrhea', label: 'Constipation or diarrhoea', type: 'bool' },
      { key: 'abdominalPain', label: 'Abdominal pain', type: 'bool' },
      { key: 'abdominalDistress', label: 'Abdominal distress', type: 'bool' },
      { key: 'anorexia', label: 'Anorexia (loss of appetite)', type: 'bool' },
    ],
  },
  {
    title: 'Jaundice',
    fields: [
      { key: 'jaundice', label: 'Jaundice (yellowing of eyes/skin)', type: 'bool' },
      { key: 'jaundiceOnsetDays', label: 'Days since jaundice onset', type: 'number' },
      { key: 'jaundiceWithin2WeeksOfFeverOnset', label: 'Jaundice within 2 weeks of fever onset', type: 'bool' },
      { key: 'clinicalJaundice', label: 'Clinical jaundice (3x transaminase rise)', type: 'bool' },
    ],
  },
  {
    title: 'Bleeding / haemorrhagic signs',
    fields: [
      { key: 'epistaxis', label: 'Epistaxis (nosebleed)', type: 'bool' },
      { key: 'haematemesis', label: 'Haematemesis (vomiting blood)', type: 'bool' },
      { key: 'haemoptysis', label: 'Haemoptysis (coughing blood)', type: 'bool' },
      { key: 'bloodInStool', label: 'Blood in stool', type: 'bool' },
      { key: 'otherHemorrhagicManifestations', label: 'Other haemorrhagic manifestations', type: 'bool' },
      { key: 'noKnownPredisposingFactorsForBleeding', label: 'No known predisposing factors for the bleeding', type: 'bool' },
      { key: 'positiveTourniquetTest', label: 'Positive tourniquet test', type: 'bool' },
      { key: 'petechiaeEcchymosesPurpura', label: 'Petechiae / ecchymoses / purpura', type: 'bool' },
      { key: 'bleedingMucosaGiOrInjectionSite', label: 'Bleeding: mucosa, GI tract, or injection site', type: 'bool' },
      { key: 'bleedingIntoSkinOrFromPuncture', label: 'Bleeding into skin or from puncture wounds', type: 'bool' },
      { key: 'unnaturalVaginalBleeding', label: 'Unnatural vaginal bleeding', type: 'bool' },
    ],
  },
  {
    title: 'Shock / circulatory',
    fields: [
      { key: 'rapidWeakPulse', label: 'Rapid, weak pulse', type: 'bool' },
      { key: 'pulsePressureMmHg', label: 'Pulse pressure (mmHg)', type: 'number' },
      { key: 'hypotensionForAge', label: 'Hypotension for age', type: 'bool' },
      { key: 'coldClammySkin', label: 'Cold, clammy skin', type: 'bool' },
      { key: 'alteredMentalStatus', label: 'Altered mental status', type: 'bool' },
    ],
  },
  {
    title: 'Rabies-specific',
    fields: [
      { key: 'animalBiteOrScratch', label: 'Animal bite or scratch', type: 'bool' },
      { key: 'contactWithSalivaFromSuspectedRabidAnimal', label: 'Contact with saliva from a suspected rabid animal', type: 'bool' },
      { key: 'hydrophobia', label: 'Hydrophobia (fear of water)', type: 'bool' },
      { key: 'anxietyOrAgitation', label: 'Anxiety or agitation', type: 'bool' },
      { key: 'abnormalTinglingSensations', label: 'Abnormal tingling sensations', type: 'bool' },
      { key: 'painAtWoundSite', label: 'Pain at wound site', type: 'bool' },
    ],
  },
  {
    title: 'Acute Flaccid Paralysis (Polio)',
    fields: [
      { key: 'suddenOnsetLimbWeaknessOrFloppiness', label: 'Sudden onset limb weakness/floppiness', type: 'bool' },
      { key: 'limbWeaknessDueToTrauma', label: 'Limb weakness is due to trauma', type: 'bool' },
      { key: 'clinicianSuspectsPolio', label: 'A clinician directly suspects polio', type: 'bool' },
    ],
  },
  {
    title: 'Anthrax',
    fields: [
      { key: 'cutaneousLesionEschar', label: 'Cutaneous lesion evolving to a black eschar', type: 'bool' },
      { key: 'pulmonaryProdromeThenHypoxia', label: 'Viral-like prodrome then rapid hypoxia/dyspnoea', type: 'bool' },
      { key: 'epiLinkAnimalCase', label: 'Epi link to a confirmed/suspected animal case or contaminated product', type: 'bool' },
    ],
  },
  {
    title: 'Guinea worm',
    fields: [
      { key: 'skinLesionBlisterOrBoil', label: 'Skin lesion (blister or boil)', type: 'bool' },
      { key: 'wormEmergedFromLesion', label: 'Worm emerged from the lesion', type: 'bool' },
      { key: 'livesInHighRiskGuineaWormArea', label: 'Lives in a high-risk area', type: 'bool' },
      { key: 'travelToGuineaWormEndemicArea', label: 'Travel history to an endemic area', type: 'bool' },
    ],
  },
  {
    title: 'Neonate (first 28 days of life)',
    fields: [
      { key: 'normalSuckCryFirst2Days', label: 'Normal suck/cry during first 2 days of life', type: 'bool' },
      { key: 'cannotSuckNormallyAfterDay3', label: 'Cannot suck normally (day 3-28)', type: 'bool' },
      { key: 'stiffness', label: 'Stiffness', type: 'bool' },
      { key: 'convulsions', label: 'Convulsions', type: 'bool' },
    ],
  },
  {
    title: 'Plague',
    fields: [{ key: 'painfulLymphNodeSwelling', label: 'Painful lymph node swelling', type: 'bool' }],
  },
  {
    title: 'Malaria',
    fields: [
      { key: 'signsOfSevereDisease', label: 'Signs of severe disease (vital organ dysfunction)', type: 'bool' },
      { key: 'diagnosedClinicallyAsMalaria', label: 'Diagnosed clinically as malaria', type: 'bool' },
      { key: 'malariaBloodFilmOrTestPositive', label: 'Malaria blood film / parasite test positive', type: 'bool' },
      { key: 'plasmodiumParasitaemiaConfirmed', label: 'Plasmodium parasitaemia lab-confirmed', type: 'bool' },
    ],
  },
  {
    title: 'Exposures & treatment response',
    fields: [
      { key: 'contactWithSickOrDeadAnimal', label: 'Contact with sick/dead animal or its products', type: 'bool' },
      { key: 'recentTravelToRvfArea', label: 'Recent travel to / living in an RVF-affected area', type: 'bool' },
      { key: 'choleraEpidemicDeclared', label: 'A cholera epidemic is currently declared', type: 'bool' },
      { key: 'unresponsiveToAntibioticOrAntimalarial', label: 'Unresponsive to antibiotic/antimalarial therapy', type: 'bool' },
    ],
  },
  {
    title: 'Lab values',
    fields: [
      { key: 'plateletCountPerMm3', label: 'Platelet count (per mm3)', type: 'number' },
      { key: 'hemoglobinGdL', label: 'Haemoglobin (g/dL)', type: 'number' },
      { key: 'creatinineUmolL', label: 'Creatinine (umol/L)', type: 'number' },
      { key: 'hematocritRise20PercentForAgeSex', label: 'Haematocrit rise >=20% for age/sex', type: 'bool' },
      { key: 'hematocritDrop20PercentAfterFluidReplacement', label: 'Haematocrit drop >=20% after fluid replacement', type: 'bool' },
      { key: 'plasmaLeakSigns', label: 'Plasma leak signs (pleural effusion/ascites/hypoproteinaemia)', type: 'bool' },
      { key: 'reducedUrineOutput', label: 'Reduced urine output', type: 'bool' },
      { key: 'edema', label: 'Oedema', type: 'bool' },
      { key: 'leucopenia', label: 'Leucopenia', type: 'bool' },
      { key: 'severePallor', label: 'Severe pallor', type: 'bool' },
      { key: 'kidneyFailureSigns', label: 'Kidney failure signs', type: 'bool' },
    ],
  },
  {
    title: 'Lab / epidemiological confirmation',
    fields: [
      { key: 'poliovirusIsolatedStool', label: 'Poliovirus isolated in stool', type: 'bool' },
      { key: 'bAnthracisIsolatedFromTissue', label: 'B. anthracis isolated from tissue', type: 'bool' },
      { key: 'vCholeraeO1O139IsolatedStool', label: 'V. cholerae O1/O139 isolated in stool', type: 'bool' },
      { key: 'dengueLabConfirmed', label: 'Dengue lab-confirmed (IgM/IgG/PCR/isolation)', type: 'bool' },
      { key: 'measlesIgmPositive', label: 'Measles IgM positive', type: 'bool' },
      { key: 'yPestisIsolated', label: 'Yersinia pestis isolated', type: 'bool' },
      { key: 'rvfIgmOrPcrPositive', label: 'RVF IgM ELISA or RT-PCR positive', type: 'bool' },
      { key: 'vhfLabConfirmed', label: 'VHF lab-confirmed', type: 'bool' },
      { key: 'yellowFeverLabConfirmed', label: 'Yellow fever lab-confirmed', type: 'bool' },
      { key: 'etiologicalLabConfirmedJaundice', label: 'Etiological lab confirmation for jaundice', type: 'bool' },
      { key: 'shigellaDysenteriaeType1Cultured', label: 'Shigella dysenteriae type 1 cultured', type: 'bool' },
      { key: 'nMeningitidisIsolatedCsfOrBlood', label: 'N. meningitidis isolated from CSF/blood', type: 'bool' },
      { key: 'rabiesVirusIsolated', label: 'Rabies virus isolated', type: 'bool' },
      { key: 'salmonellaTyphiIsolated', label: 'Salmonella typhi isolated', type: 'bool' },
      { key: 'epiLinkConfirmedCaseOrOutbreak', label: 'Epidemiologically linked to a confirmed case/outbreak', type: 'bool' },
    ],
  },
];

function buildForm(container: HTMLElement, onChange: () => void): () => PatientInput {
  const inputs = new Map<keyof PatientInput, HTMLInputElement>();

  for (const group of FIELD_GROUPS) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = group.title;
    details.appendChild(summary);

    const grid = document.createElement('div');
    grid.className = 'field-grid';

    for (const field of group.fields) {
      const row = document.createElement('label');
      row.className = `field field-${field.type}`;

      const input = document.createElement('input');
      input.type = field.type === 'bool' ? 'checkbox' : 'number';
      input.addEventListener('input', onChange);
      input.addEventListener('change', onChange);

      const span = document.createElement('span');
      span.textContent = field.label;

      if (field.type === 'bool') {
        row.appendChild(input);
        row.appendChild(span);
      } else {
        row.appendChild(span);
        row.appendChild(input);
      }

      grid.appendChild(row);
      inputs.set(field.key, input);
    }

    details.appendChild(grid);
    container.appendChild(details);
  }

  return (): PatientInput => {
    const input: PatientInput = {};
    for (const [key, el] of inputs) {
      if (el.type === 'checkbox') {
        if (el.checked) (input as Record<string, unknown>)[key] = true;
      } else if (el.value !== '') {
        (input as Record<string, unknown>)[key] = Number(el.value);
      }
    }
    return input;
  };
}

function renderResults(container: HTMLElement, patient: PatientInput): void {
  container.innerHTML = '';
  const results = classifyAll(patient);

  if (results.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No disease definitions matched yet -- check some findings above.';
    container.appendChild(empty);
    return;
  }

  for (const result of results) {
    const card = document.createElement('article');
    card.className = `result-card tier-${result.tier}`;

    const heading = document.createElement('h3');
    heading.textContent = `${result.diseaseName}`;
    const badge = document.createElement('span');
    badge.className = 'tier-badge';
    badge.textContent = result.tier ?? '';
    heading.appendChild(badge);
    card.appendChild(heading);

    for (const [tierName, tierResult] of [
      ['suspected', result.suspected],
      ['probable', result.probable],
      ['confirmed', result.confirmed],
    ] as const) {
      if (!tierResult) continue;
      const tierBlock = document.createElement('div');
      tierBlock.className = `tier-block ${tierResult.met ? 'met' : 'not-met'}`;

      const tierLabel = document.createElement('div');
      tierLabel.className = 'tier-label';
      tierLabel.textContent = `${tierName}: ${tierResult.met ? 'met' : 'not met'}`;
      tierBlock.appendChild(tierLabel);

      const list = document.createElement('ul');
      for (const c of tierResult.matchedCriteria) {
        const li = document.createElement('li');
        li.className = 'matched';
        li.textContent = c;
        list.appendChild(li);
      }
      for (const c of tierResult.missingCriteria) {
        const li = document.createElement('li');
        li.className = 'missing';
        li.textContent = c;
        list.appendChild(li);
      }
      tierBlock.appendChild(list);
      card.appendChild(tierBlock);
    }

    container.appendChild(card);
  }
}

function main(): void {
  const formContainer = document.getElementById('form')!;
  const resultsContainer = document.getElementById('results')!;
  const countEl = document.getElementById('definition-count')!;
  countEl.textContent = String(ALL_DEFINITIONS.length);

  let getPatient: () => PatientInput;

  function update(): void {
    renderResults(resultsContainer, getPatient());
  }

  getPatient = buildForm(formContainer, update);
  update();

  const resetButton = document.getElementById('reset')!;
  resetButton.addEventListener('click', () => {
    formContainer.querySelectorAll('input').forEach((el) => {
      const input = el as HTMLInputElement;
      if (input.type === 'checkbox') input.checked = false;
      else input.value = '';
    });
    update();
  });
}

main();
