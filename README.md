# PRISM

A local Next.js dashboard for evidence led ICP research. Enter a business, offer and problem. PRISM maps buyer paths, gathers permitted source references, drafts hypotheses, runs a skeptical pass and checks citations before showing provisional choices. Every run preserves its activity, alternatives, gaps and rejections.

## Start

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Choose **New research**, enter a brief, then choose whether the dashboard should show the top three or top five choices. The full portfolio remains available below the shortlist. Run data is written to `data/` and ignored by Git. No database server is required for local use.

For a production style local run, use `npm run build` and `npm start`. Run `npm test` for the decision engine regressions. `npm run demo` runs the original FoxFoster fixture through the deterministic CLI.

## Research configuration

The dashboard works without keys. With no search or model configured, it maps market paths and records the evidence gaps. To enable source discovery and analysis, set these variables in a local `.env.local` file.

```env
SEARXNG_URL=http://localhost:8080
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o-mini
# Optional OpenAI compatible endpoint
# OPENAI_BASE_URL=https://your-provider.example/v1/chat/completions
```

Run your own SearXNG instance with JSON output enabled. PRISM uses it as an open source search adapter. It also has a bounded official website reader that checks `robots.txt` before fetching. Site blocks, empty searches and unavailable models are recorded as research gaps. The workflow limits search queries, results and excerpt size. The model endpoint must support JSON response format.

The model passes have distinct roles. A segment generator proposes markets. An analyst drafts source linked claims. A critic searches for disqualifiers and substitutes. A verifier checks excerpts. The controller records stages and only promotes a choice when its supporting quotation occurs in a retained source and the verifier accepts it. This is desk research. The output stays provisional until a person reviews the evidence and a real customer outcome is observed. The current verifier uses the same configured provider for separate calls, so it does not establish organizational independence.

## Dashboard

- **Overview** shows current research, shortlisted choices, alternatives and live activity.
- **Research runs** lists every locally saved run.
- **Evidence ledger** links retained source references and excerpts.
- **Business brief** shows the declared starting information and offers JSON export.
- **Full portfolio** includes the top choices, other hypotheses, gaps and rejected paths with reasons. Expand any row to see its evidence and challenge.

Runs are stored as JSON files under `data/<run-id>/run.json`. The write uses a temporary file and rename. The API exposes `GET /api/runs`, `POST /api/runs`, `GET /api/runs/:id` and `GET /api/runs/:id/export`. This local app has no authentication or tenant isolation. Keep it on a trusted local machine.

## Code

| Path | Purpose |
| --- | --- |
| `app/dashboard.jsx`, `app/globals.css` | Dashboard interface |
| `app/api/runs/` | Run, status and export endpoints |
| `lib/research.js` | Bounded collection and research orchestration |
| `lib/store.js` | Local run persistence |
| `planner.js`, `evidence.js`, `engine.js` | Original deterministic planning and scoring core |
| `foxfoster.json` | Example six offer brief |
| `Autonomous_ICP_Discovery_PRD_v1.md` | Full product requirements |

## Limits and next development

The dashboard is a usable local research workspace. It has one official page adapter and SearXNG search. The PRD's multi crawler collection, source license registry, entity resolution, expert human approval, outcome feedback, and commercial validation workflow remain to be built. Search result snippets are discovery pointers and should be checked at original sources before making a decision. No field outcome is inferred from public pages. Vercel deployment would need a persistent database and background job service because `data/` and in process runs are local development choices.
