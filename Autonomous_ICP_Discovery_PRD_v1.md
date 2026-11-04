# PRODUCT REQUIREMENTS DOCUMENT
## Evidence-Driven Autonomous ICP Discovery & Market Intelligence Engine

**Version:** 1.0 | **Status:** Build-ready proposal, subject to discovery and architecture review | **Date:** 4 November 2026  
**Working name:** **PRISM** — Prospect Research, ICP Strategy & Market Intelligence  
**Reference pilot:** FoxFoster (cybersecurity ecosystem)  
**Primary deliverable:** Validated, evidence-linked ICP portfolios and next-step research briefs—not scraped contact lists.  
**Audience:** Product, engineering, growth, research, design, data, privacy/legal, QA, and autonomous coding agents.

> **Fundamental decision rule:** The system must be better at saying **“not yet proven”** or **“do not pursue”** than a generic AI tool is at making every market look attractive. No ICP is *validated* by web research alone; commercial validation requires relevant customer or outcome evidence.

---

# 1. Executive definition

## 1.1 One-sentence product
A reusable, adaptive, source-aware research system that takes a description of any business, maps plausible markets and buyers, generates multiple ICP hypotheses, gathers and challenges evidence, verifies claims, ranks opportunities with uncertainty exposed, designs field-validation experiments, and gets smarter after every run through an auditable evaluation-and-feedback loop.

## 1.2 What it is / is not
- **It is:** an ICP decision-support and market-intelligence operating system; configurable for B2B, B2C, B2B2C, services, software, education, marketplaces, and mixed product portfolios.
- **It is not:** a one-shot LLM prompt, a guaranteed lead generator, a mass email scraper, an autonomous outbound sender, a tool that proves purchase intent from weak signals, a substitute for customer interviews, or a cybersecurity scanner.
- **It prepares** downstream market research and lead intelligence through structured segment definitions, account criteria, search strategies, evidence, priorities, and experiments. Those downstream capabilities may be separate modules.
- **No fabricated precision:** account counts, TAM/SAM/SOM, employee headcounts, budgets, conversion rates, and inferred intent must be sourced, modeled with explicit assumptions, or returned as unknown.

## 1.3 North-star outcome
**Validated Opportunity Yield (VOY):** share of recommended ICP hypotheses that subsequently satisfy an independently defined real-world validation criterion (e.g., qualified discovery evidence, qualified opportunity, paid conversion, or other user-configured milestone) within a given period, measured by cohort and compared against a baseline. Track time, cost, and false-positive harm alongside yield; optimizing yield alone invites over-conservative recommendations.

# 2. Problem, jobs-to-be-done, and personas

## 2.1 Problem
Teams routinely start with vague labels such as “SaaS companies,” “enterprises,” or “students,” leading to mixed offerings, broad databases, generic personas, biased research, dubious buying signals, poorly qualified leads, and repeated failure to learn from outreach or customer conversations. Traditional list tools answer **who exists**; they rarely establish **who has the problem, why now, who pays, whether the offer fits, whether the segment is reachable, and what would disprove the choice**.

## 2.2 Jobs-to-be-done
1. “Given what I sell, show me the plausible markets I am overlooking.”
2. “Distinguish end users, influencers, decision-makers, budget owners, and channel partners.”
3. “Find real evidence of pain, spending, alternatives, triggers, and addressability.”
4. “Challenge weak assumptions before I waste weeks prospecting.”
5. “Tell me the best 1–3 ICPs to test first, with precise exclusions and proof gaps.”
6. “Make a repeatable, traceable handoff into account discovery and lead intelligence.”
7. “Learn which research sources, heuristics, and segments predicted actual outcomes.”

## 2.3 Primary users
- Solo founder / first GTM hire: low-input, opinionated guidance, modest budget.
- Growth / GTM engineer: transparent workflows, API, batch controls, exports, experiments.
- Sales / RevOps leader: segment economics, qualification rules, CRM handoff, governance.
- Research / strategy analyst: provenance, counterevidence, taxonomy, version comparisons.
- Agency / consultant: multi-tenant isolation, repeatable workspaces, client-specific priors.
- Product / marketing leader: jobs-to-be-done and message/channel hypotheses.

## 2.4 Success and anti-success
**Success:** fewer unsupported ICP assertions; discovery of meaningful overlooked segments; defensible choices; faster qualification; measurable downstream improvement.  
**Failure modes to avoid:** many low-quality profiles; false confidence from duplicated websites; hallucinated statistics; unsupported access to personal data; auto-approval of agent-generated findings; self-learning that reinforces an initial bias; high tool costs with marginal insights.

# 3. Product principles and evidence semantics

1. **Explore before narrowing.** Run divergent market discovery before scoring; deliberately search adjacent and non-obvious alternatives.
2. **Segment by offer, job, and buying motion.** Multiple products generally require multiple ICP trees. A buyer segment is not an ICP simply because it shares an industry.
3. **Separate fit from intent from timing.** A company may be ideal *in principle* while lacking a current need, budget, or reachable buyer. New product launches do not prove purchase intent.
4. **Every significant claim has provenance.** Store the source, extraction, publication/observation date, method, verification attempts, and contradictions.
5. **Corroborate independently.** Multiple articles syndicating one announcement are one underlying evidence family, not three confirmations.
6. **Negative research is mandatory.** The skeptical agent receives the strongest pro-ICP case and is rewarded for finding disqualifiers—not for agreeing.
7. **Uncertainty is first-class.** Use `unknown`, `not_checked`, `inferred`, `observed`, `contradicted`, `verified` states. No guessed values in required fields.
8. **Automation remains bounded.** Agents can propose new tools, filters, scoring dimensions and search plans; changes to safety, licensing, PII, confidence or release gates require approval.
9. **Make scope visible.** “Every angle” means comprehensive coverage of a documented research taxonomy *within time, access, law, and cost constraints*—not omniscience.
10. **Verify utility in the real world.** Market evidence produces provisional ICPs; interview, pipeline, and commercial evidence can upgrade their status.

## 3.1 Evidence labels
- **Verified observation:** checked against a suitable original or authoritative source with identity, date, and context confirmed.
- **Corroborated observation:** consistent independently derived sources or direct user evidence; source independence recorded.
- **Inference:** plausible interpretation of observations, with reasoning and confidence clearly labeled.
- **Hypothesis:** testable unverified proposition.
- **Contradicted:** credible evidence conflicts; preserve all versions.
- **Unresolved:** insufficient coverage or freshness; no silent positive default.

## 3.2 ICP maturity states
`candidate → researched → evidence_supported → field_testing → commercially_validated` or `rejected / archived / revisit_later`. Only real-world evidence defined in the run's validation contract permits `commercially_validated`.

# 4. Scope, modes, and constraints

## 4.1 In scope
Business intake; offer discovery; market segmentation; customer problem mapping; source discovery; website/public-record analysis; competitor and substitute analysis; account/sample discovery; firmographic/technographic context; buying-group mapping at role level; anti-ICP research; confidence calibration; scoring and prioritization; user review; validation experiment design; versioned reports; exports; feedback ingestion; controlled learning.

## 4.2 Out of scope for initial release
Autonomous cold outreach, personal email/phone harvesting, bypassing site access controls, scraping logged-in networks without authorization, unsanctioned vulnerability scanning, automatic changes to core safety policies, unverifiable market-size claims, guarantees of future revenue. Optional downstream lead intelligence may collect permitted role-level contact data later under a separately approved policy.

## 4.3 Research modes
- **Quick orientation:** limited source breadth; 2–5 candidate segments; gaps explicit; designed for low-cost initial orientation.
- **Discovery:** broad taxonomy coverage, alternatives map, evidence packets, red-team review, initial prioritization.
- **Deep verification:** concentrated source checks and adversarial validation of shortlisted ICPs plus sampled accounts.
- **Refresh / delta:** re-check only stale or decision-changing claims, record changed rankings and triggers.
- **Compare:** two or more versions, business models, geographies, or hypotheses side by side.

All budgets and coverage targets are configurable. The UI must show the selected mode, explored dimensions, skipped dimensions, crawl exclusions and resource spend.

# 5. Intake: the minimum viable business brief

## 5.1 Mandatory input (progressive disclosure)
Users can begin with **business name or description**, **what is sold**, **who benefits / problem solved as currently understood**, and **website or supporting materials if available**. If no website exists, the system proceeds with a lower-confidence self-reported profile. Ask for missing information only when essential to distinguish offers or comply with constraints; otherwise record assumptions and continue.

## 5.2 Strongly recommended but optional
Geographies; B2B/B2C/mixed; pricing or ticket range; delivery model; target language; implementation capacity; strongest existing customers (anonymized); wins/losses; renewal/churn; sales cycle; product maturity; competitor examples; excluded verticals; regulations; preferred acquisition channels; budget; research depth; minimum deal value; integration requirements; ideal use cases; founders' unfair advantage; disallowed sources; data retention; authorized CRM/analytics connectors.

## 5.3 Intake behavior
1. Normalize input without changing its meaning.
2. Extract offers, promised outcomes, delivery constraints, actors, business model, geographies and current assertions.
3. Resolve ambiguous offering names using the official business site where allowed.
4. Show a **Business Understanding Card** separating `user_declared`, `publicly_observed`, and `agent_inferred` facts.
5. Ask for confirmation only of material contradictions; flag nonblocking unknowns.
6. Capture `business_profile_version`, `policy_version`, and `assumption_register`.
7. Allow edits at any point; affected steps are invalidated and recomputed with lineage preserved.

## 5.4 Intake data contract (conceptual)
`BusinessProfile`: id, tenant_id, name, canonical_domain?, description, offers[], target_geos[], delivery_constraints[], pricing_model?, b2b_b2c_mode, known_customers_aggregate?, existing_positioning?, excluded_markets[], user_assertions[], permitted_sources[], privacy_policy_id, version, created_at.  
`Offer`: id, business_id, name, category, product_or_service, user_job, buyer_job, promised_outcome, preconditions, differentiators[], proof_points[], price_band?, route_to_market?, current_status, source_evidence_ids[].

# 6. Research taxonomy: the angle-coverage engine

Every run creates a **coverage matrix** crossing offer × candidate segment × geography × buying motion × research angle. The planner must explicitly include, exclude, or defer each applicable angle with a reason. Coverage does not imply confirmation.

| Cluster | Questions and signals to investigate | Example source families |
|---|---|---|
| Demand and pain | Jobs-to-be-done, severity, frequency, consequences, workaround, dissatisfaction, trigger | Customer interviews, reviews, discussion forums, RFPs, support/FAQ themes |
| Customer identity | Industry/subsector, size, growth stage, revenue model, geography, language, operating model | Official sites, filings, open registers, directories |
| Users vs buyers | End user, champion, influencer, technical evaluator, compliance gate, budget owner, procurement | Job descriptions, team structure, public procurement, interviews |
| Ability/willingness to pay | Budget owner, price alternatives, ROI, contract size, renewal frequency, procurement barriers | Published pricing, tenders, customer evidence, public budgets |
| Technographic context | Product surface, platforms, public integrations, developer ecosystem, cloud stack (only if disclosed) | Official docs, product pages, repositories, technical blogs |
| Timing | Product release, hiring, funding, regulation, growth, modernization, procurement cycle | Official announcements, filings, job boards, press; weak until corroborated |
| Market structure | Segment density, concentration, addressability, geography-specific coverage | Registers, datasets, industry bodies, transparent models |
| Competition and substitutes | Direct products, agencies, DIY, in-house teams, spreadsheets, non-consumption | Competitor sites, marketplaces, reviews, interviews |
| Reachability | Searchability, channels, communities, partnerships, events, buying networks | Community sites, association directories, events |
| Adoption friction | Setup cost, integrations, trust, security/legal reviews, change management, switching costs | Docs, buyer interviews, procurement guidance |
| Strategic fit | Delivery capacity, margins, repeatability, differentiated strengths, support burden | Business owner input, internal outcomes, unit economics |
| Risks/exclusions | Illegal/unsupported uses, budget mismatch, maturity mismatch, missing authority, poor access, high churn | Laws/policies, role evidence, documented constraints |
| Macro & regional | Industry growth, local regulation, education procurement, economic cycle, language | Government/statistical publications and regulators |
| Underexplored adjacencies | Upstream/downstream value chain, channel resellers, alternative users, new applications | Ecosystem maps, partner pages, adjacent category research |

**Mandatory cross-cuts:** historical vs recent; small vs large organizations; incumbent vs new entrant; urgent vs latent demand; direct vs channel sale; buyer vs user; price-sensitive vs value-sensitive; positive vs negative evidence; local vs international; reachable vs theoretically addressable; recurring vs episodic need; regulation-dependent vs voluntary purchase.

# 7. Complete end-to-end workflow and stage gates

Each stage defines inputs, agent actions, outputs, and a deterministic gate. Agents may branch or revisit earlier stages; every branch creates a logged plan revision.

## S0 — Authorization and policy bootstrap
**Actions:** set tenant, consented inputs, crawl/robots/TOS policy, data jurisdictions, forbidden domains, budgets, rate caps, retention, tool allowlist, LLM provider policy, no-contact default.  
**Output:** signed `RunPolicy` and audit context.  
**Gate:** stop if the requested source or intended processing is disallowed; allow safe partial research rather than silently bypassing controls.

## S1 — Business understanding and portfolio decomposition
**Actions:** parse intake, crawl authorized official pages, extract products and buyer jobs, identify cross-sell vs distinct purchase motions, build initial offer map and assumptions ledger.  
**Output:** `BusinessProfile`, `OfferMap`, unresolved questions.  
**Gate:** each offer needs a clear outcome or an explicit `unknown` flag; no invented features.

## S2 — Divergent market universe generation
**Actions:** generate market hypotheses from problems, use cases, verticals, company types, buyer roles, ecosystem adjacency, substitutes, geography, lifecycle events, channel partners, and underserved niches. Include B2C, B2B and institutions where relevant.  
**Output:** broad `MarketUniverse` with deduplicated segment concepts and query plans.  
**Gate:** coverage checklist complete or documented exclusions; minimum segment diversity configurable (default proposal: at least 3 distinct archetypes per material offer before narrowing).

## S3 — Source planning and query lattice
**Actions:** select permissible source adapters; generate query families with synonyms, industry jargon, alternate buyer labels, regional language, competitor names, regulatory terms, anti-signals, price signals, disconfirming phrases, and recency windows. Estimate value and cost of each source.  
**Output:** `SearchPlan` with source queues, priority, rate limits and success conditions.  
**Gate:** sources are vetted and queries span both pro- and anti-hypothesis evidence.

## S4 — Collection and provenance capture
**Actions:** collect official pages, public datasets, permitted directory listings, job descriptions, accessible discussions, product/review pages, public filings and event records; preserve URL, fetched timestamp, published date if known, license, content hash, excerpt, locale, method and status.  
**Output:** immutable `EvidenceDocument` objects and raw collection statistics.  
**Gate:** reject blocked or unreliable access; deduplicate syndicated and mirrored material before claim counting.

## S5 — Entity resolution and structured extraction
**Actions:** clean HTML/PDF/text; extract organization, offer, role, industry, size *only if supported*, use case, pain, competing solution, event, price, geography, and dates; normalize domains; resolve subsidiaries, product names and duplicate organizations.  
**Output:** structured entities, relation graph, claim-to-document links, ambiguity queue.  
**Gate:** no merge based only on a similar name; require domain/registration/other independent identifiers for consequential merges.

## S6 — Opportunity hypothesis construction
**Actions:** generate ICP tuples and full economic narratives; distinguish structural fit, need intensity, budget logic, likely buyers, alternatives, channel, timing, implementation and exclusions.  
**Output:** `SegmentHypothesis` cards and initial causal arguments.  
**Gate:** every candidate has a falsifiable hypothesis, explicit customer job, defined buying motion, evidence needs, and disqualifying conditions.

## S7 — Competitive, substitute and economics analysis
**Actions:** identify direct competitors, free substitutes, agencies, internal teams, status quo and non-consumption; examine procurement/switching costs and willingness-to-pay evidence; estimate TAM/SAM/SOM only from auditable source data and stated assumptions.  
**Output:** alternatives matrix, pricing/switching hypotheses, market-size model or `insufficient_data`.  
**Gate:** not allowed to call a market attractive merely because companies exist in the category.

## S8 — Adversarial red-team falsification
**Actions:** independent skeptic tries to invalidate high-scoring segments and claims using explicit attacks in §8; searches contradictory sources and tests a sample of entities that supposedly fit.  
**Output:** adversarial findings, false-positive routes, objections, defect severity, keep/kill/rework recommendations.  
**Gate:** material challenges answered, downgraded or marked unresolved. A proponent cannot overrule a hard factual counterexample without new evidence.

## S9 — Independent verification and calibrated scoring
**Actions:** independent verifier reconstructs critical claims from source links and timestamps; checks identity/date/context, confirms corroboration independence, flags stale data, runs sampled account checks, scores both opportunity and evidence confidence.  
**Output:** scored hypotheses, citations, confidence interval/grade, unverified assumptions, verification manifest.  
**Gate:** failed hard exclusions auto-reject; inadequate evidence cannot produce a `verified` label or high-confidence recommendation.

## S10 — Portfolio selection and decision memo
**Actions:** construct top-3 and watchlist portfolios, diversify correlated bets, show tradeoffs and opportunity costs, define negative ICPs, prioritize low-cost field tests, draft scripts and sampling criteria.  
**Output:** stakeholder memo, market map, segment cards, search/qualification strategy, field-test plan.  
**Gate:** user can trace every recommendation to a claim and counterclaim. Explicitly label market-researched ≠ commercially validated.

## S11 — Review, export and downstream handoff
**Actions:** reviewer accepts/rejects/edits hypotheses, requests deeper research, comments on evidence; export JSON/CSV/Markdown/PDF and optional CRM/account-discovery manifest.  
**Output:** signed versioned decision, integration payload, reviewer events.  
**Gate:** do not push personal contact data or start outreach by default; optional write actions need scoped consent.

## S12 — Outcome learning, refresh and controlled improvement
**Actions:** gather structured feedback and later outcomes, compare to predictions, score source usefulness and false-positive types, propose strategy or rubric changes, run offline regression tests, request approval for policy-level changes; schedule/offer periodic refresh if configured.  
**Output:** `LearningProposal`, evaluation results, new strategy version, drift and rollback history.  
**Gate:** changes that fail tests or degrade minority/rare-segment recall remain in shadow mode.

# 8. Red-team methodology: prove the ICP wrong

The adversarial module is a **separate role and evaluation path**, not a final paragraph written by the same optimistic agent. It must assess:

1. **No-pain test:** do customers actually experience the proposed problem frequently and severely?
2. **No-budget test:** is the end user enthusiastic but unable to authorize purchase?
3. **False-signal test:** is a launch, hiring post, funding event, or tech detection wrongly treated as active buying intent?
4. **Substitution test:** is a credible free, incumbent, agency, or in-house alternative sufficient?
5. **Inaccessibility test:** can this segment be reached economically without prohibited data or platforms?
6. **Economics test:** do acquisition, servicing, price, procurement, and retention make the segment unattractive?
7. **Product-mismatch test:** does the company need a different maturity level, integration, certification, or capability?
8. **Evidence-bias test:** are references repeated press releases, affiliate reviews, stale directories, or vendor marketing?
9. **Selection-bias test:** did queries overrepresent visible online companies or one language/region?
10. **Category-error test:** were learners confused with institutional buyers, users with economic buyers, or VAPT interest with compliance mandates?
11. **Timing test:** is need episodic, closed, already fulfilled, or too early?
12. **Regulation and trust test:** can this business actually serve the buyer jurisdiction and security requirements?
13. **Competitor response test:** would a scaled incumbent neutralize the proposed differentiation?
14. **Counterfactual test:** if the named trigger disappeared, would the account still fit?
15. **Boundary test:** collect examples just outside the ICP and ask whether the rules distinguish them.

**Required adversarial artifact for each shortlisted segment:** strongest argument *for*, strongest argument *against*, top 5 falsifiable assumptions, disconfirming sources with independent origin, estimated false-positive causes, what evidence would change the decision, status (`survive`, `revise`, `reject`, `defer`), and sign-off.  
**Kill switches:** proven legal/contractual restriction; inability to deliver promised outcome; explicit user exclusion; business model impossible under given price constraints; critical false attribution; severe data-policy issue.  
**Caution:** lack of public evidence is not proof of no demand. Use `defer_for_primary_research` where the market is opaque.

# 9. Verification and evidence-quality policy

## 9.1 Verification method
- Define material claims: company identity, product availability, customer segment, buyer role, technical capability, regulatory relevance, reported event, competitor/pricing claim, market-size input.
- Prefer primary sources for organization-owned facts, but treat vendor claims about outcomes as interested-party assertions requiring outside validation.
- Link excerpts to exact URL/document, publication date where available, observed date, archived version/content hash, and extractor version.
- Verify time-sensitive claims against date-appropriate sources; mark old information stale based on claim type.
- Detect syndication chains, copied biographies, listings with shared origin, duplicate domains and template-generated content.
- Separate `source_reliability`, `claim_support`, `independence`, `freshness`, `completeness`, and `extraction_accuracy` instead of one vague confidence number.
- Human-review critical discrepancies, low confidence on high-value decisions, and suspicious source patterns.

## 9.2 Evidence grades (proposed defaults, tunable)
- **A:** strong original/documentary evidence plus suitable independent corroboration, no unresolved material contradictions.
- **B:** credible primary evidence, but independent corroboration or freshness is incomplete.
- **C:** plausible secondary evidence or moderate inference, limited corroboration.
- **D:** weak, stale, indirect, promotional or contradictory evidence.
- **U:** unknown, unassessed, or inaccessible.

**Important:** A means well-supported *fact*, not validated willingness to pay. Commercial validation has its own status.

## 9.3 Source hierarchy—not blanket trust
1. First-party product documentation, registries, disclosures, public procurement, signed customer outcomes when authorized.
2. Respected industry bodies, public datasets, scientific or industry studies with methods.
3. Independent reputable journalism, credible reviews and directories with identifiable provenance.
4. Forums, communities, job ads and event data (strong for hypotheses, less definitive for purchase intent).
5. Model-generated assertions and untraceable summaries: **never source evidence**.

## 9.4 Evidence freshness examples
Official product features: revisit on change or per configured TTL. Hiring/event signals: relatively short TTL. Company registration: longer TTL. Pricing and compliance: short TTL or manual review. All TTLs are defaults subject to segment and jurisdiction; store last-checked date explicitly.

# 10. Scoring: merit, certainty, and readiness are separate

## 10.1 Segment opportunity score (0–100, adjustable baseline)
| Dimension | Proposed weight | Key questions |
|---|---:|---|
| Pain intensity and frequency | 20 | Is the need urgent, costly, recurring, observable? |
| Offer–problem fit | 15 | Does the current offer solve the job with acceptable deployment friction? |
| Economic buyer and value | 15 | Can the buyer approve spend and justify value? |
| Reachability and channel feasibility | 10 | Can relevant buyers be found and engaged lawfully? |
| Timing/trigger usefulness | 10 | Do identifiable events predict readiness, not merely awareness? |
| Delivery and repeatability | 10 | Can the provider consistently serve this segment? |
| Competitive advantage | 10 | Why choose this over incumbents, DIY and non-consumption? |
| Quality of supporting research | 10 | Are material claims substantiated and reasonably fresh? |

For dimension `d`, use `w_d × s_d/5` where `s_d ∈ [0,5]`. **Missing evidence is not scored as zero pain**: assign an interval and label insufficient coverage. Publish the score range, evidence grade and all hard gates. Weights are decision aids, not validated prediction coefficients.

## 10.2 Separate output fields
`opportunity_score_range`, `evidence_grade`, `fit_confidence`, `buying_intent` (`not_observed` by default), `commercial_validation_status`, `coverage_pct`, `disqualifiers[]`, `cost_to_validate`, `next_best_test`.

## 10.3 Decision bands (initial heuristics, not facts)
- **Explore first:** score at least 75 with evidence grade A/B, no unresolved hard gate, and plausible field-validation path.
- **Conditional test:** 55–74 or stronger segments with grade C/large uncertainty; run targeted interviews before scaling.
- **Defer / watch:** ambiguous economics, source limitations, or incompatible timing.
- **Reject:** hard exclusions or strongly supported poor fit.

The engine must be allowed to return **no recommended ICP**. It must not force a winner to satisfy UI design.

# 11. Open-source and open-data tooling: vetted starter registry

**Clarification:** an open-source *tool* does not make the websites it accesses free to scrape, reuse, or redistribute. A public directory may have restrictive terms or licensing. Each adapter needs independent policy, provenance and access checks. The items below were checked against official project/repository materials for suitability and published licensing, **not security audited, penetration-tested, or guaranteed approved for every commercial use**. Lock actual versions and re-check license/dependencies at build time.

| Layer | Preferred OSS candidates | Purpose / implementation notes |
|---|---|---|
| Search aggregation | **SearXNG** | Self-hosted meta-search; destination engines' rules, limits and licensing still apply. Discovery only, not verification by itself. |
| HTTP crawling | **Scrapy** (BSD-3-Clause), **Crawlee** (Apache-2.0) | Scalable domain-focused crawlers; run polite, allowed queues and source-specific parsers. Crawlee available for JS/TS; select consistent runtime architecture. |
| JS rendering | **Playwright** (Apache-2.0) | Render public, permitted pages when static extraction fails. Not a license to bypass login, paywalls, CAPTCHAs or access controls. |
| Extraction | **Trafilatura** (Apache-2.0 for current versions) | Main text, dates, metadata, article cleaning, sitemaps; attach extraction confidence. |
| Data operations | **PostgreSQL**, **DuckDB** (MIT) | Canonical relational store and reproducible analytical calculations; append-only raw evidence separately. |
| Entity linkage | **RapidFuzz** (MIT), **Splink** | String matching plus probabilistic record linkage; verify ambiguous corporate merges. |
| Vector retrieval (optional) | **Qdrant** (Apache-2.0), or pgvector | Semantic dedup/retrieval; embeddings never override exact cited evidence. |
| Orchestration | **Prefect** (Apache-2.0) | Schedules, retries, rate/budget-aware tasks, checkpoints, monitoring. |
| Agent state machine | **LangGraph** (MIT library) | Stateful research branches, human interrupts and repeatable critic/verification stages; distinguish OSS library from managed vendor products. |
| Validation and tests | **Pydantic**, **pytest** | Strict typed artifacts, schema migrations, regression tests; version/license verify at deployment. |
| Observability | **OpenTelemetry** | Trace each step, tool call, cost and evidence lineage; configure PII-safe traces. |
| Model serving (optional) | **vLLM**, **Ollama** or similar, separately evaluated | Private/local inference option; model weights, licences, quality and hardware are separate decisions. |

## 11.1 Source and directory adapter catalogue
- **Company-owned sources:** websites, product/docs/pricing/FAQ pages, permitted RSS/sitemaps, press releases, public case studies, disclosed partners, careers pages.
- **Public registries and filings:** SEC EDGAR APIs (US public filers), applicable government company registers (only jurisdictions with permitted access), public tender/procurement portals.
- **Broad web corpora:** Common Crawl index/data (historical/background; not real-time authority), Internet Archive where use is permitted.
- **Public knowledge graphs:** Wikidata/Wikipedia (classification/aliases; verify commercial details separately).
- **Geographical/local directories:** OpenStreetMap and other licensed public business listings, where relevant; coverage varies greatly by sector.
- **Developer/open-source ecosystems:** GitHub public API and project organization pages, open package registries, developer docs; comply with API limits and avoid confusing developer activity with budget intent.
- **Academic/institutional:** university and college directories, accreditation bodies, course catalogs, research/educational repositories; verify institutional buying structures.
- **Demand and topic signals:** RSS, permitted news search, public industry publications, conference exhibitor lists, association pages, publicly accessible RFPs.
- **Community/voice-of-customer:** permitted forums, open product reviews, relevant professional communities, with privacy and representativeness controls.
- **Commercial/private enrichment:** optional adapter only with proper contract; NOT core OSS dependency. Maintain evidence labels and do not quietly upgrade licensed data to “open data.”

**Non-recommended as default unrestricted data sources:** LinkedIn scraping, scraped email databases, paywalled/private communities, unlicensed business directories, browser automation against login barriers. **Licensing warning:** Airbyte Core is under Elastic License 2.0 rather than a straightforward permissive OSS license; assess separately if proposed.

## 11.2 Source adapter interface
Every `SourceAdapter` must expose: `id`, `purpose`, `jurisdictions`, `data_categories`, `license`, `terms_url`, `robots_policy`, `auth_mode`, `pii_risk`, `source_quality_prior`, `rate_limits`, `retention_rules`, `search(query)`, `fetch(id/url)`, `extract()`, `healthcheck()`, `cost_estimate()`, `provenance_fields`, `last_license_reviewed`, `status`.  
**Policy statuses:** `approved`, `restricted`, `pending_review`, `disabled`. Runtime only activates approved adapters.

## 11.3 OSS verification checklist
Confirm official canonical repository and maintainer; OSI-compatible license if strict OSS is required; transitive/license concerns; release activity and maintenance; disclosed security advisories; reproducible pinned version; deployability; resource demands; no required paid service; portability; documentation/tests; data export rights. Repeat at each dependency update. A working GitHub link is **not** equivalent to a passed production security review.

# 12. Architecture and agent responsibilities

## 12.1 Core architecture
`UI/API → tenant/policy service → run planner → Prefect task orchestration → tool/source adapters → raw evidence store → extraction + entity resolution → knowledge/claim graph → hypothesis builder → independent red team → verifier → scoring/decision engine → review/export → evaluation + learning registry`.

A stateful agent framework can coordinate reasoning, but **the workflow controller owns permissions, retries, branch limits, immutable stage artifacts, budgets and release gates**. No free-form agent should have direct unlimited web or database write access.

## 12.2 Agent roles and strict handoffs
| Role | Input | Output | Must not do |
|---|---|---|---|
| Intake Interpreter | User brief, allowed official pages | Facts/assumptions/offers | Invent unprovided capabilities |
| Market Cartographer | Offer map, taxonomy | Divergent segment universe | Prune solely on stereotypes |
| Source Strategist | Hypotheses, coverage gaps | Query + source plan | Use unapproved adapters |
| Collector | Approved URLs/queries | Raw evidence + metadata | Evade protections or collect unnecessary PII |
| Extractor/Resolver | Raw documents | Structured entities, claims | Merge on name alone |
| Demand Analyst | Claims + segment map | Pain, triggers, buyer narrative | Treat intent proxy as proven need |
| Competition/Economics Analyst | Segment/offer evidence | Substitutes, viability assumptions | Invent spend/TAM |
| Skeptic / Red Team | Proponent dossiers | Counterevidence + failure cases | Self-approve outcome |
| Independent Verifier | Claims, raw source pointers | Verification manifest | Trust proponent summary without checking |
| Scoring/Decision Agent | Verified dossiers + rubric | Ranked portfolio and uncertainty | Override hard constraints |
| Experiment Designer | Top hypotheses + gaps | Interviews/tests/validation contract | Declare market validated from desk research |
| Learning Analyst | Outcomes + prior versions | Proposed refinements, eval results | Deploy unsafe or untested self-changes |

Critical transitions are tool/schema-validated. High-stakes or contradictory cases get human-review interrupts.

## 12.3 Event-driven orchestration contract
Every task logs `run_id`, `stage`, `attempt`, `input_artifact_hash`, `tool_and_model_version`, `policy_version`, `started_at`, `finished_at`, `cost`, `tokens`, `source_requests`, `errors`, `output_hash`, and decision. Include checkpoints, idempotent retry keys, per-domain concurrency, exponential backoff, circuit breakers, poison queue, cancellation, resume, deadline, maximum depth, and global run budget.

## 12.4 Tool-selection planner
The planner chooses tools based on marginal information gain, cost, coverage gap, data quality, legal status, and need for independent verification. It can propose new adapters, but only approved adapters run. A source failure should trigger a permitted fallback and visibly lower coverage; never silently fabricate content.

## 12.5 Research stop rules
Stop broadening when budget ceiling is reached, additional independent sources have low marginal insight, or predefined coverage/uncertainty targets are met; continue to check material contradictions. Stop narrowing when top options are stable across reasonable rubric sensitivity tests, or mark findings inconclusive if not. Report what was not researched.

# 13. Canonical data model and provenance graph

## 13.1 Principal records
- `Tenant`, `Workspace`, `BusinessProfile`, `Offer`, `RunPolicy`, `ResearchRun`, `SearchPlan`.
- `MarketSegment`: parent/child taxonomy, sector, size bands, geography, buyer type, customer job and exclusions.
- `ICP_Hypothesis`: offer link, buyer/user economic model, segment filters, needs, triggers, anti-signals, assumptions, status and version.
- `Organization`: canonical domain, external identifiers, name aliases, industry claims, geography, evidence-backed attributes.
- `RoleArchetype`: job function, influence, decision rights, budget responsibility; person records not required.
- `EvidenceDocument`: source URI, allowed-use metadata, content hash, provenance, extraction, language, dates, origin family.
- `Claim`: subject–predicate–object, qualifier, temporal validity, evidence links, contradiction links, epistemic label.
- `VerificationCheck`, `RedTeamFinding`, `SegmentScore`, `DecisionRecord`, `FieldExperiment`, `OutcomeEvent`, `LearningProposal`, `ModelEvaluation`.

## 13.2 Claim example
`subject: sample SaaS company` / `predicate: launched_web_application` / `object: true` / `observed_at: ...` / `source: official announcement` / `status: observed` / `claim_strength: product_launch_only` / `buying_intent: not_observed`.

## 13.3 Account-level fit is not segment-level fit
`SegmentHypothesis` answers “which kinds of buyers?”; `Organization` answers “which actual companies might match?”; `IntentSignal` answers “what observable time-bound event exists?”; `QualifiedAccount` requires a separate qualification contract. Sampling accounts helps validate segment definitions but does not turn the PRD into mass contact collection.

## 13.4 Field-level provenance
All consequential populated fields need `value`, `status`, `source_evidence_ids`, `last_verified_at`, `confidence`, `valid_from/to?`, `method`, `reviewer?`. Unknowns remain explicit. Store user-entered claims separately from scraped/public facts.

# 14. User-facing experience and reports

## 14.1 Entry screen
Business URL or description, “What do you sell?”, optional target markets/constraints, depth and budget. Display an example input; no long mandatory form.

## 14.2 Research cockpit
Stage timeline, offer tree, market-map coverage, queries/sources attempted, citations, conflicting evidence, cost remaining, confidence, skips, and actionable flags. User can pause, correct a product, exclude a segment or request a new angle; changes create a new checkpoint.

## 14.3 ICP comparison cards
For each candidate: precise definition; user vs buyer; problem/JTBD; urgency and triggers; alternatives; offer fit; ability to pay; reachability; negative criteria; observed illustrative accounts (with source); opportunity score **range**; evidence grade; strongest objection; unknowns; first experiment; and decision. Avoid a single misleading “AI fit 95%” meter.

## 14.4 Mandatory outputs
1. **Executive decision memo:** recommended 1–3 ICPs, why, key assumptions, objections, evidence gaps, and go/no-go/hold.
2. **Offer-to-segment market map:** all researched and rejected candidates plus white spaces.
3. **ICP specification:** firmographic/behavioral/functional criteria, disqualifiers, buying group, triggers, positioning and channel hypotheses.
4. **Source/evidence ledger:** verified claims and citations with dates, contradictions, source licensing and coverage.
5. **Adversarial report:** arguments against each winner and status of objections.
6. **Validation sprint:** customer interview hypotheses, recruiting criteria, sample scripts, minimum evidence threshold, go/kill tests.
7. **Downstream lead intelligence brief:** search queries, permitted directories, sampled target-account criteria, scoring rules and fresh-signal monitoring plan.
8. **Run report:** elapsed stages, source stats, errors, skips, spend, model/config versions, risk disclosures.
9. **Exports:** JSON + CSV for structured entities, Markdown/Word/PDF reports as optional formats, signed decision snapshot.

## 14.5 ICP card template
`Segment name | Offer | Geography | Company/user profile | Pain/JTBD | Buyer/champion/influencers | Trigger | Structural-fit criteria | Disqualifiers | Competing options | Economics | Acquisition paths | 5 supporting claims | 3 strongest objections | Sample accounts | Evidence grade | Score range | Field-test plan | Decision | Last verified`.

# 15. Self-learning: every run closes the loop

## 15.1 Feedback signals
- **Immediate:** researcher edits, rejected sources, incorrect merges, challenged claims, useful discoveries, reviewer ratings and time spent.
- **Delayed:** discovery-interview outcomes, customer-confirmed pain, qualification pass/fail, sales cycle, conversion, deal economics, churn and retention where users connect permitted systems.
- **System:** source precision, entity-merge error rate, freshness, token/tool spend, research diversity and counterevidence caught.

## 15.2 Learning cycle
1. Snapshot the run's inputs, sources, model, prompts, search plan, rubric, recommendations and confidence predictions.
2. Capture explicit structured feedback with reason codes (`no_need`, `no_authority`, `too_small`, `wrong_vertical`, `stale_data`, `bad_merge`, `price_mismatch`, etc.).
3. Attribute errors to extraction, sources, hypothesis framing, weights, search coverage, red-team misses or user-side execution—not automatically to “bad ICP.”
4. Compare predictions to outcomes using time-windowed cohorts; control for sample bias, missing outcomes and outreach quality.
5. Generate a proposed change: new source, query template, synonym, negative rule, threshold, weight, prompt, routing plan or tool adapter.
6. Evaluate proposal against held-out labeled cases, old successes, hard negatives, rare segments and citation accuracy.
7. Apply bounded low-risk tuning automatically **only if pre-authorized**; prompt/model/rubric/core-source/policy changes require human review or an explicit deployment policy.
8. Shadow-run or canary-release, monitor regressions, then adopt/version or roll back.
9. Write an understandable changelog: “changed X because Y; benchmark effect Z; known risk W.”

## 15.3 Non-negotiable safeguards
Never train on private customer data by default; require authorization and data governance. Do not let hallucinated feedback reinforce hallucinated evidence. Distinguish no response from negative evidence. Protect against reward hacking, popularity bias, majority-segment overfitting and selection effects. No autonomous changes to robots/PII/retention policies. The system may learn *how to research* even when no sales outcome is yet available; it may not claim to have learned *which customers convert* without outcome evidence.

## 15.4 Memory types
`episodic_run_memory` (immutable events), `research_memory` (facts with TTL), `strategy_memory` (versioned heuristics), `evaluation_memory` (gold cases), `user_preference_memory` (tenant-isolated), `rejected_hypothesis_archive` (negative examples). Sensitive values are minimized, access-controlled and deleted when required by policy.

# 16. Validation experiments and commercial truth

Every shortlisted ICP receives an explicit field-validation plan, not a sales recommendation disguised as certainty.

**Example validation contract:** interview appropriate buyers and end users, observe recurring high-priority pain, identify current alternatives and economic owner, test willingness to allocate budget or time, demonstrate product fit, and measure advancement to a qualified next step. Configure sample size and success/failure thresholds *before* gathering outcomes; do not present arbitrary default counts as statistically validated. Where practical, compare a control or alternate segment and capture negative interviews.

Experiment families: problem interviews, concept tests, pricing/ROI conversations, channel response tests, limited pilots, partner trials, outbound message experiments (separate authorized system), and retention/usage cohorts. Escalate to larger tests only after ethical, legal and practical review.

# 17. FoxFoster: reference pilot configuration

## 17.1 Confirmed public offering map
FoxFoster's public site describes an ecosystem comprising **Academy**, **FoxFoster Labs**, **CTF Arena**, **Xnolex** (automated vulnerability assessment and penetration testing across web/API/cloud), **Services** (including VAPT, CTF design and security programs), and **Corporate Training**. Public descriptions do **not** establish its internal target-account rules, pricing, revenue, historical campaign effectiveness, buyer budgets or conversion performance. The figures shown on the public site should not be treated as independently audited results.

**Source:** https://foxfoster.com/ (checked for this PRD, November 2026).  
**Pilot configuration status:** everything below is a *research hypothesis* to evaluate, not FoxFoster's official ICP or proven customer base.

## 17.2 Separate hypothesis tracks
| Offer | Starting segment hypothesis | Buyer / user distinction | Initial negative checks |
|---|---|---|---|
| Xnolex | SaaS/product companies operating business-critical web apps/APIs/cloud footprints | Security/AppSec/CTO may evaluate; budget owner to verify | No eligible scope, testing already covered, no budget, missing trust/compliance requirements |
| Practitioner-led VAPT/services | Organizations with an externally testable digital estate and time-bound assessment requirements | Security head/CTO/compliance or procurement; verify actual authority | Fully internal assessment capability, weak urgency, misaligned scope or procurement |
| Corporate training | Teams with observable cyber-skills gaps, security onboarding or role-based training needs | Security/L&D/HR sponsors; employees are users | No allocated training budget, generic awareness suffices, lack of delivery fit |
| CTF Arena / custom CTF | Colleges, cybersecurity clubs, event organizers, employer security teams | Faculty/events/security training organizer pays; participants play | Event is unfunded, too little time, competing free event meets need |
| FoxFoster Labs | Learners, training institutions and teams needing practical exercises | Individual learner vs institutional trainer/program owner | Free lab substitutes sufficient, device/network barriers, no training mandate |
| Academy | Students, graduates, career changers and working IT professionals building cyber skills | Individual purchaser/learner or sponsoring institution | Price sensitivity, low completion intent, free course substitution, outcome mismatch |

Do not automatically merge these six tracks into “IT companies.” For academy and labs, tests should distinguish individual-paid, institution-paid and employer-sponsored routes. For CTF, distinguish event purchase from repeat platform adoption.

## 17.3 Pilot geographic and economic assumptions
If FoxFoster's preferred region, price bands, security attestations, delivery capacity or sales channels are not supplied, treat them as **unknown**. Begin with an English-language, source-accessible research pilot and report geographic bias; ask the owner to set a commercial operating region before recommending investment. Do not assume US, India, or global sales ability merely because a website is accessible.

## 17.4 Example end-to-end path: Xnolex
1. Form initial hypothesis: product-oriented SaaS companies managing web/API/cloud exposure may benefit from evidence-backed security assessment.
2. Search from multiple directions: official developer docs, product launches, public APIs, security job roles, compliance claims, buyer discussions, published assessment procurement, competitor alternatives.
3. Identify sample organizations from approved sources; verify active product estate and entity identity.
4. Separate signals: a new product launch suggests an asset may exist, **not** that the company wants VAPT. Explicit procurement or customer-verified pain is stronger evidence.
5. Construct buyer map: AppSec/security lead as evaluator, CTO/CISO or other verified sponsor, procurement/compliance as possible gates.
6. Red-team: internal security team already covers testing; incumbent vendor contract; business lacks eligible budget; service cannot meet required assurances; company is too early or too mature.
7. Independently verify material facts; downgrade if only one promotional source supports them.
8. Rank the segment against a narrower alternative (e.g., specific SaaS maturity/region/contract type) and against other FoxFoster offers, with score *ranges*.
9. Recommend interviews with actual security decision-makers and a bounded pilot only if field evidence supports economic viability.
10. Send **criteria**, not mass personal contacts, to the lead-intelligence module.

## 17.5 Pilot acceptance fixture: hypothetical target
`Company A` is a fictitious SaaS firm with a recently launched web app. Expected system behavior: mark `possible structural fit`; record `product launch` as a weak timing signal; refuse to mark `active VAPT buyer`; check existing security practices, assessment requirements, asset criticality, buyer authority and budget via permitted evidence/interview; allow `unknown` for inaccessible data. This fixture must pass regression testing.

## 17.6 Proposed pilot output priorities
Generate a separate 2–4 page dossier for each of the six offering tracks; choose at most three to pursue first only after comparable evidence and user constraints are available. Include why *not* to prioritize the others. No invented list of “500 verified leads”; sample organizations only if actually checked.

# 18. API and integration contracts

**Endpoints (illustrative):**
- `POST /v1/businesses` create/edit business profile.
- `POST /v1/research-runs` with `business_id`, `offers`, `geo_scope`, `mode`, `budgets`, `policy_id`, `success_criteria`.
- `GET /v1/runs/{id}` stage, status, costs, findings, skipped checks.
- `GET /v1/runs/{id}/evidence?claim_id=` provenance and counterevidence.
- `GET /v1/runs/{id}/icps` ranked, versioned cards.
- `POST /v1/icps/{id}/review` accept/reject/correct with reason.
- `POST /v1/runs/{id}/feedback` outcome/quality events.
- `POST /v1/runs/{id}/refresh` delta investigation.
- `GET /v1/runs/{id}/exports?format=json|csv|md|docx` approved artifact.

All write endpoints require tenant-scoped authorization, request idempotency and audit logs. External CRM integrations are optional, disabled by default, mapping-based and subject to user approval and deletion/revocation controls.

**Example response skeleton:**
```json
{
  "icp_id": "icp_001",
  "offer_id": "x_provisional",
  "status": "evidence_supported",
  "segment_definition": "Hypothesis: SaaS with material web/API footprint in approved geography",
  "structural_fit": "possible",
  "buying_intent": "not_observed",
  "opportunity_score": {"low": 61, "high": 79, "rubric_version": "1.0"},
  "evidence_grade": "B",
  "supporting_claim_ids": ["claim_101"],
  "counterclaim_ids": ["claim_205"],
  "disqualifiers": ["no_budget_owner_identified"],
  "commercial_validation_status": "not_tested",
  "next_best_test": "buyer_problem_interviews"
}
```

# 19. Functional requirements with acceptance tests

| ID / priority | Requirement | Verifiable acceptance criterion |
|---|---|---|
| F01 P0 | Low-friction intake | Business name, offer and problem can start a run; all missing nonessential fields labeled unknown. |
| F02 P0 | Multi-offer decomposition | Mixed business produces separate offer trees, not one generic ICP. |
| F03 P0 | Breadth/coverage matrix | Every applicable research angle has searched/deferred/skipped status and reason. |
| F04 P0 | Reproducible source plan | Queries, adapters, filters, timestamps, rate/cost limits and results are logged. |
| F05 P0 | Policy-compliant collection | Disallowed or blocked sources do not get crawled; no bypass fallback. |
| F06 P0 | Evidence provenance | Every cited claim resolves to a retained allowed source reference and snippet/date. |
| F07 P0 | Entity resolution | Two companies with similar names are not merged without stronger identifiers. |
| F08 P0 | Intent separation | Product launch alone never sets `active_purchase_intent=true`. |
| F09 P0 | Independent red team | Every shortlisted ICP receives disconfirming analysis and disposition. |
| F10 P0 | Independent verification | Material recommendations are checked from source evidence, not agent summary alone. |
| F11 P0 | No fabricated market size | Insufficient inputs produce unknown/range, never a made-up precise TAM. |
| F12 P0 | Explicit anti-ICPs | Winner includes hard exclusions, boundary examples and rejection reasons. |
| F13 P0 | False-negative handling | Missing public evidence may defer a segment rather than auto-reject it. |
| F14 P0 | No forced winner | Inconclusive run may recommend zero ICPs with gap-closure plan. |
| F15 P0 | Reproducibility | Same frozen inputs/config/fixture sources produce the same deterministic decisions. |
| F16 P0 | Controlled feedback | Corrections are traceable; prompt/policy changes cannot silently deploy. |
| F17 P0 | B2C support | Individual-paid and sponsored purchase paths are independently modeled. |
| F18 P0 | Operator controls | Pause, cancel, edit assumptions, retry authorized sources and export audit trail. |
| F19 P1 | Delta refresh | Reports distinguish new, changed, stale and unchanged claims. |
| F20 P1 | CRM handshake | Handoff exports account-level criteria and evidence with tenant approval. |
| F21 P1 | Source planner optimization | Routing accounts for cost, legal permissions, quality and information gain. |
| F22 P1 | Outcome-based calibration | Delayed feedback measured by cohort; selection bias caveats surfaced. |
| F23 P2 | Multilingual/adjoining markets | Query expansion and translation maintain original-language evidence pointers. |
| F24 P2 | Collaborative approvals | Role-based sign-off, comments, comparative version history. |

# 20. Non-functional requirements, SLO targets, and test coverage

**Reliability:** resumable stage checkpoints; idempotent tasks; no duplicate evidence ingestion on retry; partial reports clearly identify failed sources.  
**Security:** RBAC/ABAC tenant isolation, encrypted transport and storage, secret vault, least privilege for connectors, prompt-injection sanitization of external pages, sandboxed parsing, outbound network allowlist, input and file-type validation, abuse monitoring.  
**Privacy:** collect primarily company/role-level information, minimization, retention and deletion by tenant, consent and legal-basis tracking where applicable, cross-border transfer controls, opt-out suppression for downstream contacts.  
**Observability:** per-run evidence counts, unique originating sources, adapter success, duplicate rate, citation validity, contradictions resolved, budget, model versions, failures, human interventions.  
**Interoperability:** open JSON schemas, CSV, portable relational/claim export, API versioning, no single LLM or directory vendor dependency.  
**Accessibility:** keyboard-accessible review, readable evidence states, non-color-only statuses, explainable score breakdown.  
**Cost containment:** configurable per-run total, per-source, per-LLM, crawl and deadline budgets; warn before optional overages; bounded recursion and concurrency.

**Initial measurable quality targets (engineering targets to validate, not proven performance):** 100% of published material claims have source pointers or explicit `inference/unknown` labels; 100% of shortlisted ICPs have red-team artifacts; 0 known policy-disallowed fetches; 0 silently invented TAM values; >95% of sample citations resolve in an audited fixture; >90% entity precision in held-out labeled benchmark; 100% of suggested learning changes have evaluation records; human adjudication on high-impact verification conflicts. Targets must be refined after baseline measurement.

**Test suite:** unit/schema tests; source adapter contract tests; robots/rate-limits; SSRF and injection; source-content adversarial instruction attacks; stale/contradictory dates; syndication clustering; entity aliases/parent-child; industry overlap; buyer-user confusion; no-buying-intent fixtures; counterfactual red-team; missing data; regional/language bias; privacy erasure; regression on archived gold ICPs; scoring sensitivity; end-to-end pilot acceptance.

# 21. Metrics and evaluation design

**Leading:** coverage breadth, independent sources per material claim, verification pass rate, contradiction detection, valid ICP cards, audit completion, human correction rate, time/cost per high-quality finding.  
**Decision quality:** precision/recall for benchmark segment classification, predicted-vs-actual qualified discovery rate, confidence calibration, missed high-value niches, false-positive causes, rank stability, reviewer agreement.  
**Commercial:** cost to validated segment, stage conversion by recommended ICP, sales-qualified opportunity yield, deal size/margin/retention when available, comparisons to control/baseline.  
**Responsible operation:** unsupported personal data stored, prohibited fetches, unresolved rights requests, source-license exceptions, LLM hallucination events, unresolved policy blockers.

Use blinded evaluation where possible. Include **counterfactual negatives** and a holdout of non-obvious high-fit segments; an engine that only recommends popular categories should score poorly on discovery diversity. Compare against human baseline and simple firmographic ICP rule baseline, not merely previous model version.

# 22. Human roles and approval checkpoints

**Business owner** verifies product realities, pricing, delivery, target regions and desired outcomes; **GTM analyst** reviews segmentation and field-test relevance; **data/privacy owner** approves sources and lawful processing; **engineering owner** owns adapters, reproducibility and security; **research QA** audits evidence and red-team independence. One small team may combine roles, but the system must still log logical sign-offs.  
**Human required:** material source-policy exceptions, using sensitive/identified personal data, high-risk market claims, new data-provider integration, change of validation criteria, publication of commercially validated status, expansion to outbound actions, and overrides of hard exclusions.

# 23. Implementation roadmap and dependency order

**Phase A — Evidence-safe foundation:** intake, offer map, core schema, run policy, source adapter registry, evidence provenance, crawler/extractor, storage, basic UI, test fixtures. Exit when FoxFoster public offerings are properly separated and all sources traceable.  
**Phase B — Discovery engine:** coverage matrix, query planner, broad market universe, role-level buyer mapping, competitor/substitute analysis, entity resolution, reproducible reports. Exit when multiple segment archetypes per offer can be explained.  
**Phase C — Adversarial quality:** isolated critic, independent verification, contradictions, confidence grades, anti-ICP boundaries, scoring intervals, refusal to force a winner. Exit when adversarial fixtures demonstrably downgrade weak ICPs.  
**Phase D — Decision and field validation:** approval workflow, validations, evidence ledger, handoff exports, experiment designer, pilot comparison. Exit when an analyst can execute an evidence-backed first validation sprint.  
**Phase E — Learning and scale:** delayed outcome integrations, evaluations, prompt/rubric proposal registry, controlled releases, refresh monitors, multi-tenant safeguards, multilingual and paid adapters if approved. Exit when measured improvement survives holdout tests without policy regression.

**Avoid premature complexity:** a small initial implementation can use PostgreSQL, Scrapy/Trafilatura, Prefect, a constrained LLM agent layer, and simple relational provenance. Only add vector DB, large knowledge graph, or multi-agent complexity when evaluation shows clear benefit.

# 24. Risks, mitigations, and honest limitations

| Risk | Mitigation |
|---|---|
| “Every angle” impossible / unbounded crawl | Explicit taxonomy, bounded budgets, marginal-information stop rules, visible gaps |
| Model hallucinations | Raw citations, strict extraction schemas, independent verifier, unknown state |
| Echo-chamber confirmation | Separate red team, adversarial searches, duplicate-origin collapse |
| Stale or biased directories | Record date/coverage bias; use original company sites and alternate sources |
| Source licensing / privacy / anti-bot | Allowlisted adapters, access policy, robots/TOS review, no bypass, minimized PII |
| Uncertain purchasing intent | Separate structural fit and observed intent; field interviews |
| Vendor lock-in or license surprise | OSS-first adapters, version checks, license registry, exportable data |
| High costs/low value | Budget-aware planner, caching, early stop, source ROI monitoring |
| Overfitting to FoxFoster or common SaaS | Multi-industry gold cases, B2C/institutional fixtures, holdouts |
| Self-learning drift | Versioned proposals, canaries, rollback, no automatic safety/rule changes |
| Inflated market size | Show method, assumptions, intervals or decline calculation |
| Competitor misinformation | Original sources, observation dates, independent checks |
| Security risks in crawled content | Treat all pages as untrusted data; parser sandbox, no tool instructions from pages |

# 25. Autonomous engineering-agent latitude: controlled openness

This PRD specifies **outcomes, invariants, interfaces and acceptance gates**, not mandatory implementation mechanics. The implementing agent is expressly encouraged to propose superior architectures, tools, research angles, scoring methods, sampling strategies, datasets and evaluation approaches, including replacing named tools. A proposal must document: `problem`, `evidence of benefit`, `proposed delta`, `alternatives considered`, `cost/license/security impact`, `migration plan`, `acceptance tests`, `rollback`, and `required approval`.

**Must preserve:** no unsupported claims; independent adversarial review; independent verification; provenance; explicit uncertainty; compliance-aware source access; no unauthorized contact scraping; no silent deployment of unsafe self-learning; tenant isolation; human-approved commercial validation.  
**Can change after evaluation:** retrieval techniques, agent topology, query expansion, UI components, source priorities, dedup implementation, noncritical weights, representation models, data stores and orchestration frameworks.  
**Agent directive:** optimize for *decision quality per unit of reliable evidence*, not raw pages fetched, number of leads, agent messages or superficially high confidence.

# 26. Open decisions to resolve at project kickoff

1. Deployment: local-first, self-hosted SaaS or hybrid? LLM provider/data residency requirements?
2. Target customer: solo operators vs multi-client agencies vs internal enterprise teams first?
3. Initial geography and language coverage; supported registries and directory permissions?
4. Primary monetization/product packaging; what research depth is economically sustainable?
5. What validated business outcome is available for feedback and how is it anonymized?
6. Initial FoxFoster commercial focus: one or all six offerings, target geographies, delivery constraints and price bands?
7. Which datasets and CRM systems, if any, are authorized for a private pilot?
8. What confidence/coverage level warrants a go/no-go presentation?
9. Which review gates can a small team combine without losing independence?
10. What retention, deletion and cross-border processing policies apply to pilot data?

**Decision default:** if answers are missing, proceed with a clearly labeled public-evidence, low-PII, no-outreach discovery run; do not silently fill in budgets, sales reach or buyer authority.

# 27. Source register and verification notes

These sources ground the **FoxFoster public-offering snapshot** and the **capabilities/license observations for the selected tools**; they do not independently validate the market hypotheses, tool security, or eventual ICP commercial results. Re-check license/version, data-provider terms and API restrictions during implementation.

- FoxFoster official platform: https://foxfoster.com/
- Crawlee repository/license: https://github.com/apify/crawlee
- Scrapy repository/license: https://github.com/scrapy/scrapy
- Playwright repository/license: https://github.com/microsoft/playwright
- SearXNG documentation: https://docs.searxng.org/user/about.html
- Trafilatura repository/license: https://github.com/adbar/trafilatura
- Prefect repository/license: https://github.com/PrefectHQ/prefect
- LangGraph library package metadata: https://github.com/langchain-ai/langgraph/blob/main/libs/langgraph/pyproject.toml
- Splink entity resolution: https://github.com/moj-analytical-services/splink
- RapidFuzz repository/license: https://github.com/rapidfuzz/RapidFuzz
- DuckDB project/FAQ: https://duckdb.org/
- Qdrant repository/license: https://github.com/qdrant/qdrant
- Common Crawl data access: https://www.commoncrawl.org/get-started
- SEC developer/API resources: https://www.sec.gov/about/developer-resources
- GitHub public API rate limits: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- Robots guidance: https://developers.google.com/search/docs/crawling-indexing/robots/intro
- UK ICO direct marketing/privacy guidance: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/direct-marketing-guidance/
- Airbyte repository licensing note (example of source-available distinctions): https://github.com/airbytehq/airbyte/blob/master/docs/community/licenses/README.md

---

**Final product acceptance statement:** A new business can submit a concise brief, receive a broad and transparently bounded market exploration, inspect multiple independently checked and red-teamed ICP hypotheses, reject or accept recommendations with reasons, obtain a precise field-validation and downstream account-research plan, and run the process again with measurable, governed improvements. **The system never pretends that public web research alone proves a segment will buy.**
