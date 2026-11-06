# PRD coverage — what this fork implements

Status of every stage and functional requirement in [Autonomous_ICP_Discovery_PRD_v1.md](../Autonomous_ICP_Discovery_PRD_v1.md),
after the `gtm-system` work. ✅ built and tested · 🟡 partial (limits stated) · ⬜ not built.

## Where the original repo stood

The upstream repo had a thin live slice: crawl a website, four optional OpenAI calls (map, analyst, skeptic,
verifier), a literal-quote gate and a dashboard — plus a separate offline scoring engine (`engine.js`) that the live
path never used. The dashboard's page file was broken (its filename was the page source), so the app did not load.
Search queries were hard-coded to "cybersecurity". There was no human review, no validation sprint, no learning loop,
no refresh mode, no pause/cancel, no evidence grades or score ranges in the live path, and no downstream GTM.

## Workflow stages (PRD §7)

| Stage | Status | Where | Notes |
|---|---|---|---|
| S0 Policy bootstrap | ✅ | `lib/policy.js`, `lib/stages/intake.js` | Modes (quick, discovery, deep, refresh), page/search/model/$/deadline budgets, forbidden domains (people-data sites by default), adapter registry with `approved/restricted/disabled`, policy hash in the audit log. |
| S1 Business understanding | ✅ | `lib/stages/intake.js` | Business Understanding Card with `user_declared` / `publicly_observed` (quote-checked) / `agent_inferred` facts. "Observed" facts whose quote is not on a retained page are downgraded. Offer decomposition; owner's explicit offer list wins. |
| S2 Market universe | ✅ | `lib/stages/explore.js` | Owner segments + divergent cartographer segments across 12 archetypes, round-robin diversity, ≥3-archetype gate reported. |
| S3 Source plan / query lattice | ✅ | `lib/stages/explore.js` | Support and disconfirming queries per segment × angle, offer-level substitute/pricing queries, budget-ranked; coverage matrix and cross-cuts recorded with reasons. |
| S4 Collection + provenance | ✅ | `lib/crawler.js`, `lib/evidence.js`, `lib/stages/collect.js` | SSRF guard, robots.txt, same-site redirects only, size/time caps, Playwright fallback, content hash, published date, source tier, syndication families, injection sentences stripped and flagged, gaps logged. |
| S5 Extraction + entity resolution | ✅ | `lib/stages/collect.js`, `lib/evidence.js` | Claims admitted only when the quote is literally in the source; rejected extractions kept for audit. Organizations merge only on a shared registrable domain; similar names go to an ambiguity queue. |
| S6 Hypotheses | ✅ | `lib/stages/analyze.js` | ICP cards with falsifiable hypothesis, structural-fit criteria, disqualifiers, boundary examples, buying group; gate issues listed. Learned negative rules are applied. |
| S7 Competition & economics | 🟡 | `lib/stages/analyze.js` | Alternatives matrix incl. in-house, status quo, free tools, non-consumption. Market size is always `insufficient_data`: there is no sourced TAM model yet (deliberately — F11). |
| S8 Red team | ✅ | `lib/stages/challenge.js` | Separate role, all 15 PRD §8 tests, "fail" needs a checkable citation (else downgraded), kill switch must quote a retained source, deterministic tests always run and are the floor without a model. |
| S9 Verification + scoring | ✅ | `lib/stages/challenge.js`, `lib/scoring.js` | Verifier sees only claim, quote and source context. Grades A/B/C/D/U, per-dimension score intervals (missing evidence widens, never zeroes), decision bands, hard gates, ±25% weight sensitivity check. |
| S10 Portfolio + memo | ✅ | `lib/stages/decide.js`, `lib/reports.js` | Top 3/5 with diversification, watchlist, zero-recommendation path with gap-closure plan, why-not per offer, anti-ICPs, pre-registered experiments, lead-intelligence brief, decision memo. |
| S11 Review + export | ✅ | `lib/review.js`, `app/api/runs/[id]` | Human accept / reject (reason code) / edit (with history) / deepen (child deep run); exports: memo, JSON, claims/sources/ICP CSV, lead brief. No CRM connector (exports only). |
| S12 Learning | 🟡 | `lib/learning.js` | Feedback + outcomes with reason codes, calibration cohorts, source precision, VOY, proposals evaluated offline against known answers, human-only promotion, rollback, changelog. No scheduled refresh and no time-windowed cohort controls yet. |

## Functional requirements (PRD §19)

| ID | Status | Evidence |
|---|---|---|
| F01 Low-friction intake | ✅ | `createRun` needs only name, offer, problem; missing fields become unknowns. |
| F02 Multi-offer decomposition | ✅ | FoxFoster pilot keeps six offer trees; intake decomposes when no list is given. |
| F03 Coverage matrix | ✅ | `run.coverage` — every segment × angle is planned/searched/deferred with a reason. |
| F04 Reproducible source plan | ✅ | `run.searchPlan` stores query, adapter, results, errors; stage records hold hashes and cost. |
| F05 Policy-compliant collection | ✅ | Test `F05 policy-forbidden domains are never fetched`. |
| F06 Evidence provenance | ✅ | Test `F06 fabricated quotes are rejected…`. |
| F07 Entity resolution | ✅ | Test `F07 similar names are not merged without a shared domain`. |
| F08 Intent separation | ✅ | `buyingIntent` stays `not_observed`; Company A fixture test (§17.5). |
| F09 Independent red team | ✅ | Test `red-team "fail" without a checkable citation…`. |
| F10 Independent verification | ✅ | Verifier payload excludes cards; heuristic claims can never verify. |
| F11 No fabricated market size | ✅ | Test `F12 … F11 market size is never invented`. |
| F12 Explicit anti-ICPs | ✅ | `run.antiIcps`, rejected segments, disqualifiers, boundary examples. |
| F13 False-negative handling | ✅ | No evidence → `defer`, never `reject` (test). |
| F14 No forced winner | ✅ | Zero recommendations with gap-closure plan (test). |
| F15 Reproducibility | ✅ | Test `F15 same frozen inputs and fixtures give the same decisions`. |
| F16 Controlled feedback | ✅ | Learning proposals need `human:` actor; regressions stay in shadow (test). |
| F17 B2C support | ✅ | Individual-paid, institution- and employer-sponsored paths are separate segments. |
| F18 Operator controls | ✅ | Pause / cancel / resume from checkpoint; card edits; export audit trail (cancel test). |
| F19 Delta refresh | ✅ | Refresh run re-fetches sources, re-extracts only changed pages, reports new/unchanged/stale claims and decision changes. |
| F20 CRM handshake | 🟡 | Account criteria + evidence exported as CSV/JSON/lead brief; no live CRM write (disabled by design). |
| F21 Source planner optimization | 🟡 | Budget-ranked lattice and learned source priors; no per-query information-gain model. |
| F22 Outcome-based calibration | 🟡 | Cohorts by decision band and grade with minimum-n caveats; no time windows yet. |
| F23 Multilingual | ⬜ | English-language bias is disclosed in every run report. |
| F24 Collaborative approvals | 🟡 | Named reviewer on every sign-off and comparative run view; no roles/permissions. |

## Beyond the PRD: downstream GTM (inspired by the local Vyve and Hyperleap pipelines)

| Capability | Where | Safety rule |
|---|---|---|
| Sample-account discovery for an accepted ICP | `lib/gtm/accounts.js` | Organizations only, buyer is a role; every fit criterion and signal must quote the org's own page; launch/hiring/funding = timing only. |
| Account state machine | `lib/gtm/accounts.js` | `APPROVED`/`REJECTED` are human-only; drafting or queueing before approval throws `ApprovalRequired` (Vyve pattern). |
| Outreach drafting with provenance tags | `lib/gtm/outreach.js` | Every line tagged ACCOUNT / OFFER / GENERATED with claim ids; QA blocks uncited facts, numbers in generated copy, hype and repetition (Vyve `qa.py`). |
| Dry-run outbox | `lib/gtm/outreach.js` | `.eml` files only, addressed to the owner's inbox or a non-routable placeholder; no prospect email is ever collected or sent. |
| Field validation | `lib/review.js` | Experiments pre-registered at S10; start/log/close are human actions; `commercially_validated` requires a passed experiment and a written note. |
| Learning loop | `lib/learning.js` | Hyperleap-style: known answers grow from reviews and outcomes; changes are tested offline and only a human promotes them. |

## Not built (yet) — honest limits

- Multi-tenant auth, RBAC, encryption at rest, secrets vault: this is a local single-user tool.
- Postgres/Prefect/LangGraph: replaced by an in-process controller and atomic JSON files (PRD §23 "avoid premature complexity"). Swap in when a hosted, multi-user version is needed.
- Registry and licensed adapters (SEC EDGAR, procurement portals, Common Crawl, Wikidata), PDF extraction, multilingual search.
- Scheduled refresh monitors, retention/deletion jobs, OpenTelemetry tracing (per-stage audit records stand in).
- A real TAM/SAM model from sourced inputs.
