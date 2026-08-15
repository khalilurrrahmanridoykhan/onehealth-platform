/**
 * Every field here was pulled directly from reading all 18 encoded IDSR
 * case definitions -- nothing spec'd ahead of time and guessed at. Fields
 * are shared across definitions where the same real-world observation
 * applies (e.g. `fever`, `headache`, `ageYears`), so a single patient
 * record can be run against every definition at once.
 *
 * All fields are optional: a real field report will never have every
 * value filled in, and a definition's own check functions treat a missing
 * field as "criterion not met" rather than throwing.
 */
export interface PatientInput {
  // Demographics
  ageYears?: number;
  ageDays?: number; // for neonatal tetanus

  // General findings
  fever?: boolean;
  feverC?: number; // measured temperature, if known
  feverAxillaryC?: number;
  feverRectalC?: number;
  feverDurationDays?: number;
  feverDurationHours?: number;
  suddenOnsetFever?: boolean;
  gradualOnsetPersistentHighFever?: boolean;
  severelyIll?: boolean;
  hospitalized?: boolean;

  headache?: boolean;
  neckPain?: boolean;
  neckStiffness?: boolean;
  alteredConsciousness?: boolean;
  otherMeningealSigns?: boolean;
  chills?: boolean;
  malaise?: boolean;
  severeMalaise?: boolean;
  prostration?: boolean;
  exhaustion?: boolean;
  backache?: boolean;
  musclePains?: boolean; // myalgia
  arthralgia?: boolean;
  photophobia?: boolean;

  cough?: boolean;
  coryza?: boolean;
  soreThroat?: boolean;
  shortnessOfBreath?: boolean;
  chestPain?: boolean;
  bloodStainedSputumCough?: boolean;
  illnessDurationDays?: boolean; // duration of the acute respiratory illness
  diedOfUnexplainedRespiratoryIllness?: boolean;
  pneumoniaSignsOnExamOrXray?: boolean;

  rash?: boolean;
  maculopapularRash?: boolean;
  hemorrhagicOrPurpuricRash?: boolean;
  conjunctivitis?: boolean;
  retroOrbitalPain?: boolean;
  clinicianSuspectsMeasles?: boolean;

  nauseaVomiting?: boolean;
  vomiting?: boolean;
  diarrhea?: boolean;
  acuteWateryDiarrhea?: boolean;
  diarrheaEpisodesPer24h?: number;
  diarrheaWithVisibleBlood?: boolean;
  constipationOrDiarrhea?: boolean;
  abdominalPain?: boolean;
  abdominalDistress?: boolean; // nausea/vomiting/anorexia (anthrax GI form)
  anorexia?: boolean;

  jaundice?: boolean;
  jaundiceOnsetDays?: number; // days since jaundice onset
  jaundiceWithin2WeeksOfFeverOnset?: boolean;
  clinicalJaundice?: boolean; // 3-fold transaminase rise (RVF)

  // Bleeding / haemorrhagic signs
  epistaxis?: boolean;
  haematemesis?: boolean;
  haemoptysis?: boolean;
  bloodInStool?: boolean;
  otherHemorrhagicManifestations?: boolean;
  noKnownPredisposingFactorsForBleeding?: boolean;
  positiveTourniquetTest?: boolean;
  petechiaeEcchymosesPurpura?: boolean;
  bleedingMucosaGiOrInjectionSite?: boolean;
  bleedingIntoSkinOrFromPuncture?: boolean;
  unnaturalVaginalBleeding?: boolean;

  // Shock / circulatory
  rapidWeakPulse?: boolean;
  pulsePressureMmHg?: number;
  hypotensionForAge?: boolean;
  coldClammySkin?: boolean;
  alteredMentalStatus?: boolean;

  // Neuro / rabies-specific
  hydrophobia?: boolean; // fear of water
  anxietyOrAgitation?: boolean;
  abnormalTinglingSensations?: boolean;
  painAtWoundSite?: boolean;

  // Limb weakness (AFP)
  suddenOnsetLimbWeaknessOrFloppiness?: boolean;
  limbWeaknessDueToTrauma?: boolean;
  clinicianSuspectsPolio?: boolean;

  // Anthrax clinical forms
  cutaneousLesionEschar?: boolean;
  pulmonaryProdromeThenHypoxia?: boolean;

  // Skin lesions (guinea worm)
  skinLesionBlisterOrBoil?: boolean;
  wormEmergedFromLesion?: boolean;

  // Neonate-specific (neonatal tetanus)
  normalSuckCryFirst2Days?: boolean;
  cannotSuckNormallyAfterDay3?: boolean;
  stiffness?: boolean;
  convulsions?: boolean;

  // Lymphadenopathy (plague)
  painfulLymphNodeSwelling?: boolean;

  // Malaria
  signsOfSevereDisease?: boolean; // vital organ dysfunction, clinically diagnosed
  diagnosedClinicallyAsMalaria?: boolean;
  malariaBloodFilmOrTestPositive?: boolean;
  plasmodiumParasitaemiaConfirmed?: boolean;

  // Exposures
  contactWithSickOrDeadAnimal?: boolean;
  epiLinkAnimalCase?: boolean; // anthrax: link to confirmed/suspected animal case or contaminated animal product
  recentTravelToRvfArea?: boolean;
  livesInHighRiskGuineaWormArea?: boolean;
  travelToGuineaWormEndemicArea?: boolean;
  animalBiteOrScratch?: boolean;
  contactWithSalivaFromSuspectedRabidAnimal?: boolean;
  epiLinkConfirmedCaseOrOutbreak?: boolean;
  choleraEpidemicDeclared?: boolean; // context flag: is an epidemic currently declared

  // Treatment response
  unresponsiveToAntibioticOrAntimalarial?: boolean;

  // Lab values
  plateletCountPerMm3?: number;
  hemoglobinGdL?: number;
  hematocritRise20PercentForAgeSex?: boolean;
  hematocritDrop20PercentAfterFluidReplacement?: boolean;
  plasmaLeakSigns?: boolean; // pleural effusion / ascites / hypoproteinaemia
  creatinineUmolL?: number;
  reducedUrineOutput?: boolean;
  edema?: boolean;
  leucopenia?: boolean;
  severePallor?: boolean;
  kidneyFailureSigns?: boolean;

  // Lab confirmations (disease-specific)
  poliovirusIsolatedStool?: boolean;
  bAnthracisIsolatedFromTissue?: boolean;
  vCholeraeO1O139IsolatedStool?: boolean;
  dengueLabConfirmed?: boolean; // positive IgM, rising IgG, positive PCR, or viral isolation
  measlesIgmPositive?: boolean;
  yPestisIsolated?: boolean;
  rvfIgmOrPcrPositive?: boolean;
  vhfLabConfirmed?: boolean;
  yellowFeverLabConfirmed?: boolean;
  etiologicalLabConfirmedJaundice?: boolean; // e.g. viral hepatitis, aflatoxicosis
  shigellaDysenteriaeType1Cultured?: boolean;
  nMeningitidisIsolatedCsfOrBlood?: boolean;
  rabiesVirusIsolated?: boolean;
  salmonellaTyphiIsolated?: boolean;
}

export interface TierResult {
  met: boolean;
  matchedCriteria: string[];
  missingCriteria: string[];
}

export type Tier = 'confirmed' | 'probable' | 'suspected';

export interface DiseaseDefinition {
  id: string;
  name: string;
  /** Exact citation for where this definition's wording comes from. */
  source: string;
  suspected: (input: PatientInput) => TierResult;
  probable?: (input: PatientInput) => TierResult;
  /** Optional: not every source definition includes a distinct confirmed
   * tier (e.g. SARI's source definition has none at all) -- omitted rather
   * than faked, so the absence is visible in the code, not papered over. */
  confirmed?: (input: PatientInput) => TierResult;
}

export interface ClassificationResult {
  diseaseId: string;
  diseaseName: string;
  /** Highest tier met, or null if not even "suspected" criteria are met. */
  tier: Tier | null;
  suspected: TierResult;
  probable?: TierResult;
  confirmed?: TierResult;
}
