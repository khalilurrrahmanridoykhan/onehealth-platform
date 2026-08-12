# Outbreak Signal Detector

A real, explainable outbreak-detection tool. Not a DHIS2 app -- a standalone Node/TypeScript CLI and library implementing the core mechanics of the **Farrington algorithm** against real historical surveillance data, with every alert carrying the full reasoning behind it, not a bare boolean.

This directly substantiates a claim already sitting in [OneHealth Data Trust](../dhis2-app)'s own feature list -- "explainable alerts" -- that nothing built before this actually proved.

## The method

Farrington CP, Andrews NJ, Beale AD, Catchpole MA. ["A Statistical Algorithm for the Early Detection of Outbreaks of Infectious Disease."](https://academic.oup.com/jrsssa/article/159/3/547/7102453) *Journal of the Royal Statistical Society: Series A*, 1996;159(3):547-563. The foundational method behind the UK's own national surveillance system for years, later extended by Noufaily et al. 2013, ["An Improved Algorithm for Outbreak Detection in Multiple Surveillance Systems"](https://pmc.ncbi.nlm.nih.gov/articles/PMC3692796/) (free via PMC).

The exact mechanics implemented here (`src/algorithm.ts`) were pulled from the R `surveillance` package's own technical documentation for [`algo.farrington`](https://surveillance.r-forge.r-project.org/pkgdown/reference/algo.farrington.html), the standard reference implementation:

1. A **2/3 power transform** on case counts (`src/transform.ts`) to stabilize variance -- count data's variance grows with its mean, so this makes a constant-variance assumption reasonable.
2. A **weighted linear regression** (`src/regression.ts`) fit to the transformed baseline counts against a week index.
3. A **weighted refit**: points whose residual from the initial fit looks like a past outbreak spike get downweighted, so a past outbreak doesn't inflate this year's threshold.
4. An **overdispersion-scaled prediction interval** (`src/stats.ts` for the critical z-value) at a configurable significance level, default `alpha=0.05`.
5. A **low-count guard**: no alarm unless there's real recent case volume (default: at least 5 cases across the past 4 weeks) -- the original's "`limit54`" heuristic, preventing alarms on statistical noise in near-zero baselines.
6. **Every alert is fully explained**, not a boolean: observed count, expected baseline, the upper threshold, how far over (ratio and absolute excess), and whether the low-count guard was the deciding factor.

## Two honest simplifications, stated plainly

**This is a documented simplified reimplementation, not a claimed byte-identical port.** The original fits a quasi-Poisson GLM via iteratively reweighted least squares (a proper log-link regression on count data); this implementation approximates that with weighted ordinary least squares on the power-transformed response -- a standard, much simpler technique that achieves the same variance-stabilizing goal without needing a full GLM solver. `src/regression.ts`'s own comments state this explicitly.

**The baseline window is adapted for the available data, not the classic parameterization.** The original compares each week to the same calendar week across the past 5 years -- built for an endemic, seasonally-recurring disease with years of prior history. The dataset used here is COVID-19, which has no pre-2020 baseline at all -- there is no "typical year" for a genuinely novel pathogen. So this implementation uses a **recent rolling window** (the N most recently complete weeks, default 52) instead. This is a real engineering choice made for the data that's actually available, not a hidden shortcut.

## The dataset

[Our World in Data's weekly COVID-19 case data](https://ourworldindata.org/grapher/weekly-covid-cases.csv), WHO/JHU-sourced, real, public, no authentication needed. One row per country per day from 2020-01-09 onward; the "Weekly cases" column is a genuine rolling 7-day sum recomputed daily (confirmed by inspecting real rows -- every day has a distinct value), so `src/dataClient.ts` samples every 7th day per country to get true, non-overlapping weekly totals rather than double-counted overlapping windows.

## Real verification, not a synthetic demo

Ran the detector against the UK's full real case history (341 weeks, 2020-01-09 to 2026-07-16). It raised 28 alarms. Every single one lines up with a real, publicly documented UK COVID wave:

- **2020-03-05 to 2020-04-09** -- the UK's first wave, leading into the March 23, 2020 national lockdown.
- **2020-10-01 to 2020-11-12** -- the second wave, leading into the November 2020 lockdown.
- **2020-12-24 to 2021-01-14** -- the Alpha-variant winter wave, the UK's deadliest COVID period, leading into the January 2021 lockdown. Peak alarm: 2021-01-07, observed 421,189 weekly cases.
- **2021-07-22** -- the "Freedom Day" Delta surge, following England's July 19, 2021 reopening.
- **2021-12-23 to 2022-01-13** -- the Omicron wave, the specific plausibility check this project set out to run. Peak alarm: 2022-01-06, observed 1,502,832 weekly cases -- a real, correct order of magnitude for what was, at the time, the UK's highest-ever recorded case count.
- **2023-09-28, 2023-10-05** and **2025-09-18 to 2025-10-09** -- smaller, real autumn upticks.

This is the actual proof the method works, not a claim about it: run `COUNTRIES="United Kingdom" npx ts-node src/cli.ts` yourself and compare the output dates against any public COVID timeline.

## Usage

```bash
yarn install   # or npm install
COUNTRIES="United Kingdom,France" npx ts-node src/cli.ts
```

Environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `COUNTRIES` | `United Kingdom` | Comma-separated list, must match the source CSV's exact `Entity` spelling |
| `SHOW_ALL` | `false` | Print every evaluated week, not just alarms |
| `BASELINE_WEEKS` | `52` | How many recent weeks form the rolling baseline |
| `ALPHA` | `0.05` | Prediction-interval significance level |

## `yarn test`

23 unit tests, all pure logic, no network calls in the test suite itself -- `transform.test.ts`, `regression.test.ts` (a zero-weighted outlier is fully excluded from the fit, the exact mechanism the algorithm relies on), `stats.test.ts` (the inverse-normal-CDF approximation checked against well-known textbook z-values), and `algorithm.test.ts` (hand-constructed fixtures: an obvious spike, a value within a tight baseline's own range, and the low-count guard specifically).

**A real bug the test suite caught before this shipped**: a perfectly flat baseline produced a prediction interval that should exactly equal the baseline value, but the power-transform round trip (`x^(2/3)` then `^(3/2)`) doesn't always return a bit-exact float even when the math says it should -- an observed value of exactly `50` compared as *greater than* an upper bound of `49.99999999999999`, a false alarm from floating-point noise, not a real signal. Fixed with an explicit numerical tolerance in `algorithm.ts`, documented there.

## Relationship to sibling projects

Fifth-and-a-half addition to `onehealth-platform`: five DHIS2-native apps, one DHIS2-FHIR interoperability CLI ([`dhis2-fhir-immunization-bridge`](../dhis2-fhir-immunization-bridge)), and now this -- a statistical analysis tool with no DHIS2 dependency at all. Doesn't write to or read from DHIS2; a natural future integration point would be feeding its alerts into something like OneHealth Data Trust's own alerting surface, not attempted here.
