# PRISM

**Evidence led customer research with a local Next.js dashboard.** PRISM takes a business and its offers, explores possible customer groups, collects public pages, tests the strongest claims against source text, challenges weak options, and gives a short list of choices to investigate in the field. The full portfolio stays visible, including rejected options and gaps.

The repo is usable locally. A fork can run `npm install && npm run dev`, open `http://localhost:3000`, and click **Research FoxFoster** for the six offer pilot. Enter another business with **Start a run**. Choose three or five results. The system may return zero when the evidence is thin.

## What the dashboard shows

| View | Purpose |
| --- | --- |
| Overview | Best choices, other customer groups, research steps, and next actions |
| Past research | Local history of runs |
| Sources | Each retained public page, original URL, and excerpt |
| Your business | The input brief and a JSON export |
| All findings | Every group, its support, objections, proof gaps, and rejection reason |

A recommended choice is a **research lead**. It does not establish buying intent or a commercially validated ICP. PRISM asks for buyer interviews and real outcomes before making that judgment.

## Quick start

Requires Node.js 22 or newer. The app is local and stores runs under `data/`.

```bash
npm install
npx playwright install chromium
npm run dev
```

Open [localhost:3000](http://localhost:3000). `npm run build && npm start` starts a production build locally. `npm test` runs the deterministic decision engine tests. `npm run demo` runs the original JSON fixture through the CLI. `npm run pilot` starts the live FoxFoster research run from the command line.

The dashboard can collect public pages without credentials. An optional model and SearXNG increase research breadth and enable automated analysis. Create `.env.local` for local configuration.

```env
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o-mini
# Optional OpenAI compatible chat completions endpoint
# OPENAI_BASE_URL=https://your-provider.example/v1/chat/completions
# Optional self-hosted metasearch with JSON output enabled
# SEARXNG_URL=http://localhost:8080
```

If no model is configured, PRISM still crawls permitted public pages and shows candidate groups, sources, and the remaining questions. It withholds recommendations that lack checked evidence. The app uses the same configured model provider for separate analysis, critic, and verifier calls. For high stakes decisions, have a human reviewer examine the original pages and interview buyers.

## FoxFoster pilot

The **Research FoxFoster** button loads `foxfoster.json`. It keeps Academy, Labs, CTF Arena, Xnolex, practitioner services, and corporate training as distinct offers. The pilot explores individual, institutional, employer, direct, procurement, and channel buying paths as applicable. The official site establishes the public offering map. It does not prove pricing, budgets, segment demand, buyer authority, conversion, or willingness to pay. The initial pilot can therefore end with no selected ICP. [FoxFoster public site](https://foxfoster.com/)

## Architecture and research workflow

```text
Next.js dashboard
  → POST /api/runs validates brief and creates a run ID
  → local run store records the brief, status, activity, pages and findings
  → planner maps separate offer × buying motion × geography paths
  → optional model expands adjacent segment hypotheses
  → official site collector reads the home page and bounded relevant links
  → search layer tries SearXNG, DuckDuckGo HTML, then Bing HTML
  → page collector checks URL and robots policy, fetches HTML, parses with Cheerio
  → Playwright renders pages whose HTML lacks readable content
  → optional analyst drafts source linked support and counterclaims
  → optional skeptic challenges substitutes, budget, fit and timing
  → optional verifier checks claims against original excerpts
  → deterministic gate checks literal quotes, source independence and exclusions
  → dashboard presents at most 3 or 5 choices plus all rejected and deferred paths
  → field interview and outcome evidence must supply commercial validation
```

The controller owns run limits and final gates. The model does not choose its own tools or directly change policy. Source pages are untrusted input to the model. Search result listings are discovery pointers and are never counted as original page evidence.

### Collector behavior

- The official page adapter reads the supplied HTTPS website and up to five relevant same host links.
- Search uses a configured SearXNG JSON endpoint when available. It then tries public DuckDuckGo and Bing HTML results. Search pages may block requests, so missed searches appear as gaps.
- Each discovered result is fetched as an original HTML page. Cheerio removes navigation, scripts, forms and other page chrome before the excerpt is retained.
- Playwright is used for an initial page that needs JavaScript rendering. It runs headless Chromium and blocks images, media and fonts to contain cost.
- The collector checks robots.txt and rejects non HTTPS URLs, embedded credentials, local hostnames and private IP targets. It does not follow cross host redirects. Page count, search results, excerpt size and request deadlines are bounded.
- The current collector handles HTML. PDFs, licensed databases, logged in sites and personal contact harvesting are outside this release.

### Claim and decision rules

A model drafted positive claim only counts when a retained original page contains the exact quoted text and the separate verifier accepts the claim. Two positive claims must come from distinct hostnames. A documented skeptical challenge is required. A verified hard exclusion rejects the group. If these gates fail, the group is shown as **Needs evidence**. The displayed score is a provisional research priority, not a calibrated purchase probability. No precise TAM or buying intent is inferred from a website.

The roles use separate model calls, but they share the configured model provider. This is an automated challenge and verification layer, not a guarantee of independent human judgment. The page text, source URLs, rejected claims and unresolved gaps remain available for review.

## Project structure

| Path | Responsibility |
| --- | --- |
| `app/dashboard.jsx`, `app/globals.css` | Local dashboard and presentation |
| `app/api/runs/` | Create, list, inspect and export runs |
| `lib/research.js` | Stage orchestration, critique and decision gate |
| `lib/crawler.js` | Search, robots, HTTP parsing and Playwright rendering |
| `lib/store.js` | Atomic JSON persistence under `data/` |
| `planner.js`, `evidence.js`, `engine.js` | Deterministic planner and reviewed evidence CLI core |
| `foxfoster.json` | Six offer reference pilot |
| `Autonomous_ICP_Discovery_PRD_v1.md` | Full product requirements and acceptance gates |
| `AGENTS.md` | Instructions for coding agents working in a fork |

## API and run records

- `GET /api/runs` lists locally saved runs.
- `POST /api/runs` starts a run. Send `{ "pilot": "foxfoster", "topCount": 3 }` for the reference pilot. For another business, send `name`, `offer`, `problem`, optional `website`, `geography`, `model`, and `topCount`.
- `GET /api/runs/:id` returns the full run with activity and findings.
- `GET /api/runs/:id/export` downloads the JSON record.

The filesystem store uses `data/<run-id>/run.json` with a temporary write and rename. It needs no separate database for one local user. A deployed multiuser product would need authentication, tenant isolation, a durable database, a job queue, and a scheduled worker. The current in process runner is intended for local use.

## What remains before the full PRD is met

This implementation provides live public web collection and a visible research loop. The broader PRD still calls for licensed and government source adapters, deeper crawl scheduling, entity resolution, source independence beyond hostname, proper reviewer approval, outcome feedback, refresh runs, and evaluation against a labeled benchmark. A commercial validation label must only come from agreed real world outcomes. The roadmap in the PRD describes those later stages. [Full PRD](Autonomous_ICP_Discovery_PRD_v1.md)

## Development and safety

`npm test` checks the deterministic evidence gates. `npm run build` checks the Next.js app. `data/`, `.env.local`, and `.next/` are ignored. Do not commit API keys, customer data, or generated run records. Use the source URLs and activity log to audit a result. Respect each source's terms and robots policy when adding adapters. The code is available under the MIT License.


