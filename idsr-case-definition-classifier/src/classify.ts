import { ALL_DEFINITIONS } from './definitions';
import { ClassificationResult, DiseaseDefinition, PatientInput, Tier } from './types';

/** Runs one patient record against one disease definition, respecting the
 * real tier dependency every source definition has: "confirmed" always
 * means "a [suspected/probable] case that is also lab-confirmed" -- never
 * evaluated independently of the lower tier. */
export function classifyAgainst(input: PatientInput, def: DiseaseDefinition): ClassificationResult {
  const suspected = def.suspected(input);
  const probable = def.probable?.(input);
  const confirmedOwnCriteria = def.confirmed?.(input);

  let tier: Tier | null = null;
  if (suspected.met) tier = 'suspected';
  if (probable?.met) tier = 'probable';
  if (confirmedOwnCriteria?.met && (suspected.met || probable?.met)) tier = 'confirmed';

  return {
    diseaseId: def.id,
    diseaseName: def.name,
    tier,
    suspected,
    probable,
    confirmed: confirmedOwnCriteria,
  };
}

/** Runs one patient record against every registered definition, returning
 * only the diseases that meet at least "suspected" -- a real patient's
 * symptoms can plausibly match more than one, and that's surfaced, not
 * collapsed to a single answer. */
export function classifyAll(input: PatientInput): ClassificationResult[] {
  return ALL_DEFINITIONS.map((def) => classifyAgainst(input, def)).filter((r) => r.tier !== null);
}
