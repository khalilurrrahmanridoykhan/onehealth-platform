# AWD-Climate Correlation Analysis

## Scope and status

This is an **exploratory, ecological-level correlation analysis**. It does not establish causation, has not been peer reviewed, and must not be used for outbreak forecasting, early warning, or resource-allocation decisions. Every number below is also returned live, verbatim, by `GET /api/v1/environment/awd-correlation` — including the limitations and disclaimer — so the numbers can never be read separately from their caveats.

This closes the loop opened by the [environment (climate) data overlay](ENVIRONMENT.md): that module was shipped explicitly without any disease-correlation claim. This analysis is the follow-up step promised in the README roadmap, run once the underlying district climate data had been live and checkable.

## Question and data

Does district-level climate (temperature, precipitation, extreme-heat days) relate to Acute Watery Diarrhoea (AWD) case patterns in Bangladesh?

- **AWD data**: `data/processed/awd_annual.csv` — literature-derived ecological incidence estimates, division-level, annual, 2014–2024.
- **Climate data**: `data/processed/environment/district_monthly.csv` — NASA POWER reanalysis, district-level, monthly, 2017–2025.
- **Overlap window**: 2017–2024 (8 years), the intersection of both series.

## Method

**Unit of analysis: division-year.** AWD case data only exists at division level, so district climate had to be aggregated up to match — not the reverse. n = 64 (8 divisions × 8 years).

**Two-stage aggregation**, implemented in `src/onehealth/services/awd_climate_correlation.py`:
1. District-month → district-year: mean for temperature, sum for precipitation and extreme-heat days.
2. District-year → division-year: unweighted mean across a division's districts (consistent with this platform's existing "single centroid per district, not area/population-weighted" convention).

**Two correlation designs, both reported:**
- **Pooled** — correlates raw division-year values across all divisions and years together. Simple, but vulnerable to cross-division confounding: two variables can look related purely because some divisions happen to have both a different climate *and* a different AWD baseline for unrelated reasons (infrastructure, reporting, population density).
- **Within-division** — each division's values are demeaned (its own 8-year average subtracted out) before correlating. This isolates whether a division's own year-to-year climate anomalies track its own year-to-year AWD anomalies, controlling for fixed cross-division differences. A stricter, more defensible test — and, as the results below show, it materially changes the picture for two of the three variables.

**Significance**: two-sided permutation test (5,000 reshuffles, fixed seed `20260807`), not a parametric t-test — this avoids relying on distributional assumptions that don't obviously hold for a sample this small. No dependency on numpy/scipy was added; the correlation, ranking, and permutation code is pure Python, unit-tested against Python's own `statistics.correlation` as an independent cross-check (`tests/test_stats.py`, `tests/test_awd_climate_correlation.py`).

## A note on which AWD metric is used

`incidence_per_100k` (population-normalized) is preferred and is what the results below use, but it is a CSV-only derived column — it does not round-trip through DHIS2 data values, only raw `cases` does. When the platform is configured with `ONEHEALTH_BACKEND=dhis2` (the production default), the endpoint automatically falls back to raw case counts instead of failing, and says so via `awd_metric` and a leading `limitations` entry in its response. Raw counts are not adjusted for the large population differences between divisions (Dhaka's ~36M vs. Barishal's ~8M, for example), which weakens the **pooled** comparison in particular; the **within-division** test is largely unaffected, since a division's own population is roughly stable year to year. The results and interpretation below are from the incidence-normalized run (the CSV backend, reproducible with the command at the bottom of this page) — check the live `awd_metric` field before quoting numbers from the running dashboard directly.

## Results

| Variable | Pooled Pearson *r* | Pooled *p* | Within-division Pearson *r* | Within-division *p* |
|---|---|---|---|---|
| Mean temperature | +0.14 (weak) | 0.265 | **+0.34 (moderate)** | **0.005** |
| Total precipitation | **+0.62 (strong)** | **<0.001** | +0.13 (weak) | 0.414 |
| Extreme-heat days | −0.34 (moderate) | 0.005 | +0.16 (weak) | 0.174 |

*(Spearman ρ and its permutation p-value are also computed and returned by the API for each variable; they closely track the Pearson pattern above and don't change the interpretation.)*

## Interpretation

This is the most interesting part of the result, and it's exactly what the within-division design exists to catch: **precipitation and extreme-heat days both show strong or moderate pooled correlations that mostly evaporate once cross-division confounding is controlled for.** Precipitation's pooled r = 0.62 (p < 0.001) drops to a non-significant 0.13 within-division; extreme-heat days flips sign entirely, from a significant −0.34 pooled to a non-significant +0.16 within-division. Taken at face value, the pooled numbers alone would have been a textbook case of the ecological fallacy this analysis's own limitations warn about — divisions that happen to be rainier, or have fewer extreme-heat days, also happen to differ from other divisions in AWD baseline for reasons the pooled test can't distinguish from a climate effect.

**Temperature is the one variable that holds up under the stricter test**: pooled r is weak and not significant (0.14, p = 0.265), but the within-division relationship is moderate and significant (r = 0.34, p = 0.005) — meaning that within a given division, a warmer-than-usual year tends to coincide with a higher-than-usual AWD incidence that year, independent of how that division compares to others. This is the more credible signal of the three, though still subject to every limitation below — most importantly, that annual aggregation is a genuinely weak test of a mechanism (monsoon flooding driving AWD) that operates on a seasonal timescale this data can't resolve.

## Limitations

- Ecological-level (division-year aggregate) correlation, not individual-level. A relationship at this aggregate level does not establish that climate exposure causes AWD in any individual (the ecological fallacy) — the precipitation and extreme-heat-days results above are a direct illustration of why that distinction matters.
- Small sample: 64 division-years; the within-division test has effectively only 8 year-to-year contrasts per division.
- AWD data is annual. The hypothesized flood/monsoon mechanism operates on a seasonal timescale (AWD peaks in August; monsoon rainfall peaks June–September) that annual aggregation cannot resolve. This is a weak test of that specific seasonal mechanism, not a definitive one.
- AWD incidence figures are literature-derived ecological estimates, not authenticated live surveillance.
- Climate figures use a single unweighted NASA POWER grid centroid per district, then averaged across a division's districts.
- Nine significance tests are reported in total (3 variables × pooled Pearson, pooled Spearman, within-division Pearson); none of the p-values above are adjusted for multiple comparisons. Treat any single p < 0.05 with appropriate caution.
- No adjustment for confounders (water/sanitation infrastructure, population density, health-system reporting capacity) that plausibly relate to both climate and AWD case counts.
- Exploratory analysis only. Not validated for, and must not be used for, outbreak forecasting, early warning, or resource-allocation decisions.

## Reproducing this analysis

```bash
python -c "
from pathlib import Path
from onehealth.services.surveillance import load_surveillance_records
from onehealth.services.environment import load_environment_monthly
from onehealth.services.awd_climate_correlation import build_awd_climate_correlation_report
import json

awd = load_surveillance_records(Path('data/processed/awd_annual.csv'))
monthly = load_environment_monthly(Path('data/processed/environment/district_monthly.csv'))
print(json.dumps(build_awd_climate_correlation_report(awd, monthly), indent=2))
"
```

Or query the live endpoint: `GET /api/v1/environment/awd-correlation`.
