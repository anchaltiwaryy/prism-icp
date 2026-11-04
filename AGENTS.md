# Coding agent guide

This repository implements the local PRISM dashboard and research runner described in README.md and Autonomous_ICP_Discovery_PRD_v1.md.

Start with `npm install`, `npx playwright install chromium`, `npm test`, and `npm run build`. Run `npm run dev` for local UI work. Use `Research FoxFoster` to exercise all six offers. Inspect `data/<run-id>/run.json` for activity, source references and decisions.

Preserve these invariants. A public page alone cannot establish purchase intent or commercial validation. Every accepted claim needs an exact quote from a retained original page. Search listings are pointers, not evidence. A skeptical challenge and separate verification pass precede the shortlist. Hard exclusions remain visible. Returning zero choices is valid. Never invent counts, TAM, budgets or conversion rates. Do not bypass robots, login, source restrictions or collect personal contact lists.

Keep the local app usable without external services. Optional model and search adapters should degrade to explicit gaps. Keep run limits bounded and record skipped sources. Add tests for a specific regression, then run `npm test` and `npm run build`. Update the README when changing setup, API or research gates.
