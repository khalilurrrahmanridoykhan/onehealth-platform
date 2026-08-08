"""Exploratory AWD-climate correlation analysis.

Unit of analysis is the division-year (8 divisions x 8 overlapping years,
2017-2024): AWD case data is only available at division level, so district
climate must be aggregated up to match, not the other way round. This is an
ecological-level, exploratory correlation analysis -- see LIMITATIONS below,
which is also returned verbatim in the API report so it can never be viewed
separately from the numbers.

Aggregation is a deliberate two-stage process:
  1. district-month -> district-year (mean for temperature, sum for
     precipitation/extreme-heat days)
  2. district-year -> division-year (unweighted mean across districts,
     consistent with the rest of this platform's "single centroid per
     district, not area/population-weighted" convention)
Summing first and then averaging across a division's districts keeps
precipitation/extreme-heat-day totals in physically meaningful units
(mm/year, days/year per typical district) regardless of how many districts a
division happens to have.
"""

from __future__ import annotations

from collections import defaultdict
from statistics import mean
from typing import Any

from onehealth.models import EnvironmentMonthlyRecord, SurveillanceRecord
from onehealth.services.stats import (
    demean_within_group,
    pearson_r,
    permutation_p_value,
    spearman_rho,
)

N_PERMUTATIONS = 5000
PERMUTATION_SEED = 20260807

CLIMATE_VARIABLES: dict[str, dict[str, str]] = {
    "mean_temp_c": {"label": "Mean temperature", "unit": "°C"},
    "total_precip_mm": {"label": "Total precipitation", "unit": "mm/year"},
    "extreme_heat_days": {"label": "Extreme-heat days", "unit": "days/year"},
}

LIMITATIONS = [
    "This is an ecological-level (division-year aggregate) correlation, not an individual-level analysis. "
    "A relationship at this aggregate level does not establish that climate exposure causes AWD in any "
    "individual (the ecological fallacy).",
    "Sample size is small: 64 division-years (8 divisions x 8 overlapping years, 2017-2024). "
    "The within-division test has effectively only 8 year-to-year contrasts per division.",
    "AWD case data is annual. The hypothesized flood/monsoon-to-AWD mechanism operates on a seasonal "
    "timescale (AWD peaks in August; monsoon rainfall peaks June-September), which annual aggregation "
    "cannot resolve. This is a weak test of that specific seasonal mechanism, not a definitive one.",
    "AWD incidence figures are literature-derived ecological estimates, not authenticated live "
    "surveillance (see the AWD programme's own Data Trust report).",
    "Climate figures use a single unweighted NASA POWER grid centroid per district, not area- or "
    "population-weighted, and are then averaged across a division's districts.",
    "Nine significance tests are reported (3 climate variables x pooled Pearson, pooled Spearman, and "
    "within-division Pearson). Interpret any single p < 0.05 with caution given multiple comparisons; "
    "none of these p-values have been adjusted for that.",
    "No adjustment for confounders such as water/sanitation infrastructure, population density, or "
    "health-system reporting capacity, all of which plausibly relate to both climate and AWD case counts.",
    "This is exploratory analysis. It has not been validated for, and must not be used for, outbreak "
    "forecasting, early warning, or resource-allocation decisions.",
]


def _district_annual(monthly: list[EnvironmentMonthlyRecord]) -> dict[tuple[str, str], dict[str, Any]]:
    groups: dict[tuple[str, str], list[EnvironmentMonthlyRecord]] = defaultdict(list)
    for record in monthly:
        year = record.period_label[:4]
        groups[(record.location_code, year)].append(record)

    result: dict[tuple[str, str], dict[str, Any]] = {}
    for (location_code, year), records in groups.items():
        result[(location_code, year)] = {
            "division_code": records[0].division_code,
            "mean_temp_c": mean(r.mean_temp_c for r in records),
            "total_precip_mm": sum(r.total_precip_mm for r in records),
            "extreme_heat_days": sum(r.extreme_heat_days for r in records),
        }
    return result


def _division_annual(district_annual: dict[tuple[str, str], dict[str, Any]]) -> dict[tuple[str, str], dict[str, Any]]:
    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for (_district_code, year), values in district_annual.items():
        groups[(values["division_code"], year)].append(values)

    result: dict[tuple[str, str], dict[str, Any]] = {}
    for (division_code, year), rows in groups.items():
        result[(division_code, year)] = {
            variable: mean(row[variable] for row in rows) for variable in CLIMATE_VARIABLES
        }
    return result


def build_awd_climate_correlation_report(
    awd_records: list[SurveillanceRecord],
    environment_monthly: list[EnvironmentMonthlyRecord],
) -> dict[str, Any]:
    district_annual = _district_annual(environment_monthly)
    division_annual = _division_annual(district_annual)

    division_years = sorted(
        (
            record
            for record in awd_records
            if record.disease_code == "AWD"
            and record.location_level == "division"
            and (record.location_code, record.period_label) in division_annual
        ),
        key=lambda record: (record.location_code, record.period_label),
    )

    division_codes = [record.location_code for record in division_years]
    years = [record.period_label for record in division_years]

    # incidence_per_100k is a CSV-only derived column: it does not round-trip through
    # DHIS2 data values (only "cases" does), so it is None for every record when
    # ONEHEALTH_BACKEND=dhis2. Degrade to raw cases rather than fail outright --
    # disclosed explicitly below, since raw counts are not population-normalized.
    use_incidence = bool(division_years) and all(
        record.incidence_per_100k is not None for record in division_years
    )
    if use_incidence:
        awd_values: list[float] = [float(record.incidence_per_100k) for record in division_years]  # type: ignore[arg-type]
        awd_metric = {"label": "Estimated AWD incidence", "unit": "cases per 100,000 population"}
    else:
        awd_values = [float(record.cases) for record in division_years]
        awd_metric = {"label": "Estimated AWD cases", "unit": "raw cases (not population-normalized)"}

    variables: dict[str, Any] = {}
    for variable_name, meta in CLIMATE_VARIABLES.items():
        climate_values = [division_annual[(code, year)][variable_name] for code, year in zip(division_codes, years)]
        within_climate = demean_within_group(climate_values, division_codes)
        within_awd = demean_within_group(awd_values, division_codes)

        pooled_pearson = pearson_r(climate_values, awd_values)
        pooled_pearson_p = permutation_p_value(
            climate_values, awd_values, pearson_r, n_permutations=N_PERMUTATIONS, seed=PERMUTATION_SEED
        )
        pooled_spearman = spearman_rho(climate_values, awd_values)
        pooled_spearman_p = permutation_p_value(
            climate_values, awd_values, spearman_rho, n_permutations=N_PERMUTATIONS, seed=PERMUTATION_SEED
        )
        within_pearson = pearson_r(within_climate, within_awd)
        within_pearson_p = permutation_p_value(
            within_climate,
            within_awd,
            pearson_r,
            n_permutations=N_PERMUTATIONS,
            seed=PERMUTATION_SEED,
            groups=division_codes,
        )

        variables[variable_name] = {
            "label": meta["label"],
            "unit": meta["unit"],
            "pooled": {
                "pearson_r": pooled_pearson,
                "pearson_p": pooled_pearson_p,
                "spearman_rho": pooled_spearman,
                "spearman_p": pooled_spearman_p,
            },
            "within_division": {
                "pearson_r": within_pearson,
                "pearson_p": within_pearson_p,
            },
        }

    return {
        "method": {
            "unit_of_analysis": f"division-year (n={len(division_years)}: 8 divisions x "
            f"{len(set(years))} overlapping years)",
            "aggregation": "District-month climate aggregated to district-year (mean for temperature, "
            "sum for precipitation and extreme-heat days), then averaged unweighted across a division's "
            "districts to division-year.",
            "significance_test": f"Two-sided permutation test, {N_PERMUTATIONS} permutations, "
            f"seed={PERMUTATION_SEED}.",
            "pooled_vs_within_division": "Pooled correlates raw division-year values across all divisions "
            "and years. Within-division correlates each division's year-to-year deviations from its own "
            "mean, controlling for fixed cross-division differences.",
        },
        "sample_size": len(division_years),
        "years": sorted(set(years)),
        "divisions": sorted(set(division_codes)),
        "awd_metric": awd_metric,
        "variables": variables,
        "interpretation_guidance": "Rough convention only: |r| < 0.3 weak, 0.3-0.5 moderate, > 0.5 strong. "
        "Nine significance tests are reported in total; treat any single p < 0.05 with caution given "
        "multiple comparisons (see limitations).",
        "limitations": LIMITATIONS if use_incidence else [
            "Population-normalized AWD incidence was not available from the active data backend "
            "(incidence_per_100k does not round-trip through DHIS2 data values); results below use raw "
            "AWD case counts instead, which are not adjusted for differing division populations. This "
            "mainly weakens the pooled comparison across divisions; the within-division test is largely "
            "unaffected, since a division's population is roughly stable from year to year.",
            *LIMITATIONS,
        ],
        "disclaimer": "Exploratory ecological-level correlation analysis. Does not establish causation and "
        "has not been validated for outbreak forecasting or resource-allocation use.",
    }
