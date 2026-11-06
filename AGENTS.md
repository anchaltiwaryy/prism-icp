# Coding agent guide

PRISM is a local Next.js app plus a staged research controller (`lib/pipeline.js`). Read README.md, then
docs/PRD_COVERAGE.md, then the PRD for the requirement you are touching.

Setup: `npm install`, `npx playwright install chromium`, `npm test`, `npm run build`, `npm run seed`, `npm run dev`.
Inspect `data/<run-id>/run.json` for stages, events, sources, claims, cards and decisions; `data/workspace/*.json` for
accounts, outcomes, feedback and learning.

Invariants — keep them, and add a test when you touch one:
- A public page never establishes purchase intent or commercial validation. `buyingIntent` stays `not_observed`.
- Every admitted claim's quote is literally present in a retained source (`admitClaims`). Search listings are pointers.
- The skeptic and verifier are separate calls; the verifier never sees the cards. A red-team "fail" needs a checkable citation.
- Hard exclusions stay visible; missing evidence defers, it never rejects; zero recommendations is valid.
- Never invent counts, TAM, budgets or conversion rates (`marketSize` is `insufficient_data` unless sourced).
- Organizations merge only on a shared domain. Buyers are roles; never collect personal contact data.
- `APPROVED`, review decisions, experiment actions, commercial validation and learning promotions need a `human:` actor.
- Outreach is dry-run only. Learning may not change policy, privacy, robots or source permissions.

Keep the app usable without external services: model and search adapters degrade to explicit gaps. Keep budgets
bounded and log skipped sources. Update README.md and docs/PRD_COVERAGE.md when behaviour changes.
