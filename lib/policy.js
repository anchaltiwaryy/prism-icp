/**
 * S0 — RunPolicy and budgets (PRD §4.3, §7 S0, §12.3). The controller, not the model, owns these limits.
 */
import { nowIso, rootDomain, sha } from './util.js';

export const POLICY_VERSION = 'policy-1.0';

export const MODES = {
  quick: {label: 'Quick orientation', segmentsPerOffer: 2, maxSegments: 5, maxPages: 12, maxSearches: 8,
    resultsPerSearch: 2, maxModelCalls: 12, maxUsd: 1.5, deadlineMin: 15, redTeamTop: 3, officialPages: 4,
    angleDepth: 1},
  discovery: {label: 'Discovery', segmentsPerOffer: 4, maxSegments: 24, maxPages: 40, maxSearches: 30,
    resultsPerSearch: 3, maxModelCalls: 40, maxUsd: 6, deadlineMin: 45, redTeamTop: 8, officialPages: 7,
    angleDepth: 2},
  deep: {label: 'Deep verification', segmentsPerOffer: 3, maxSegments: 10, maxPages: 70, maxSearches: 50,
    resultsPerSearch: 4, maxModelCalls: 60, maxUsd: 12, deadlineMin: 90, redTeamTop: 10, officialPages: 7,
    angleDepth: 3},
  refresh: {label: 'Refresh / delta', segmentsPerOffer: 0, maxSegments: 0, maxPages: 40, maxSearches: 0,
    resultsPerSearch: 0, maxModelCalls: 20, maxUsd: 4, deadlineMin: 30, redTeamTop: 8, officialPages: 0,
    angleDepth: 0},
};

// Adapters the runtime may activate (PRD §11.2). Only `approved` adapters run.
export const ADAPTER_DEFAULTS = {
  'official-site': 'approved', 'searxng': 'approved', 'duckduckgo-html': 'approved', 'bing-html': 'approved',
  'google-news-rss': 'approved', 'reference-pages': 'approved', 'playwright-render': 'approved',
  'linkedin': 'disabled', 'email-finder': 'disabled',
};

const DEFAULT_FORBIDDEN = ['linkedin.com', 'facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'tiktok.com',
  'zoominfo.com', 'apollo.io', 'rocketreach.co', 'hunter.io', 'lusha.com', 'contactout.com', 'signalhire.com'];

export function buildPolicy(input = {}) {
  const mode = MODES[input.mode] ? input.mode : 'discovery';
  const limits = {...MODES[mode]};
  for (const key of ['maxPages', 'maxSearches', 'maxModelCalls', 'maxUsd', 'deadlineMin']) {
    const value = Number(input.budgets?.[key]);
    if (Number.isFinite(value) && value >= 0) limits[key] = Math.min(value, MODES.deep[key] * 3);
  }
  const forbidden = [...new Set([...DEFAULT_FORBIDDEN, ...(input.forbiddenDomains ?? [])
    .map(domain => rootDomain(String(domain).trim())).filter(Boolean)])];
  const adapters = {...ADAPTER_DEFAULTS};
  for (const [id, status] of Object.entries(input.adapters ?? {})) {
    // Operators may disable or restrict an adapter; enabling a disabled (PII) adapter needs a policy change, not a run flag.
    if (adapters[id] && ['restricted', 'disabled'].includes(status)) adapters[id] = status;
  }
  const policy = {
    version: POLICY_VERSION, mode, modeLabel: limits.label, limits,
    forbiddenDomains: forbidden, adapters, robots: 'respect', personalData: 'role_level_only',
    outreach: 'disabled_by_default', retentionDays: Number(input.retentionDays) > 0 ? Number(input.retentionDays) : 180,
    jurisdictionNote: input.geography ? `Research scoped to ${input.geography}; selection bias toward English-language, indexable sources.`
      : 'No operating region supplied — geography is unknown; English-language public web bias.',
    createdAt: nowIso(),
  };
  policy.hash = sha(JSON.stringify({...policy, createdAt: undefined})).slice(0, 16);
  return policy;
}

export function domainAllowed(policy, url) {
  const root = rootDomain(url);
  return Boolean(root) && !policy.forbiddenDomains.includes(root);
}

/** Budget tracker shared by every stage. `can(kind)` gates the next unit of spend; spend is logged on the run. */
export function budget(run) {
  const limits = run.policy.limits;
  run.spend ??= {pages: 0, searches: 0, modelCalls: 0, inputTokens: 0, outputTokens: 0, usd: 0, startedAt: nowIso()};
  const spend = run.spend;
  const deadline = Date.parse(spend.startedAt) + limits.deadlineMin * 60000;
  return {
    spend,
    can(kind) {
      if (Date.now() > deadline) return false;
      if (kind === 'page') return spend.pages < limits.maxPages;
      if (kind === 'search') return spend.searches < limits.maxSearches;
      if (kind === 'model') return spend.modelCalls < limits.maxModelCalls && spend.usd < limits.maxUsd;
      return true;
    },
    page() { spend.pages++; },
    search() { spend.searches++; },
    model(usage) {
      spend.modelCalls++;
      spend.inputTokens += usage?.inputTokens ?? 0;
      spend.outputTokens += usage?.outputTokens ?? 0;
      spend.usd = Math.round((spend.usd + (usage?.usd ?? 0)) * 10000) / 10000;
    },
    exhausted() {
      const reasons = [];
      if (Date.now() > deadline) reasons.push('deadline');
      if (spend.pages >= limits.maxPages) reasons.push('page budget');
      if (spend.searches >= limits.maxSearches) reasons.push('search budget');
      if (spend.modelCalls >= limits.maxModelCalls || spend.usd >= limits.maxUsd) reasons.push('model budget');
      return reasons;
    },
  };
}
