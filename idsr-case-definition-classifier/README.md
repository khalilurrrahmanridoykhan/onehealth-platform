# IDSR Case-Definition Classifier

A real, explainable rule engine implementing WHO's Integrated Disease
Surveillance and Response (IDSR) standard case definitions -- given a
patient's reported clinical findings, classifies them as **suspected /
probable / confirmed** for each of 18 priority diseases, with every result
showing exactly which criteria matched and which didn't. Not a DHIS2 app --
a standalone Node CLI/library, the same shape as `outbreak-signal-detector`,
applying the same "explainable, not a black box" instinct to rule-based
clinical logic instead of statistics.

## The method, and an honest note on its source

WHO AFRO's [IDSR Technical Guidelines, 3rd edition
(2019)](https://www.who.int/publications/i/item/WHO-AF-WHE-CPI-01-2019)
define these standard case definitions region-wide. The raw WHO IRIS PDF is
served through a JS-rendered DSpace frontend that blocks direct
programmatic fetching, so the concrete source text used here is Kenya's
Ministry of Health, Division of Disease Surveillance and Response's own
published [**"IDSR Standard Case
Definitions"**](https://nphi.go.ke/sites/default/files/2024-02/Case%20definition%20Chart_0.pdf)
chart -- a real, directly-downloadable 4-page PDF. It's Kenya's national
adaptation of the same WHO AFRO 3rd-edition guidelines and quotes the
standard suspected/confirmed criteria essentially verbatim. Every
definition file in `src/definitions/` carries this exact citation and
quotes the relevant source wording inline.

## Scope: 18 diseases, 5 explicitly excluded

23 diseases/conditions appear in the source document across its
"Immediately Reportable" and "Weekly Reportable" lists. **18 have genuinely
rule-encodable case definitions** (explicit symptom/sign/exposure criteria
with AND/OR logic) and are implemented here: Acute Flaccid Paralysis
(Polio), Anthrax, Cholera, Dengue Fever (+ Dengue Haemorrhagic Fever +
Dengue Shock Syndrome), Guinea Worm Disease, Measles, Neonatal Tetanus,
Plague, Rift Valley Fever, SARI, Viral Haemorrhagic Fever syndrome, Yellow
Fever, Acute Jaundice, Diarrhoea with Blood (Shigella dysentery), Malaria
(uncomplicated + severe), Meningococcal Meningitis, Rabies, Typhoid Fever.

**5 are deliberately out of scope**, not silently dropped: AEFI, Maternal
Death, and Neonatal Death are definitional/administrative rather than
symptom-classification problems; TB MDR/XDR is treatment-history-based (re-treatment
status, contact tracing), a genuinely different shape of logic. Forcing
these into the same pattern would have meant faking a case definition that
doesn't really exist in this form.

## How a definition is structured

Each disease is a `DiseaseDefinition` with `suspected`, optionally
`probable`, and optionally `confirmed` check functions (`confirmed` is
optional because SARI's own source definition has no distinct confirmed
tier at all -- omitted here rather than invented). Every check function
returns which criteria matched and which didn't:

```ts
interface TierResult {
  met: boolean;
  matchedCriteria: string[];
  missingCriteria: string[];
}
```

`classifyAgainst` enforces the real tier dependency present in almost
every one of these source definitions ("a *suspected* case confirmed
by..."): a disease is never reported as "confirmed" unless its suspected
(or probable) criteria are *also* met, even if the lab-confirmation
criterion alone is satisfied.

### Two design decisions worth knowing about

- **Malaria and Dengue don't fit a single 3-tier ladder.** Malaria's source
  definition is a real 2x2 matrix (uncomplicated/severe x clinical/lab-confirmed),
  and Dengue is three separate, escalating case definitions (DF -> DHF ->
  DSS), each building on the last. Both are modeled as multiple
  `DiseaseDefinition` entries rather than forced into one three-tier shape
  that would have lost the source's real structure.
- **Rift Valley Fever's source wording is genuinely ambiguous** ("With:
  [exposure] ... And/or: [severe complications]"). The interpretation made
  -- core febrile illness AND (an exposure link OR a severe complications
  picture) -- is documented directly in `riftValleyFever.ts`'s own comment,
  flagged as the single most interpretive call made across all 18
  definitions rather than silently resolved.

## Usage

```bash
npm install
npm run classify -- path/to/patient.json
```

`patient.json` is any subset of the `PatientInput` fields in `src/types.ts`
(all optional -- a real field report never has every value filled in):

```json
{
  "ageYears": 28,
  "acuteWateryDiarrhea": true,
  "diarrheaEpisodesPer24h": 6,
  "vomiting": true
}
```

```
1 disease(s)/condition(s) matched at "suspected" or higher:

Cholera (cholera) -- SUSPECTED
  suspected: MET
    [x] age >=5y with acute watery diarrhoea >=3x/24h, OR (epidemic) age >=2y with acute watery diarrhoea
  confirmed: not met
    [ ] V. cholerae O1/O139 isolated in stool, or epidemiologically linked to a confirmed case
```

A patient's symptoms can plausibly match more than one disease's suspected
criteria -- `classifyAll` returns every match, not a single collapsed
answer.

## Verification

- `npm run typecheck` -- `tsc --noEmit`.
- `npm test` -- 91 tests across 20 suites, hand-built directly from each
  definition's own source wording: at least one case that clearly meets
  "suspected," one that clearly falls short of a specific required
  criterion (and the result names exactly which), and boundary cases where
  the source has a numeric threshold (AFP's age-15 cutoff, meningitis's
  temperature thresholds, dengue's fever-duration window, VHF's 3-week
  window).
- **A real-world plausibility pass** (`src/plausibility.test.ts`): textbook
  presentations for cholera, measles, and meningococcal meningitis,
  deliberately grounded in real, cited, recent outbreaks (the 2025
  multi-country cholera outbreak -- 614,828 cases across 33 countries; the
  2025 global measles resurgence -- 108,074 confirmed cases worldwide,
  the US's worst year since 1991; the 2026 Kent, UK meningitis B
  outbreak), plus a negative control (a common cold correctly matches none
  of the three). WHO's own outbreak reporting publishes aggregate case
  counts, not per-patient symptom checklists, so this is a lighter-weight
  check than the data-heavy sibling projects' verification passes -- stated
  plainly rather than oversold.

## License

MIT (matches the rest of `onehealth-platform`). The case-definition
wording itself is quoted from the cited WHO AFRO / Kenya MOH source
document, not original to this project.
