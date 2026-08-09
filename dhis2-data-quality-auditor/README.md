# Data Quality Auditor

A native DHIS2 App that lets **any admin, on any DHIS2 instance**, point coverage, freshness, plausibility, and RDQA-aligned quality checks at **any dataset and data element** -- no bundled programme list, no code changes, no redeploy.

This is a generalized sibling of [OneHealth Data Trust](../dhis2-app), which hardcodes 8 disease programmes for one specific instance. Both apps share the same underlying quality-check logic (see `src/lib/qualityChecks.ts`, ported from OneHealth Data Trust and extended here); this app replaces the static, hand-compiled config with a runtime admin UI backed by this instance's own `dataStore`.

**Scope is unbounded.** There is no fixed audit count and no country tie anywhere in this app's design. Every string a user sees -- dataset names, data element names, org unit names -- comes live from the installing instance's own metadata API. On a fresh install, `audits` is an empty array: nothing is bundled.

## What it checks

Every audit runs the following checks, deliberately built to the rigor of **RDQA (Routine Data Quality Assessment)** -- the WHO/PEPFAR/MEASURE Evaluation framework used worldwide for health-system data quality, since public health surveillance is DHIS2's dominant real-world use case.

| Check | RDQA dimension | What it flags |
|---|---|---|
| `records_present` | Completeness | No data values were returned at all. |
| `declared_location_coverage` | Completeness | An org unit expected to report has no value. |
| `duplicate_records` | Reliability | More than one value for the same period + org unit (after category-option-combo aggregation, see below). |
| `nonnegative_values` | Validity | A negative value where none should exist. |
| `future_periods` | Integrity | A reporting period ending after the assessment date. |
| `trend_spike_drop` *(v1.1, optional)* | Validity | A period-over-period change beyond an admin-set percent threshold -- catches the most common real-world DHIS2 data-entry error (an extra typed zero, a decimal slip). |
| `outlier_detection` *(v1.1, optional)* | Validity | A statistical outlier, via this instance's own native outlier-detection analysis (`/api/dataAnalysis/outlierDetection`, Z-Score) where available, or an interquartile-range (IQR) fallback computed locally if that endpoint isn't available on this instance's DHIS2 core version. |
| `instance_validation_rules` *(v1.1)* | Reliability | Surfaces whether this instance has its own `minMaxDataElements` bounds configured for the audited data element, on top of this app's own checks. |
| `paired_indicator_ratio` *(v1.1, optional)* | Consistency | A period where a second "comparison" indicator's ratio (e.g. positives ÷ tests) falls outside an admin-set expected range -- the DHIS2-native equivalent of RDQA's cross-check step. |

The `trend_spike_drop`, `outlier_detection`, and `paired_indicator_ratio` checks are entirely optional per audit -- an audit that never sets their config fields behaves exactly like a plain v1 core audit; nothing about the base 5 checks changes.

**Deliberate difference from the Python `data_trust.py` service** this logic was originally ported from (via OneHealth Data Trust): raw DHIS2 data values carry no per-value "disease identity" or "data status" field, so there is no DHIS2-native equivalent of that service's `disease_identity`/`evidence_semantics` checks. Provenance (source name/URL, license, DOI) comes from the audit's own admin-entered fields, not from live records, for the same reason.

## Category option combo aggregation

Any data element disaggregated by category (sex, age group, etc.) returns multiple `dataValueSets` rows per period + org unit -- one per category option combination. **Reported values are the sum across all category option combinations** for that period + org unit. This is stated here explicitly because it's a real modeling choice, not full disaggregated reporting: an audit on a disaggregated element reports the total, not a breakdown.

## Supported period types

`Daily`, `Weekly`, `Monthly`, `Quarterly`, `SixMonthly`, `Yearly`. A dataset using an unsupported period type (`BiWeekly`, `WeeklyWednesday`/`Thursday`/`Saturday`/`Sunday`, any `Financial*` variant, `SixMonthlyApril`) is blocked at the audit-creation form with an inline error, rather than silently mis-parsed later.

## `dataStore` schema

Namespace `dataQualityAuditor` (declared in `d2.config.js`), single key `audits`:

```json
GET /api/dataStore/dataQualityAuditor/audits
{
  "schemaVersion": 1,
  "audits": [ { "id": "...", "name": "...", "dataSetId": "...", "...": "..." } ]
}
```

Every add/edit/delete is a full read-modify-write of this one blob (`POST` on first-ever creation, `PUT` thereafter) -- a single blob avoids needing a second index key just to render the audit list.

**Known v1 limitation, not solved, only documented:** classic DHIS2 `dataStore` `PUT` has no ETag/If-Match, so two admins editing audits at the same time is last-write-wins. Acceptable for the assumed single-admin-at-a-time usage.

## Authority handling

Two distinct, honestly-scoped mechanisms:

1. **App visibility** is unrestricted -- viewing quality reports should stay broadly available to any authenticated user.
2. **The "Manage Audits" entry point (add/edit/delete)** is shown only to users whose `GET /api/me.json?fields=authorities` response includes `ALL` (DHIS2 superuser).

Mechanism 2 is **a UI convenience gate, not a real security boundary**. Classic DHIS2 `dataStore` has no built-in per-namespace ACL -- any authenticated user with direct API access can still write to this namespace regardless of what this app's UI shows them. This app does not rely on any version-specific dataStore ACL feature, since that would mean assuming undocumented behavior for a particular DHIS2 core version. If stronger enforcement matters for your instance, verify what your DHIS2 core version's Web API actually supports.

## Install

```bash
yarn install
yarn build       # produces build/bundle/*.zip
yarn test
```

Install the built `.zip` the same way as any other DHIS2 app: **Apps → App Management → Install app → Upload a ZIP file**, or via the App Management API (`POST /api/apps`, multipart, field `file`) if scripting it -- see `scripts/install-to-play-demo.sh` for a working example against DHIS2's own public play server.

## Try it live -- public demo

A shareable "try it live" link runs against **DHIS2's own public [play.dhis2.org](https://play.dhis2.org) demo server**, never a self-hosted instance -- a self-hosted "paste your DHIS2 URL and login" page is a phishing-shaped pattern regardless of intent, and most real instances won't even allow the cross-origin request. `play.dhis2.org` ships with publicly published demo credentials (`admin` / `district`, documented at [docs.dhis2.org](https://docs.dhis2.org)) carrying superuser authority specifically so people can install and try apps.

`scripts/install-to-play-demo.sh` wraps the standard `POST /api/apps` install call against a chosen play instance. **`play.dhis2.org/demo` itself 302-redirects across hosts to the actual current-stable backend** (currently `play.im.dhis2.org/stable-2-43-1`) -- curl correctly refuses to resend Basic Auth across that host change, so `PLAY_URL` must point at the *resolved* backend host directly, not the `play.dhis2.org/demo` alias. Resolve it once with `curl -sI https://play.dhis2.org/demo/` (follow the `location` header, then follow it again -- it's two hops) before running the script.

**Currently installed and verified live at:**
`https://play.im.dhis2.org/stable-2-43-1/apps/data-quality-auditor`
(log in with `admin` / `district` when prompted -- that's DHIS2's own login page, not anything hosted by this project)

**play.dhis2.org instances are periodically reset/rebuilt by DHIS2**, which wipes any installed app -- this is not a "set once" persistent demo, and the link above may need reinstalling before you rely on it. Re-run the script and confirm the app loads before sharing the link again; don't assume it's still live without checking.

The demo shows play's own public, non-sensitive demo datasets -- not anyone's real production data. That's expected: the demo's job is to let a stranger try the tool risk-free.

## Relationship to OneHealth Data Trust

| | OneHealth Data Trust | Data Quality Auditor |
|---|---|---|
| Config | Static, compiled, 8 hardcoded programmes | Runtime, admin-defined, unbounded, in `dataStore` |
| Instance-specific data bundled | Yes -- one Bangladesh instance's dataset/data-element/org-unit UIDs | None -- every string comes live from the installing instance |
| Category option combos | Not handled (never needed to be) | Summed per period + org unit |
| Period types | Weekly, SixMonthly, Yearly | Daily, Weekly, Monthly, Quarterly, SixMonthly, Yearly |
| Settings/admin UI | None | Add/Edit Audit form, gated by authority |
| Advanced checks | None | Outlier detection, trend/spike-drop, instance validation-rule surfacing, paired-indicator ratio |

They are separate DHIS2 App Hub submissions, developed and versioned independently. Changing one does not require changing the other.
