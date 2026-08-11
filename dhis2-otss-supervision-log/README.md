# OTSS Supervision Log

A native DHIS2 App: a supportive-supervision checklist structured around the real **OTSS** (Outreach Training and Supportive Supervision) model, tracking two separate things per facility visit -- whether the checklist was actually **completed**, and how the observed **competency** scored within whatever was completed.

This isn't a generic checklist app. It's built directly from a published evaluation of a real electronic supervision tool:

> Burnett SM, Wun J, Davis KM, Martin T, Alombah F, Robertson M, Hamilton P, Evance I, Smith G, Lussiana C, Tesha G, Quao A. "Introduction and Evaluation of an Electronic Tool for Improved Data Quality and Data Use during Malaria Case Management Supportive Supervision." *American Journal of Tropical Medicine and Hygiene*, 2019;100(4):889-898. [PMC6447118](https://pmc.ncbi.nlm.nih.gov/articles/PMC6447118/)

That paper evaluated the **MalariaCare Electronic Data System (EDS)** -- an Android app that replaced paper OTSS checklists and fed results into DHIS2, across 4,951 health facilities in 7 African countries (2015-2017). Its headline finding: paper checklists averaged only **42% data completeness** and took **5+ months** to analyze; the electronic tool raised completeness to **89%** and cut analysis time to about a month. A companion visual analysis of the full paper's numbers is published separately.

**This app is a smaller, single-admin-configurable reinterpretation of that idea, not a claimed replacement for a tool that ran at national scale.** One real, honest limitation stated plainly: the original EDS was a dedicated Android app built for field conditions, including offline data capture. This is a standard browser-based DHIS2 app and requires connectivity -- there is no offline mode.

This is the fifth app in `onehealth-platform`, alongside OneHealth Data Trust, Data Quality Auditor, Data Share Hub, and AMR Stewardship Log. It does not modify any of the four.

## The two-metric design, straight from the paper

The source paper evaluated its tool on two separate axes, and this app keeps them separate rather than blending them into one score:

- **Completeness** -- of the checklist modules that apply (the admin has defined at least one item for them), how many were actually, validly filled in during this visit? Mirrors the paper's own headline 42%->89% completeness finding.
- **Competency** -- within only the modules that met their own validity rule, what fraction of items scored "Yes"? An incomplete module's partial answers never get to inflate or deflate this number.

## The OTSS module structure

5 of the paper's 6 real OTSS modules are scored checklists here, each with its own validity rule taken directly from the paper's methodology (`src/lib/scoring.ts`):

| Module | Kind | Validity rule |
|---|---|---|
| Microscopy observation | Observation | At least 1 non-N/A response |
| Malaria RDT observation | Observation | At least 1 non-N/A response |
| Clinical observation | Observation | At least 1 non-N/A response |
| Adherence (register review) | Register review | At least N records reviewed (admin-configurable, default 5 -- the paper used 5 or 10 depending on indicator) |
| General OTSS (staffing, commodities, infrastructure) | General | At least 1 non-N/A response |

The paper's 6th module, "Feedback and action plans," isn't a scored checklist -- in the paper it's exactly what it sounds like, and here it maps directly to this app's own `gapsIdentified` / `actionPlan` / `followUpDate` fields on the visit form.

**No bundled checklist content ships with this app.** Every item under every module is admin-defined from scratch, same "unbounded, admin-configurable" stance as every sibling app's own core domain object (Data Quality Auditor's audits, Data Share Hub's data slices, AMR Stewardship Log's formulary). A module with zero configured items simply doesn't count toward completeness -- it isn't "applicable" -- rather than showing as a false failure.

## What gets created on your instance

On first use (`src/hooks/useProvisionProgram.ts`, self-healing `findOrCreateProgram()` pattern identical to the sibling apps):

- 7 `TRACKER`-domain data elements: cadre observed, a JSON-serialized checklist-responses blob, completeness %, competency %, gaps identified, action plan, and a `DATE`-typed follow-up date.
- One event program, **`OTSS Supervision Log`**, `programType: WITHOUT_REGISTRATION` -- no patient or individual-health-worker identity anywhere. Visits are scoped to facility (org unit) and cadre (a role, e.g. "Nurse"), never a named person -- this is an M&E tool, not a performance-review system tied to one individual.
- One program stage, **`Supervision visit`**, holding those 7 data elements.

## Why a JSON blob, not one data element per checklist item

A checklist's item count and wording is admin-defined and varies by programme -- the naive approach (one DHIS2 data element per item) means provisioning and PATCHing new tracker data elements onto an existing ProgramStage every time an admin adds an item. That's a real, never-verified-in-this-project DHIS2 mechanic, and it scales badly.

Instead, one `LONG_TEXT` data element (`checklistResponses`) holds a JSON array of `{ itemId, moduleType, status, note }` for the whole visit. Item *definitions* live in this app's own `dataStore` settings, never in DHIS2 metadata. Tradeoff, stated plainly: individual checklist items aren't queryable through DHIS2's own native analytics by a third-party tool, only through this app's own client-side parsing -- acceptable since the visit summary is already client-computed for the same reason every sibling app's own summary is.

## Reused mechanics (not re-verified, already confirmed live)

This app reuses the exact DHIS2 Tracker/Program mechanics `dhis2-amr-stewardship-log` confirmed live against play.dhis2.org (stable-2-43-1) -- see that app's `lib/provisioning.ts` for the full trail:

1. `POST /api/programs` does **not** accept a nested `programStages` array. The Program and its ProgramStage are created as two separate calls.
2. A Program's sharing access string uses the same 4-part convention as datasets/dashboards (`r-rw----` = metadata read-only, data read+write). DHIS2's own org-unit capture-scope check remains the real security boundary on who can submit a visit for which facility -- confirmed live (for the sibling app) that an out-of-scope account gets a real `409`, not a silent failure.

The one genuinely new-to-this-app element -- the `DATE` valueType on `followUpDate` -- was verified live during this app's own build/verification pass rather than needing a separate up-front spike, since it's a standard, well-documented DHIS2 value type.

## Authority handling

Same two-tier pattern as every sibling app:

1. Viewing the checklist and visit summary is unrestricted.
2. **"Configure"** (checklist editing, org-unit scoping, program provisioning) is gated by `ALL` or `M_dhis-web-app-management`, reusing `useCurrentUserAuthorities.ts` verbatim.
3. **Submitting a visit is not gated by this app's UI at all.** DHIS2's own org-unit capture-scope check on `POST /api/tracker` is the real, server-enforced boundary.

## `dataStore` schema

Namespace `otssSupervisionLog`, single key `settings`:

```json
GET /api/dataStore/otssSupervisionLog/settings
{
  "schemaVersion": 1,
  "provisioned": { "programId": "...", "programStageId": "...", "dataElementIds": { "...": "..." } },
  "checklist": [ { "id": "...", "moduleType": "Clinical", "label": "..." } ],
  "registerReviewRequiredSample": 5,
  "orgUnits": [ { "id": "...", "name": "..." } ]
}
```

Same single-blob-per-key, read-modify-write pattern as every sibling. Same known v1 limitation: classic DHIS2 `dataStore` `PUT` has no ETag/If-Match, so two admins editing configuration simultaneously is last-write-wins.

## v1 scope

**Buildable now, shipped:** program auto-provisioning, admin-defined checklist with no bundled content, org-unit-scoped visit form with paper-grounded module validity rules, dual completeness/competency scoring, client-computed cross-visit summary (average scores, overdue follow-ups, most frequent No/Partial items), dataStore-backed settings, authority-gated configuration.

**Explicitly deferred:** per-checklist-item DHIS2-native queryability (the JSON-blob tradeoff, above), any individual health-worker identity/tracking, offline data capture (the original EDS's core field-conditions advantage), trend charts over time (v1 shows current aggregate numbers, not a time series), CI wiring, multi-admin concurrent-edit safety.

## Install

`yarn build` produces an installable zip at `build/bundle/`. In DHIS2: **Apps -> App Management -> Install app -> Upload a zip file**, or via the API: `POST /api/apps` (multipart, field name `file`) as a user with the `M_dhis-web-app-management` authority.

## Relationship to sibling apps

| App | Reads/writes | What it's for |
|---|---|---|
| OneHealth Data Trust | Aggregate `dataValueSets` | Evidence/quality reporting for 8 fixed disease programmes on one instance |
| Data Quality Auditor | Aggregate `dataValueSets` + `dataStore` | Admin-configurable RDQA-style quality checks on any dataset, any instance |
| Data Share Hub | Aggregate data, users, sharing, dashboards | Guided external data sharing -- CSV export or a scoped API account |
| AMR Stewardship Log | Tracker events, programs | Point-of-care antibiotic prescribing checklist, AWaRe-aligned |
| **OTSS Supervision Log** | **Tracker events, programs** | **Supportive-supervision checklist, structured around a real published OTSS evaluation** |
