// Domain presets -- optional starting points for AuditForm that prefill
// non-identifying fields (thresholds, freshness cadence, source attribution)
// with sensible defaults for a specific surveillance domain. They never
// prefill dataSetId/dataElementId/orgUnits: every DHIS2 instance assigns its
// own UIDs on import, so the admin always still picks the real dataset and
// data element from their own instance's metadata.
//
// First domain covered: AMR (antimicrobial resistance) surveillance, aligned
// to WHO's GLASS framework and the DHIS2 AMR Metadata Package. Thresholds
// below are reasonable starting points grounded in how each indicator type is
// typically reported (see each preset's comment for the specific reasoning),
// not values validated against any one instance's real data -- same
// "thresholds are configurable, not authoritative" stance as the rest of this
// app's advanced checks.

import type { FreshnessMode } from '../types/audit'

export interface AuditPreset {
  id: string
  label: string
  category: 'AMR'
  namePlaceholder: string
  description: string
  freshnessMode: FreshnessMode
  expectedUpdateDays: number
  outlierDetectionEnabled: boolean
  trendChangeThresholdPercent: number
  comparisonLabel: string | null
  expectedRatioMin: number | null
  expectedRatioMax: number | null
  sourceName: string
  sourceUrl: string | null
}

export const AMR_PRESETS: AuditPreset[] = [
  {
    id: 'amr-resistance-rate',
    label: 'AMR -- Priority pathogen resistance rate',
    category: 'AMR',
    namePlaceholder: 'e.g. E. coli / ciprofloxacin resistance, national',
    description:
      "Tracks resistant-isolate counts for a priority pathogen-antimicrobial combination, aligned to the WHO GLASS-AMR module. Pick the resistant-isolate-count data element from your instance's AMR Metadata Package dataset. If you also track the total tested-isolate count as a separate data element, set it as the comparison indicator below -- the ratio check will flag periods where the resistance rate falls outside the expected range.",
    freshnessMode: 'operational',
    // GLASS-AMR data is aggregated and submitted quarterly at the national
    // level; 90 days keeps a facility/sub-national audit from being flagged
    // stale between quarterly rollups.
    expectedUpdateDays: 90,
    outlierDetectionEnabled: true,
    trendChangeThresholdPercent: 40,
    comparisonLabel: 'resistance rate (resistant / tested isolates)',
    expectedRatioMin: 0,
    expectedRatioMax: 1,
    sourceName: 'WHO GLASS (Global Antimicrobial Resistance and Use Surveillance System)',
    sourceUrl: 'https://www.who.int/publications/i/item/9789240076600',
  },
  {
    id: 'amr-consumption',
    label: 'AMR -- Antimicrobial consumption (AMC)',
    category: 'AMR',
    namePlaceholder: 'e.g. Ceftriaxone consumption, DDD/1000 inhabitant-days',
    description:
      "Tracks antimicrobial consumption volumes (e.g. Defined Daily Doses per 1000 inhabitant-days, or facility dispensing counts), aligned to the WHO GLASS-AMC module. Pick the consumption-volume data element from your instance's AMR Metadata Package dataset.",
    freshnessMode: 'operational',
    expectedUpdateDays: 90,
    outlierDetectionEnabled: true,
    // Consumption volumes move more gradually than lab resistance counts, so
    // a tighter threshold catches real reporting slips (e.g. a supply-chain
    // stockout misrecorded as a demand drop) without over-flagging normal
    // seasonal variation.
    trendChangeThresholdPercent: 30,
    comparisonLabel: null,
    expectedRatioMin: null,
    expectedRatioMax: null,
    sourceName: 'WHO GLASS-AMC (Antimicrobial Consumption module)',
    sourceUrl: 'https://www.who.int/initiatives/glass/glass-amc-module',
  },
  {
    id: 'amr-stewardship',
    label: 'AMR -- Antibiotic stewardship / prescribing compliance',
    category: 'AMR',
    namePlaceholder: 'e.g. AWaRe-compliant prescriptions, District Hospital',
    description:
      'Tracks facility-level prescribing/stewardship indicators, such as the share of prescriptions compliant with the facility antibiogram or the WHO AWaRe (Access, Watch, Reserve) classification. Pick the compliant-prescription-count data element, and set total-prescription-count as the comparison indicator to get a compliance-rate check.',
    freshnessMode: 'operational',
    // Stewardship audits are typically reviewed at facility level on a
    // monthly cycle, tighter than the quarterly GLASS national rollup.
    expectedUpdateDays: 30,
    outlierDetectionEnabled: true,
    trendChangeThresholdPercent: 30,
    comparisonLabel: 'compliance rate (compliant / total prescriptions)',
    expectedRatioMin: 0,
    expectedRatioMax: 1,
    sourceName: 'WHO Antimicrobial Resistance surveillance guidance',
    sourceUrl: 'https://www.who.int/activities/facilitating-global-surveillance-of-antimicrobial-resistance',
  },
]
