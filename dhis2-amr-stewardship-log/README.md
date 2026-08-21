# AMR Stewardship Log

A native DHIS2 App: a point-of-care antibiotic prescribing checklist, aligned to WHO's **AWaRe** framework (Access / Watch / Reserve). A prescriber logs what they gave, for what, and whether it was empiric or culture-guided; a Watch- or Reserve-category choice requires a justification note before it can be submitted. A compliance summary shows the resulting mix and flags any entry missing a required justification. For any entry started as **Empiric**, a **de-escalation follow-up** can later be recorded once culture results are known -- narrowed, continued, broadened, or discontinued -- and the compliance summary tracks a follow-up rate and de-escalation rate alongside the AWaRe mix.

This app was developed alongside three sibling DHIS2 apps -- [OneHealth Data Trust](https://github.com/khalilurrrahmanridoykhan/onehealth-platform/tree/main/dhis2-app), [Data Quality Auditor](https://github.com/khalilurrrahmanridoykhan/onehealth-platform/tree/main/dhis2-data-quality-auditor), and [Data Share Hub](https://github.com/khalilurrrahmanridoykhan/onehealth-platform/tree/main/dhis2-data-share-hub) -- in the [`onehealth-platform`](https://github.com/khalilurrrahmanridoykhan/onehealth-platform) monorepo, which this app was split out from into its own repository. It does not modify any of the three.

## Why this instead of a WHONET importer

The obvious adjacent idea in this space -- importing WHONET lab export files into DHIS2 -- is already built and deployed: [`Julhas08/whonet-dhis2-importer-app`](https://github.com/Julhas08/whonet-dhis2-importer-app). Building a competing importer would duplicate real, shipped work. Antibiotic stewardship/prescribing is a different problem (a clinical workflow, not a lab-data pipeline) and untouched territory next to that project.

## What makes this app different from its three siblings

OneHealth Data Trust, Data Quality Auditor, and Data Share Hub only ever read or write **aggregate** DHIS2 data (`dataValueSets`, `dataStore`, `dataSets`). This is the first app in the family to touch DHIS2's **Tracker/event-capture** API -- a genuinely different part of the platform, verified live via a standalone `curl` spike before any UI was built on top of it (same discipline that caught real bugs in Data Share Hub's Sharing API and dashboard-creation work). It's also the first app in the family, and the first feature in this app, to **update** a Tracker event it previously created rather than only ever creating new ones -- the de-escalation follow-up feature (below) posts back to the same event UID. Findings from those spikes:

1. **`POST /api/programs` with a nested `programStages` array does not work.** It fails with `Invalid reference ... (ProgramStage) ... [null]`, even though the program itself briefly gets created (then rolled back with the rest of the transaction). The program and its stage have to be created as **two separate calls**: `POST /api/programs` first (no `programStages`), then `POST /api/programStages` referencing the new program via `program: {id}`.
2. **A Program's sharing access string uses the same 4-part convention as datasets and dashboards.** `r-rw----` (metadata read-only, data read+write) was granted publicly, then verified with two real, separately-created test accounts: an org-unit-scoped account could submit a real event; an out-of-scope account was rejected with a genuine `409` and a specific message (`User: ... has no capture scope access to OrganisationUnit: ...`). DHIS2's own org-unit capture-scope check remains the real security boundary regardless of this sharing grant -- this app does not widen it.
3. **Updating an existing Tracker event's `dataValues` MERGES by `dataElement`, it does not replace the array wholesale.** Verified live for this app's own shape: an update sent with only 2 of 5 `dataValues` left the other 3 untouched on read-back. A separate, explicit `value: ""` *does* clear a field -- distinct from omitting it, which leaves the existing value alone. This is what makes the de-escalation follow-up feature (below) safe: a follow-up update only needs to know about the 3 follow-up fields, not resend everything else it doesn't touch. (This builds on, but is independently verified from, a related finding already documented in a sibling project, [`dhis2-fhir-sync-console`](https://github.com/khalilurrrahmanridoykhan): that `importStrategy=UPDATE` against an existing event's own UID genuinely updates that event rather than creating a new one.) `buildFollowUpEventPayload()` still resends the complete known `dataValues` set unconditionally regardless -- defensive by design, not because merge was found unsafe.

Both the first two findings are encoded directly in `src/lib/provisioning.ts`'s implementation, with the reasoning in its module comment; the third is encoded there too, as of the de-escalation follow-up feature.

## What gets created on your instance

On first use, this app provisions its own metadata (see `src/hooks/useProvisionProgram.ts`):

- 8 `TRACKER`-domain data elements: the original 5 (antibiotic name, indication, empiric-or-culture-guided, AWaRe category, justification note) plus 3 added for the de-escalation follow-up feature (outcome, review date, note)
- One event program, **`AMR Stewardship Log`**, `programType: WITHOUT_REGISTRATION` -- no patient identity of any kind. Every entry is an anonymous, facility-level event. This is also why a follow-up updates the *same* event rather than adding a second program stage: `WITHOUT_REGISTRATION` is hard-limited by the platform to exactly one stage, so one antibiotic course is one record, completed over time.
- One program stage, **`Prescribing entry`**, holding the 8 data elements above

If this metadata already exists (a second admin opening Configure, or a redeploy), it's **adopted and extended, not re-created**: `findOrCreateProgram()` scans the existing program stage, and creates + attaches only whatever data elements are actually missing (`scanExisting()` / `attachMissingDataElements()` in `useProvisionProgram.ts`). This is deliberately different from the earlier "self-heals" description of this same function -- that description was only ever accurate for a *partially provisioned* install; run against an install that's already complete but missing a *newly introduced* field (as every pre-follow-up install now is), the old logic would have retried creating data elements that already exist and thrown on DHIS2's own uniqueness constraint. `SetupPanel.tsx` also now calls `findOrCreateProgram()` on **every** save, not just the first one -- previously it only ran once, so an already-provisioned install could never pick up a field introduced by a later release. An admin opening "Configure Stewardship" on a pre-follow-up install sees a notice that saving will extend the program stage with the 3 new fields; existing entries and data are unaffected.

## No bundled antibiotic or AWaRe data

The formulary (antibiotic name -> Access/Watch/Reserve/Not classified) is entirely admin-defined, starting empty on every install. This was a deliberate choice, not a shortcut: shipping WHO's real AWaRe list accurately would require sourcing and version-tracking it from an authoritative WHO publication, which wasn't done for this release. A guessed or stale drug-classification list is worse than none. A verified starter list, sourced properly, is a reasonable v1.1 addition -- not attempted here.

## Compliance summary is computed client-side, not a DHIS2 Dashboard

Data Share Hub creates real DHIS2 Visualizations and Dashboards for its recipients; this app doesn't, on purpose. DHIS2's event-analytics tables need a generation cycle this app can't rely on existing on a fresh install, so the compliance summary (`src/lib/awareRules.ts`'s `computeComplianceSummary()`) is computed directly from the same queried Tracker events the entry list renders -- always consistent, no analytics-lag gap. The missing-justification check runs on every queried entry, not just ones submitted through this app's own form, so it still catches an entry submitted by any other API client that bypassed this app's client-side validation.

## Authority handling

Same two-tier, honestly-scoped pattern as every sibling app:

1. **Viewing the checklist and compliance summary** is unrestricted.
2. **"Configure Stewardship"** (formulary edit, org-unit scoping, program provisioning) is gated by `ALL` or `M_dhis-web-app-management`, reusing `useCurrentUserAuthorities.ts` verbatim from the sibling apps -- same UI-convenience framing, not a real security boundary on its own.
3. **Submitting an entry is not gated by this app's UI at all.** DHIS2's own org-unit capture-scope check on `POST /api/tracker` is the real, server-enforced boundary -- confirmed live (see above) to return a genuine `409` for an out-of-scope account, not a silent failure.

## `dataStore` schema

Namespace `amrStewardshipLog` (declared in `d2.config.js`), single key `settings`:

```json
GET /api/dataStore/amrStewardshipLog/settings
{
  "schemaVersion": 2,
  "provisioned": {
    "programId": "...",
    "programStageId": "...",
    "dataElementIds": {
      "antibiotic": "...", "indication": "...", "empiricOrCultureGuided": "...", "awareCategory": "...", "justificationNote": "...",
      "deEscalationOutcome": "...", "deEscalationDate": "...", "deEscalationNote": "..."
    }
  },
  "formulary": [ { "id": "...", "antibioticName": "...", "awareCategory": "Watch", "note": null } ],
  "orgUnits": [ { "id": "...", "name": "..." } ]
}
```

Same single-blob-per-key, read-modify-write pattern as every sibling (`POST` on first-ever save, `PUT` thereafter). Same known v1 limitation: classic DHIS2 `dataStore` `PUT` has no ETag/If-Match, so two admins editing configuration simultaneously is last-write-wins.

`schemaVersion` was bumped to `2` for the de-escalation follow-up feature, which added the 3 `deEscalationOutcome`/`deEscalationDate`/`deEscalationNote` keys to `dataElementIds` -- optional in the type, so a `schemaVersion: 1` blob written before this feature still reads without a migration step; the fields are simply absent until an admin next saves "Configure Stewardship" against that install.

## v1 scope

**Buildable now, and shipped:** program auto-provisioning verified live, admin-defined formulary with no bundled drug data, org-unit-scoped checklist with AWaRe-aware justification requirement, real Tracker event submission, client-computed compliance summary, dataStore-backed settings, authority-gated configuration with real server-error surfacing, **de-escalation follow-up** (record what happened to an empiric prescription once culture results are known, plus follow-up-rate/de-escalation-rate metrics), adopt-and-extend provisioning so an existing install picks up newly introduced data elements without manual intervention.

**Explicitly deferred, not half-built:** a bundled/starter AWaRe reference list (needs sourcing from an authoritative, versioned WHO publication first), picking an *existing* compatible program instead of always auto-provisioning one, any patient-level/tracked-entity identity, integration with `whonet-dhis2-importer-app` or any WHONET file format, native DHIS2 Dashboard/Visualization generation, CI wiring (consistent with every sibling's existing precedent), multi-admin concurrent-edit safety, **a point-in-time history of a follow-up** (DHIS2 per-event change-log endpoints exist in recent versions but weren't investigated or assumed here -- recording a follow-up overwrites the event's follow-up fields with no record of what they held before).

## Install

`yarn build` produces an installable zip at `build/bundle/`. In DHIS2: **Apps -> App Management -> Install app -> Upload a zip file**, or via the API: `POST /api/apps` (multipart, field name `file`) as a user with the `M_dhis-web-app-management` authority.

## Try it live -- public demo

Installed on `play.dhis2.org`'s currently-published demo instance the same way as its siblings. Play instances reset periodically -- re-run `scripts/install-to-play-demo.sh` before sharing a link rather than assuming a previously-shared one is still live.

## Relationship to sibling apps

| App | Reads/writes | What it's for |
|---|---|---|
| OneHealth Data Trust | Aggregate `dataValueSets` | Evidence/quality reporting for 8 fixed disease programmes on one instance |
| Data Quality Auditor | Aggregate `dataValueSets` + `dataStore` | Admin-configurable RDQA-style quality checks on any dataset, any instance |
| Data Share Hub | Aggregate data, users, sharing, dashboards | Guided external data sharing -- CSV export or a scoped API account |
| **AMR Stewardship Log** | **Tracker events, programs** | **Point-of-care antibiotic prescribing checklist, AWaRe-aligned** |
