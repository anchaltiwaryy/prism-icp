/** Mandatory outputs (PRD §14.4): decision memo, market map, ICP specs, evidence ledger, adversarial report,
 * validation sprint, lead-intelligence brief, run report, CSV/JSON exports. */
import { STAGE_LABELS } from './pipeline.js';
import { RED_TEAM_TESTS } from './taxonomy.js';
import { csv } from './util.js';

const md = value => String(value ?? '').replace(/[|]/g, '\\|').replace(/[\r\n]+/g, ' ').trim();
const list = items => (items?.length ? items.map(item => `- ${md(item)}`).join('\n') : '- none recorded');
const decisionLabel = {explore_first: 'Explore first', conditional_test: 'Conditional test', defer: 'Defer / watch', reject: 'Reject'};

function claimLine(run, id) {
  const claim = run.claims.find(item => item.id === id);
  if (!claim) return null;
  return `${claim.id} [${claim.epistemic}${claim.interestedParty ? ', interested party' : ''}] ${md(claim.statement)} — “${md(claim.quote.slice(0, 180))}” <${claim.sourceUrl}>`;
}

export function icpSpec(run, card) {
  const support = card.supportingClaimIds.slice(0, 5).map(id => claimLine(run, id)).filter(Boolean);
  const objections = (card.redTeam?.tests ?? []).filter(test => ['fail', 'concern'].includes(test.result)).slice(0, 3)
    .map(test => `${test.id} (${test.result}): ${md(test.note)}`);
  return [
    `### ${card.id} · ${md(card.segment)}`,
    '',
    `| Field | Value |`, `|---|---|`,
    `| Offer | ${md(card.offer)} |`, `| Geography | ${md(card.geography)} |`, `| Definition | ${md(card.definition)} |`,
    `| Pain / JTBD | ${md(card.job)} |`, `| User / champion / economic buyer | ${md(card.buyingGroup?.user)} / ${md(card.buyingGroup?.champion)} / ${md(card.buyingGroup?.economicBuyer)} |`,
    `| Influencers and gates | ${md([...(card.buyingGroup?.influencers ?? []), ...(card.buyingGroup?.gates ?? [])].join(', ') || 'unknown')} |`,
    `| Trigger | ${md(card.trigger)} |`, `| Motion | ${md(card.motion)} |`, `| Economics | ${md(card.economics)} |`,
    `| Acquisition paths | ${md((card.channels ?? []).join(', ') || 'to research')} |`,
    `| Opportunity score (range) | ${card.score?.low}–${card.score?.high} (rubric ${card.score?.rubricVersion}) |`,
    `| Evidence grade / coverage | ${card.score?.grade} / ${card.score?.coveragePct}% |`,
    `| Buying intent | ${card.buyingIntent} |`, `| Commercial validation | ${card.commercialValidation} |`,
    `| Decision | ${decisionLabel[card.decision] ?? card.decision} — ${md(card.decisionReason)} |`,
    `| Maturity / review | ${card.maturity} / ${card.review?.status} |`,
    `| Next best test | ${md(card.nextBestTest)} |`,
    '',
    '**Hypothesis (falsifiable):** ' + md(card.hypothesis), '',
    '**Structural-fit criteria**', list(card.structuralFit), '',
    '**Disqualifiers**', list(card.disqualifiers), '',
    '**Boundary examples**', list(card.boundaryExamples), '',
    '**Supporting claims**', list(support), '',
    '**Strongest objections**', list(objections), '',
    '**Unknowns / evidence needs**', list(card.evidenceNeeds), '',
  ].join('\n');
}

export function memo(run) {
  const recommended = (run.portfolio?.recommended ?? []).map(id => run.cards.find(card => card.id === id)).filter(Boolean);
  const verdict = recommended.some(card => card.decision === 'explore_first') ? 'GO — run the validation sprint on the recommended ICPs'
    : recommended.length ? 'HOLD — conditional tests only; interview before scaling' : 'NO-GO on current evidence — close the gaps below first';
  const lines = [
    `# PRISM decision memo — ${md(run.brief.name)}`, '',
    `Run ${run.id} · ${run.policy.modeLabel} · completed ${run.completedAt ?? 'in progress'} · model ${run.llm?.provider ?? 'none'} ${run.llm?.model ?? ''} · ${run.strategyVersion ?? ''}`, '',
    '> Market research supports hypotheses. It does not show that anyone will buy. Commercial validation needs field outcomes.', '',
    `## Verdict: ${verdict}`, '',
  ];
  if (recommended.length) {
    lines.push('| # | ICP | Offer | Decision | Score | Grade | Strongest objection |', '|---|---|---|---|---|---|---|');
    recommended.forEach((card, index) => lines.push(`| ${index + 1} | ${md(card.segment)} | ${md(card.offer)} | ${decisionLabel[card.decision]} | ${card.score.low}–${card.score.high} | ${card.score.grade} | ${md(card.redTeam?.strongestAgainst ?? '—')} |`));
  } else {
    lines.push(md(run.portfolio?.noRecommendation?.reason ?? 'No recommendation.'), '', '**Gap-closure plan**', list(run.portfolio?.noRecommendation?.gapClosure));
  }
  lines.push('', '## Why not the others', '', ...(run.portfolio?.whyNot ?? []).map(item => `- **${md(item.offer)}** — ${md(item.summary)}`));
  lines.push('', '## Key assumptions to confirm', '', list((run.profile?.assumptions ?? []).map(item => item.text)));
  lines.push('', '## Unknowns', '', list(run.profile?.unknowns));
  lines.push('', `## Ranking stability`, '', run.sensitivity?.stable ? 'Top choices are stable under ±25% changes to any rubric weight.'
    : `Top choices change under some weight perturbations (${(run.sensitivity?.flips ?? []).map(flip => `${flip.dimension}×${flip.factor}`).join(', ')}). Treat the order as provisional.`);
  lines.push('', '## Offer-to-segment market map', '', '| ICP | Offer | Segment | Archetype | Decision | Score | Grade | Coverage |', '|---|---|---|---|---|---|---|---|');
  for (const card of [...run.cards].sort((a, b) => a.offer.localeCompare(b.offer) || (b.score?.mid ?? 0) - (a.score?.mid ?? 0))) {
    lines.push(`| ${card.id} | ${md(card.offer)} | ${md(card.segment)} | ${card.archetype} | ${decisionLabel[card.decision] ?? '—'} | ${card.score?.low}–${card.score?.high} | ${card.score?.grade} | ${card.score?.coveragePct}% |`);
  }
  lines.push('', '## ICP specifications', '', ...recommended.map(card => icpSpec(run, card)));
  lines.push('## Anti-ICPs and exclusions', '', list((run.antiIcps ?? []).map(item => `${item.type.replace('_', ' ')} · ${item.offer}: ${item.text}${item.reason ? ' — ' + item.reason : ''}`)));
  lines.push('', adversarial(run), '', sprint(run), '', leadBrief(run), '', runReport(run));
  return lines.join('\n') + '\n';
}

export function adversarial(run) {
  const reviewed = run.cards.filter(card => card.redTeam && card.redTeam.status !== 'not_reviewed');
  const out = ['## Adversarial report', ''];
  for (const card of reviewed) {
    out.push(`### ${card.id} · ${md(card.segment)} — ${card.redTeam.status} (${card.redTeam.reviewer})`, '',
      `**Strongest for:** ${md(card.redTeam.strongestFor)}`, '', `**Strongest against:** ${md(card.redTeam.strongestAgainst)}`, '',
      '| Test | Result | Note |', '|---|---|---|',
      ...card.redTeam.tests.map(test => `| ${test.id} | ${test.result} | ${md(test.note)}${test.quote ? ` — “${md(test.quote.slice(0, 120))}”` : ''} |`), '',
      '**Falsifiable assumptions**', list(card.redTeam.assumptions), '',
      `**Would change the decision:** ${md(card.redTeam.wouldChangeDecision)}`, '');
  }
  if (!reviewed.length) out.push('No hypothesis had enough evidence to be shortlisted for red-team review.');
  out.push('', `Tests applied: ${Object.keys(RED_TEAM_TESTS).length} (PRD §8).`);
  return out.join('\n');
}

export function sprint(run) {
  const out = ['## Validation sprint', '', 'Pass and kill criteria were registered before any interview. Do not change them after seeing results.', ''];
  for (const experiment of run.experiments ?? []) {
    out.push(`### ${experiment.id} · ${experiment.type.replace(/_/g, ' ')} · ${md(experiment.segment)} (${experiment.purpose}, ${experiment.status})`, '',
      `**Hypothesis:** ${md(experiment.hypothesis)}`, '', `**Sample:** ${md(experiment.sample)}`, '',
      '**Recruiting criteria**', list(experiment.recruitingCriteria), '', '**Script**', list(experiment.script), '',
      `**Pass:** ${md(experiment.passCriterion)}`, '', `**Kill:** ${md(experiment.killCriterion)}`, '', `**Minimum evidence:** ${md(experiment.minimumEvidence)}`, '');
  }
  if (!run.experiments?.length) out.push('No experiments designed.');
  return out.join('\n');
}

export function leadBrief(run) {
  const out = ['## Downstream lead-intelligence brief', '', 'Criteria, not contact lists. Organizations only; buyers are roles. No personal-data sources.', ''];
  for (const card of run.cards.filter(item => item.leadBrief)) {
    const brief = card.leadBrief;
    out.push(`### ${card.id} · ${md(card.segment)}`, '', '**Search queries**', list(brief.searchQueries), '', '**Permitted directories**', list(brief.directories), '',
      '**Account criteria**', list(brief.accountCriteria), '', '**Scoring rules**', list(brief.scoringRules), '', '**Exclusions**', list(brief.exclusions), '',
      '**Fresh-signal monitoring**', list(brief.monitoringSignals), '');
  }
  return out.join('\n');
}

export function runReport(run) {
  const spend = run.spend ?? {};
  const failedCalls = (run.modelCalls ?? []).filter(call => !call.ok);
  return ['## Run report', '',
    `- Mode: ${run.policy.modeLabel} · policy ${run.policy.version} (${run.policy.hash}) · strategy ${run.strategyVersion ?? 'default'}`,
    `- Model: ${run.llm?.provider ?? 'none'} ${run.llm?.model ?? ''} · ${spend.modelCalls ?? 0} calls · ${spend.inputTokens ?? 0} in / ${spend.outputTokens ?? 0} out tokens · $${spend.usd ?? 0}`,
    `- Pages fetched ${spend.pages ?? 0} / ${run.policy.limits.maxPages} · searches ${spend.searches ?? 0} / ${run.policy.limits.maxSearches}`,
    `- Sources retained ${run.sources.length} from ${new Set(run.sources.map(source => source.domain)).size} domains, ${new Set(run.sources.map(source => source.family)).size} independent families`,
    `- Claims ${run.claims.length} admitted · ${run.rejectedExtractions?.length ?? 0} extractions rejected (quote not in source)`,
    `- Coverage: ${run.coverage?.filter(cell => cell.status === 'searched').length ?? 0} of ${run.coverage?.length ?? 0} segment×angle cells searched; deferred cells listed in the JSON export`,
    `- Skipped/blocked URLs: ${run.sourceGaps?.length ?? 0} · model call failures: ${failedCalls.length}`,
    `- Market size: ${run.marketSize?.status ?? 'insufficient_data'} — ${md(run.marketSize?.reason ?? '')}`,
    `- ${md(run.policy.jurisdictionNote)}`, '',
    '| Stage | Status | Attempt | Cost | Model |', '|---|---|---|---|---|',
    ...Object.entries(run.stages ?? {}).map(([id, stage]) => `| ${id} ${STAGE_LABELS[id] ?? ''} | ${stage.status} | ${stage.attempt} | $${stage.cost?.usd ?? 0}, ${stage.cost?.modelCalls ?? 0} calls | ${md(stage.model)} |`),
    '', 'Risk disclosures: public-web evidence over-represents visible, English-language organizations; vendor pages are interested parties; absence of evidence is not evidence of absent demand; nothing here is purchase intent.',
  ].join('\n');
}

export const exporters = {
  json: run => ({type: 'application/json', name: 'prism-run.json', body: JSON.stringify(run, null, 2)}),
  memo: run => ({type: 'text/markdown; charset=utf-8', name: 'prism-decision-memo.md', body: memo(run)}),
  'lead-brief': run => ({type: 'text/markdown; charset=utf-8', name: 'prism-lead-brief.md', body: leadBrief(run)}),
  claims: run => ({type: 'text/csv; charset=utf-8', name: 'prism-claims.csv', body: csv(run.claims.map(claim => ({...claim,
    verdict: claim.verification?.verdict ?? '', verifier: claim.verification?.by ?? ''})),
    ['id', 'segmentId', 'angle', 'direction', 'epistemic', 'verdict', 'statement', 'quote', 'sourceId', 'sourceUrl', 'family', 'tier', 'interestedParty', 'signalType', 'stale', 'published', 'observedAt', 'analyst', 'verifier'])}),
  sources: run => ({type: 'text/csv; charset=utf-8', name: 'prism-sources.csv', body: csv(run.sources,
    ['id', 'url', 'title', 'domain', 'tier', 'kind', 'family', 'syndicated', 'interestedParty', 'adapter', 'query', 'segmentId', 'angle', 'direction', 'published', 'observed', 'contentHash', 'injectionSuspected'])}),
  icps: run => ({type: 'text/csv; charset=utf-8', name: 'prism-icps.csv', body: csv(run.cards.map(card => ({...card, low: card.score?.low, high: card.score?.high,
    grade: card.score?.grade, coverage: card.score?.coveragePct, redTeam: card.redTeam?.status, reviewStatus: card.review?.status,
    recommended: run.portfolio?.recommended?.includes(card.id)})),
    ['id', 'offer', 'segment', 'archetype', 'motion', 'user', 'buyer', 'decision', 'low', 'high', 'grade', 'coverage', 'redTeam', 'buyingIntent', 'commercialValidation', 'maturity', 'reviewStatus', 'recommended', 'definition', 'disqualifiers', 'decisionReason'])}),
};
