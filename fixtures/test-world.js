/** Offline fixture world: a fake web and a deterministic model, so every gate can be tested without network. */
import { extractPage } from '../lib/crawler.js';
import { fixtureLLM } from '../lib/llm.js';

const page = (title, body, published = '2026-09-15') =>
  `<html lang="en"><head><title>${title}</title><meta property="article:published_time" content="${published}"></head><body><main>${body}</main></body></html>`;

export const WEB = {
  'https://acme.test/': page('Acme Secure — API Scanner',
    '<p>Acme Secure builds API Scanner, an automated API security testing platform for SaaS teams.</p>' +
    '<p>Our API Scanner finds broken authentication flaws before attackers do. Trusted by fast-growing companies.</p>' +
    '<a href="https://acme.test/pricing">Pricing</a><a href="https://acme.test/login">Login</a>'),
  'https://acme.test/pricing': page('Pricing — Acme Secure',
    '<p>API Scanner plans are billed per API under test. Contact sales for enterprise procurement and security review packs.</p>'),
  'https://news.example.org/api-breaches': page('Survey: API incidents top SaaS security problems',
    '<p>Industry survey: SaaS companies reported API security incidents as their most frequent security problem this year.</p>' +
    '<p>Security teams at SaaS companies struggle to keep an inventory of their public APIs.</p>'),
  'https://copy.example.net/syndicated/api-breaches': page('Survey: API incidents top SaaS security problems',
    '<p>Industry survey: SaaS companies reported API security incidents as their most frequent security problem this year.</p>' +
    '<p>Security teams at SaaS companies struggle to keep an inventory of their public APIs.</p>'),
  'https://standards.example.gov/api-guidance': page('Public API security guidance',
    '<p>Organizations that publish public APIs should perform regular security testing of authentication and authorization.</p>' +
    '<p>Agencies must test externally exposed APIs before procurement approval.</p>'),
  'https://forum.example.com/t/api-testing-tools': page('Do you pay for API testing tools?',
    '<p>Most small SaaS startups rely on free open source scanners like ZAP instead of paying for API testing tools.</p>' +
    '<p>We only buy a tool when a customer security questionnaire forces us to.</p>'),
  'https://law.example.gov/rule-12': page('Rule 12: assessor eligibility',
    '<p>Foreign security consultancies are prohibited from assessing federal systems under this rule.</p>'),
  'https://linkedin.com/company/acme': page('LinkedIn', '<p>Should never be fetched.</p>'),
};

export const fetchLog = [];
export const net = {
  async crawlPage(url) {
    fetchLog.push(url);
    const html = WEB[url];
    if (!html) return {status: 'skipped', reason: 'HTTP 404', url};
    return {status: 'collected', page: extractPage(html, new URL(url), 'fixture')};
  },
  async discover() {
    return {adapter: 'fixture-search', errors: [], results: [
      'https://news.example.org/api-breaches', 'https://standards.example.gov/api-guidance', 'https://forum.example.com/t/api-testing-tools',
      'https://copy.example.net/syndicated/api-breaches', 'https://law.example.gov/rule-12', 'https://linkedin.com/company/acme',
    ].map(url => ({url, title: (WEB[url].match(/<title>([^<]*)/) ?? [])[1] ?? url, snippet: ''}))};
  },
  async newsSearch() { return []; },
};

const QUOTES = {
  'news.example.org': [{segmentId: 'G01', angle: 'pain', direction: 'support', quote: 'SaaS companies reported API security incidents as their most frequent security problem this year'}],
  'copy.example.net': [{segmentId: 'G01', angle: 'pain', direction: 'support', quote: 'SaaS companies reported API security incidents as their most frequent security problem this year'}],
  'standards.example.gov': [{segmentId: 'G01', angle: 'pain', direction: 'support', quote: 'Organizations that publish public APIs should perform regular security testing'}],
  'forum.example.com': [{segmentId: 'G01', angle: 'competition', direction: 'challenge', quote: 'Most small SaaS startups rely on free open source scanners like ZAP'}],
  'law.example.gov': [{segmentId: 'G02', angle: 'risks', direction: 'exclusion', quote: 'Foreign security consultancies are prohibited from assessing federal systems'}],
  'acme.test': [{segmentId: 'G01', angle: 'fit', direction: 'support', quote: 'automated API security testing platform for SaaS teams', interestedParty: true},
    // A fabricated quote that is not on the page — must be rejected by the literal quote gate.
    {segmentId: 'G01', angle: 'economics', direction: 'support', quote: 'customers report a 300% ROI within weeks of adopting API Scanner'}],
};

export const llm = fixtureLLM((role, payload) => {
  if (role === 'intake') return {
    summary: 'Acme Secure sells API Scanner, an automated API security testing platform.', businessModel: 'b2b',
    offers: [{name: 'API Scanner', category: 'security testing', productOrService: 'product', userJob: 'find API flaws',
      buyerJob: 'reduce breach risk', promisedOutcome: 'finds broken authentication flaws', origin: 'publicly_observed',
      quote: 'finds broken authentication flaws before attackers do', sourceUrl: 'https://acme.test/'}],
    facts: [{statement: 'Pricing is per API under test', origin: 'publicly_observed', quote: 'billed per API under test', sourceUrl: 'https://acme.test/pricing'},
      {statement: 'Has 500 enterprise customers', origin: 'publicly_observed', quote: 'serving 500 enterprise customers', sourceUrl: 'https://acme.test/'}],
    assumptions: ['Sells mainly to SaaS companies'], unknowns: ['Price bands'], geographies: ['unknown'],
  };
  if (role === 'cartographer') return {segments: [
    {offer: 'API Scanner', name: 'SaaS teams with public APIs', archetype: 'company_type', motion: 'direct team purchase', user: 'AppSec engineer',
      buyer: 'CTO', influencers: [], job: 'find API flaws', whyPlausible: 'APIs are exposed', trigger: 'customer security questionnaire',
      disqualifiers: ['No public API'], searchTerms: ['saas api security'], antiSignals: ['internal only'], model: 'b2b'},
    {offer: 'API Scanner', name: 'Foreign consultancies assessing federal systems', archetype: 'channel_partner', motion: 'channel', user: 'consultant',
      buyer: 'practice lead', influencers: [], job: 'deliver assessments', whyPlausible: 'resell', trigger: 'contract',
      disqualifiers: [], searchTerms: ['federal assessment'], antiSignals: [], model: 'b2b'},
    {offer: 'API Scanner', name: 'Fintechs preparing for audits', archetype: 'lifecycle_event', motion: 'procurement', user: 'security team',
      buyer: 'CISO', influencers: [], job: 'pass audit', whyPlausible: 'audits', trigger: 'audit date',
      disqualifiers: [], searchTerms: ['fintech api audit'], antiSignals: [], model: 'b2b'},
  ]};
  if (role === 'extractor') return {
    claims: payload.sources.flatMap(source => (QUOTES[source.host] ?? []).map(item => ({sourceId: source.sourceId, statement: 'Claim: ' + item.quote,
      interestedParty: false, signalType: 'none', ...item}))),
    organizations: [{name: 'Acme Secure', domain: 'acme.test', sourceId: payload.sources[0].sourceId, role: 'vendor'},
      {name: 'Acme', domain: '', sourceId: payload.sources[0].sourceId, role: 'other'},
      {name: 'Acme Secure', domain: 'acme-secure.example', sourceId: payload.sources[0].sourceId, role: 'competitor'}],
  };
  if (role === 'analyst') return {
    cards: payload.segments.map(segment => ({segmentId: segment.segmentId, definition: segment.name + ' (precise)',
      hypothesis: `${segment.name} test APIs regularly; disproved if they report no recent incident or rely on free tools.`,
      job: segment.job, trigger: segment.trigger || 'unknown', structuralFit: ['Publishes a public API', 'Has a security or engineering team'],
      disqualifiers: ['No public API'], boundaryExamples: ['Internal-only API teams'],
      buyingGroup: {user: 'AppSec', champion: 'Security lead', economicBuyer: segment.buyer, influencers: ['Engineering manager'], gates: ['Procurement']},
      economics: 'unknown', channels: ['Developer communities'], positioning: 'Evidence-backed API testing', evidenceNeeds: ['Budget owner'],
      supportingClaimIds: ['C9999'], counterClaimIds: []})),
    alternatives: [{name: 'OWASP ZAP', type: 'free_tool', offer: 'API Scanner', note: 'Free scanner', claimIds: []}],
  };
  if (role === 'skeptic') return {reviews: payload.segments.map(segment => ({
    segmentId: segment.segmentId,
    tests: ['no_pain', 'no_budget', 'substitution'].map(id => ({id, result: id === 'substitution' ? 'fail' : 'pass', note: 'fixture', claimIds: [], sourceId: '', quote: ''})),
    strongestFor: 'Frequent API incidents', strongestAgainst: 'Free scanners', assumptions: ['Budget exists'], falsePositiveCauses: ['Survey bias'],
    wouldChangeDecision: 'Interviews', killSwitch: {fired: false, reason: '', sourceId: '', quote: ''}, status: 'revise'}))};
  if (role === 'verifier') return {checks: payload.claims.map(claim => ({claimId: claim.claimId,
    verdict: claim.sourceIsVendorOwnSite ? 'promotional' : 'supported', reason: 'fixture'}))};
  if (role === 'accountFit') return null;
  return null;
});
