# PRISM — evidence-led ICP discovery and GTM system

PRISM takes a short description of a business, maps the markets it could sell into, collects public evidence for and
against each customer group, red-teams and independently verifies the strongest options, and returns a small
portfolio of ICPs to test — or none, when the evidence is thin. It then carries an accepted ICP through field
validation, sample-account qualification, tagged outreach drafts and an outcome-learning loop.

It is built to say **"not yet proven"** before it says "go". A recommended ICP is a research lead, never proof of
purchase intent. Only a passed, pre-registered field experiment plus a human sign-off can mark one commercially
validated. Nothing is ever sent to a prospect.

```text
brief ─► S0 policy & budgets ─► S1 business card ─► S2 market universe ─► S3 query lattice (for + against)
      ─► S4 collect public pages (robots, provenance, syndication) ─► S5 extract quote-checked claims + entities
      ─► S6 ICP hypotheses ─► S7 substitutes & economics ─► S8 red team (15 tests) ─► S9 independent verifier + score ranges
      ─► S10 portfolio, anti-ICPs, validation sprint, lead brief ─► S11 human review
      ─► field experiments ─► sample accounts (human approval) ─► tagged drafts + QA ─► dry-run outbox
      ─► outcomes & feedback ─► S12 learning proposals (offline-evaluated, human-promoted)
```

## Quick start

Requires Node.js 22+ (24 recommended).

```bash
npm install
```

```bash
npx playwright install chromium
```

```bash
npm run seed
```

```bash
npm run dev
```

Open http://localhost:3000. `npm run seed` loads an offline demo run (fixture web and fixture model) so you can click
through every screen without network or keys. Then press **Research FoxFoster** or **New research** for a live run.

## Choosing a model

PRISM works without any API key if the [Claude Code CLI](https://code.claude.com) is installed and signed in: it calls
`claude -p` headlessly with no tools and a JSON schema per role, using your existing login. Otherwise set one of:

```env
# .env.local
PRISM_LLM=auto            # auto | anthropic | claude-cli | openai | none
ANTHROPIC_API_KEY=...     # Claude API (default model claude-opus-5-5, structured outputs, server-side fallback)
PRISM_MODEL=...           # override the model id or CLI alias (e.g. sonnet)
PRISM_EFFORT=medium       # Claude effort level
OPENAI_API_KEY=...        # any OpenAI-compatible endpoint
OPENAI_BASE_URL=...
SEARXNG_URL=http://localhost:8080   # optional self-hosted metasearch (JSON enabled)
PRISM_OWN_INBOX=you@yourdomain.com  # optional: dry-run outbox drafts are addressed to you
```

With no model at all, PRISM still crawls, plans and records keyword observations, but nothing can be verified, so it
recommends nothing and says why. The roles (intake, cartographer, extractor, analyst, skeptic, verifier, designer)
are separate calls with separate briefs; the verifier never sees the proponent's narrative.

## Research modes

| Mode | Use | Default budget |
|---|---|---|
| Quick | Low-cost orientation, 2 segments per offer | 12 pages · 8 searches · 12 model calls |
| Discovery | Broad coverage, red team, prioritization | 40 pages · 30 searches · 40 model calls |
| Deep | One ICP plus boundary cases ("Deepen" on a card) | 70 pages · 50 searches · 60 model calls |
| Refresh | Re-check a run's sources; report new, changed, stale claims and decision changes | 40 pages · 20 model calls |

Every run shows its budget, spend, skipped angles, blocked URLs and model failures. Runs can be paused, resumed from the
last completed stage, or cancelled. Compare any two runs side by side.

## What you get per run

- **Decision memo** — go / hold / no-go, recommended ICPs with score ranges, evidence grade and strongest objection, why not the others, assumptions, unknowns, ranking stability.
- **ICP cards** — definition, falsifiable hypothesis, user vs economic buyer, trigger, structural-fit criteria, disqualifiers, boundary examples, alternatives, score range with per-dimension basis, grade, red-team result, next test.
- **Evidence ledger** — every claim with its exact quote, source, tier, origin family, verifier verdict and epistemic label (`observed`, `verified`, `corroborated`, `contradicted`, `unresolved`); rejected extractions; ambiguous entities; blocked sources.
- **Adversarial report** — all 15 PRD tests per shortlisted ICP, kill switches, falsifiable assumptions.
- **Validation sprint** — interviews and tests with pass and kill criteria registered before any data.
- **Lead-intelligence brief** — queries, permitted directories, account criteria, scoring rules, monitoring signals. Criteria, not contact lists.
- **Exports** — Markdown memo, JSON, claims/sources/ICP CSV, lead brief.

## After the research: the GTM loop

1. **Review** — accept, reject (with a reason code), edit or deepen each ICP. Every action records a named reviewer.
2. **Validate** — start the pre-registered experiment, log interviews, close it as passed / failed / inconclusive, then mark the ICP commercially validated only if it passed.
3. **Sample accounts** — for an accepted ICP, PRISM finds organizations from the lead brief, reads each homepage and checks the fit criteria with exact quotes. Launches, hiring and funding are recorded as timing context, never intent. Accounts wait in `HUMAN_REVIEW`; only a person can approve.
4. **Draft** — approved accounts get a three-step sequence where every line is tagged ACCOUNT (cites a quoted account fact), OFFER (cites an offer fact) or GENERATED (no facts or numbers). QA blocks uncited claims, invented numbers, hype and repetition.
5. **Queue** — QA-passed drafts become `.eml` files in `data/workspace/outbox/`. PRISM never sends and never stores a prospect's email address.
6. **Learn** — record outcomes and feedback. PRISM measures calibration by decision band and grade, source precision and validated opportunity yield, proposes small changes (down-weight a weak source, add a learned disqualifier, raise a threshold), evaluates each against your known answers, and applies one only when a human approves. Rollback is one click.

## Architecture

| Path | Responsibility |
|---|---|
| `lib/pipeline.js` | Run controller: stage order, checkpoints, budgets, pause/cancel/resume, per-stage audit records |
| `lib/stages/*.js` | S0–S10 and refresh stages |
| `lib/llm.js`, `lib/schemas.js`, `lib/prompts.js` | Provider-neutral JSON model layer (Claude API, Claude CLI, OpenAI-compatible), structured-output schemas, role prompts |
| `lib/crawler.js` | Public-web collection: SSRF guard, robots.txt, redirects, Playwright fallback, injection stripping, search adapters |
| `lib/evidence.js` | Source tiers, syndication families, literal quote gate, verification labels, entity resolution |
| `lib/scoring.js` | Interval scoring, evidence grades, decision bands, sensitivity analysis |
| `lib/policy.js` | Modes, budgets, forbidden domains, adapter registry |
| `lib/review.js` | Human review, evidence flags, experiments, commercial validation |
| `lib/gtm/*.js` | Account qualification state machine, outreach drafting, QA, dry-run outbox |
| `lib/learning.js` | Feedback, outcomes, calibration, proposals, offline evaluation, strategy versions |
| `lib/reports.js` | Memo, ICP spec, adversarial report, sprint, lead brief, run report, CSV exports |
| `lib/store.js` | Atomic JSON persistence in `data/` |
| `app/` | Next.js dashboard and API routes |
| `engine.js`, `planner.js`, `evidence.js`, `report.js`, `cli.js` | Original offline reviewed-evidence engine (`npm run demo`), kept for compatibility |
| `docs/PRD_COVERAGE.md` | Stage-by-stage and requirement-by-requirement status against the PRD |

### API

- `GET /api/runs` · `POST /api/runs` (`{pilot:"foxfoster"}` or `{name, offer, problem, website?, geography?, model?, mode?, topCount?, excludedMarkets?}`)
- `GET /api/runs/:id` · `POST /api/runs/:id` with `type`: `control`, `refresh`, `deepen`, `review`, `flag`, `experiment`, `validate`, `findAccounts`
- `GET /api/runs/:id/export?format=memo|json|claims|sources|icps|lead-brief`
- `GET /api/workspace` · `POST /api/workspace` with `type`: `account`, `learning`, `outcome`, `suppress`
- `GET /api/compare?a=<runId>&b=<runId>`

Human actions require an `actor` of the form `human:<name>`.

### Command line

```bash
npm run pilot:quick
```

```bash
node run-pilot.mjs --brief my-brief.json --mode discovery
```

## Tests

```bash
npm test
```

The suite runs fully offline on a fixture web and a fixture model, and covers the PRD acceptance gates: forbidden
domains never fetched, fabricated quotes rejected, syndicated copies counted once, similar names not merged, verified
exclusions reject, missing evidence defers, zero recommendations allowed, reproducible decisions, cancel between stages,
the §17.5 Company A fixture (launch ≠ intent), human-only approvals, outreach QA, and learning changes that cannot
deploy without a human.

## Safety rules the code enforces

- Public pages only; robots.txt respected; no login walls, CAPTCHAs or paywalls; LinkedIn and contact-data vendors are forbidden by default.
- Every accepted claim has an exact quote from a retained page. Search listings are pointers, never evidence.
- Pages are untrusted input: instruction-like sentences are stripped and flagged before any model sees them.
- No invented TAM, budgets, counts or conversion rates. Buying intent stays `not_observed`.
- Organizations only; buyers are roles. No personal contact collection, no outreach sending.
- Learning can change weights, thresholds, source priors and learned disqualifiers — never policy, privacy or safety.

`data/`, `.env.local` and `.next/` are git-ignored. MIT licensed. See [docs/PRD_COVERAGE.md](docs/PRD_COVERAGE.md) for
what is and is not built.
