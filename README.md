# PRISM · Evidence-driven ICP discovery

PRISM turns a business brief into separate offer trees, falsifiable market hypotheses, an evidence ledger, and a ranked plan for field testing. This release is a local CLI for analyst-supplied snapshots and independent review records. It uses Node.js built-ins and makes zero network or model calls.

## Quick start

Requires Node.js 22 or newer. There are no packages to install.

```sh
node --test
node cli.js run foxfoster.json
```

Open the printed directory under `runs/`. The FoxFoster fixture encodes six offer tracks from the [PRD](Autonomous_ICP_Discovery_PRD_v1.md) as declared inputs. It produces 33 provisional hypotheses and zero recommendations. Add approved, reviewed evidence to evaluate specific hypotheses.

## Run your own brief

Save a JSON file with a business name, model, fixed evaluation date, and one or more offers.

```json
{
  "name": "Example Training",
  "model": "b2c",
  "asOf": "2026-11-04",
  "geographies": ["India"],
  "offers": [
    {
      "name": "Data Analysis Course",
      "problem": "learn practical data analysis",
      "beneficiary": "early-career analysts",
      "exclusions": ["Learners who require an accredited qualification"]
    }
  ]
}
```

```sh
node cli.js run my-brief.local.json
node cli.js run my-brief.local.json path/to/output
```

Set `model` to `b2b`, `b2c`, or `mixed`. The default planner generates direct, procurement, and channel paths for B2B, and individual, institution, and employer payment paths for B2C. To override those paths, add at least three distinct `segments` to an offer. Each segment takes `segment`, `motion`, `user`, and `buyer`. Geography and website default to `unknown`. IDs encode one-based offer, segment, and geography positions. Keep those arrays in order when reusing a claim packet.

## Evidence and review workflow

1. Run the brief and inspect the cards and their support and challenge queries in `report.json`.
2. Collect permitted sources outside PRISM. Add only short, role- or company-level excerpts to `sources`. Use the same `origin` for material derived from the same underlying document or announcement.
3. Add claim records for the relevant card. The analyst writes the claim and selects the exact excerpt. A second reviewer checks source identity, context, and whether the excerpt supports the claim.
4. Ask a separate critic to search for a concrete falsifier. Record that search and the resulting disposition in `reviews`. Record counterevidence as `challenge` and confirmed hard failures as `exclusion`.
5. Rerun and inspect the evidence ledger, open questions, and field tests.

This synthetic fragment illustrates the optional fields. One claim by itself cannot clear the recommendation gate.

```json
{
  "policy": {
    "hosts": ["example.org"],
    "maxSources": 40,
    "maxAgeDays": 180,
    "maxRecommendations": 3
  },
  "sources": [
    {
      "url": "https://example.org/synthetic-survey",
      "permission": "approved",
      "origin": "synthetic-survey-2026",
      "publisher": "Example Institute",
      "kind": "primary",
      "observed": "2026-10-15",
      "text": "Five respondents reported recurring spreadsheet errors."
    }
  ],
  "claims": [
    {
      "candidate": "1-1-1",
      "angle": "pain",
      "direction": "support",
      "url": "https://example.org/synthetic-survey",
      "quote": "Five respondents reported recurring spreadsheet errors.",
      "statement": "The surveyed group reported recurring spreadsheet errors.",
      "analyst": "analyst-a",
      "reviewer": "reviewer-b",
      "verdict": "confirmed"
    }
  ],
  "reviews": [
    {
      "candidate": "1-1-1",
      "critic": "critic-c",
      "challenge": "Check whether spreadsheet templates already resolve these errors.",
      "disposition": "unresolved"
    }
  ]
}
```

Source intake defaults to an empty hostname allowlist. It accepts exact HTTPS hosts and requires an approval attestation, an origin, an identified publisher, an excerpt, and a valid observation date. Invalid entries are logged and skipped. Old excerpts remain in the ledger with a stale flag. The CLI checks quotation and reviewer consistency against retained evidence. Review identities and source permissions are operator attestations in this local trust model.

## Decisions and exports

| Output | Contents |
| --- | --- |
| `report.md` | Readable cards, reviewed excerpts and citations, challenges, exclusions, and field experiments |
| `report.json` | Query plan, per-angle coverage, source ledger, audit events, score intervals and linked claim IDs |

The eight weighted dimensions follow the PRD. Evidence gaps widen the interval. Grade A requires independent corroboration of a material claim. Grade B requires reviewed primary evidence. The default shortlist admits up to three cards with grade A or B, a lower score bound of at least 75, and a cleared independent critic review. An unresolved challenge blocks the shortlist. A verified exclusion rejects the card. Commercial status stays `not_tested` and buying intent stays `not_observed`. Market size remains `unknown`.

A fixed brief, date and snapshot set reproduce the same run. The run directory uses a SHA-256 digest of the parsed input. Editing the brief or adding evidence generates another directory. Keep brief files and reports on access-controlled storage. The exports include the supplied excerpts.

## Code map and scope

| Module | Responsibility |
| --- | --- |
| `planner.js` | Offer tracks, buying motions, research taxonomy and queries |
| `evidence.js` | Snapshot policy, provenance, duplicate tracking and verification |
| `engine.js` | Coverage, evidence grades, scoring, decision gates and experiments |
| `report.js`, `cli.js` | Report rendering and command-line entry point |
| `engine.test.js` | Determinism, policy, provenance and decision regressions |

The shipped workflow covers the local decision core. PRD work still open includes live search and permitted crawling, semantic extraction, organization entity resolution, a review cockpit and API, account/CRM handoff, run lifecycle controls, outcome ingestion, commercial approval, and governed learning. The pilot fixture tests decomposition and safe abstention. It contains no real market-validation results.
