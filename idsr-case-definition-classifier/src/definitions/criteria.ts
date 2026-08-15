import { TierResult } from '../types';

export interface Criterion {
  label: string;
  met: boolean;
}

/** All criteria must be met for the tier to be met. An "any of X, Y, Z" sign
 * group is expressed as a single Criterion with a combined label + `||`'d
 * met expression, so the output stays readable and traceable to the
 * source's own AND/OR structure rather than exploding into a generic tree. */
export function evaluate(criteria: Criterion[]): TierResult {
  return {
    met: criteria.length > 0 && criteria.every((c) => c.met),
    matchedCriteria: criteria.filter((c) => c.met).map((c) => c.label),
    missingCriteria: criteria.filter((c) => !c.met).map((c) => c.label),
  };
}
