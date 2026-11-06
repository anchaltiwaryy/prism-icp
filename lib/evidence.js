/**
 * Evidence ledger mechanics (PRD §7 S4–S5, §9): source tiers, syndication families, literal quote checks,
 * freshness, epistemic labels and entity resolution. Deterministic — no model decides what counts.
 */
import { TIMING_TTL_DAYS } from './taxonomy.js';
import { daysBetween, hostOf, jaccard, normalizeText, quoteIn, rootDomain, shingles, shortHash } from './util.js';

const TIER1 = /(^|\.)(gov|mil)(\.[a-z]{2})?$|(^|\.)(sec\.gov|gov\.uk|nic\.in|europa\.eu|companieshouse\.gov\.uk|sam\.gov|ted\.europa\.eu)$/;
const TIER2 = /(^|\.)(edu|ac\.[a-z]{2})$|(^|\.)(nist\.gov|owasp\.org|iso\.org|w3\.org|ietf\.org|enisa\.europa\.eu|cisa\.gov|oecd\.org|worldbank\.org|who\.int|imf\.org|weforum\.org|ncsc\.gov\.uk|sans\.org|isc2\.org|isaca\.org|cloudsecurityalliance\.org|pcisecuritystandards\.org|statista\.com)$/;
const TIER3 = /(^|\.)(reuters\.com|bloomberg\.com|ft\.com|wsj\.com|nytimes\.com|techcrunch\.com|theverge\.com|wired\.com|forbes\.com|economictimes\.indiatimes\.com|livemint\.com|business-standard\.com|thehindu\.com|bbc\.co\.uk|bbc\.com|zdnet\.com|darkreading\.com|securityweek\.com|bleepingcomputer\.com|g2\.com|capterra\.com|gartner\.com|trustradius\.com|crunchbase\.com|wikipedia\.org|clutch\.co|producthunt\.com)$/;
const TIER4 = /(^|\.)(reddit\.com|stackexchange\.com|stackoverflow\.com|quora\.com|medium\.com|substack\.com|news\.ycombinator\.com|indeed\.com|glassdoor\.com|naukri\.com|greenhouse\.io|lever\.co|workable\.com|wellfound\.com|eventbrite\.com|meetup\.com|ctftime\.org|discord\.com|github\.com|dev\.to|hashnode\.dev)$/;

export function classifySource(url, businessDomain) {
  const host = hostOf(url) ?? '';
  const domain = rootDomain(url);
  if (businessDomain && domain === businessDomain) return {tier: 1, kind: 'official', interestedParty: true};
  if (TIER1.test(host)) return {tier: 1, kind: 'registry_or_government', interestedParty: false};
  if (TIER2.test(host)) return {tier: 2, kind: 'standard_or_institution', interestedParty: false};
  if (TIER3.test(host)) return {tier: 3, kind: 'journalism_review_directory', interestedParty: false};
  if (TIER4.test(host)) return {tier: 4, kind: 'community_jobs_events', interestedParty: false};
  return {tier: 3, kind: 'web', interestedParty: false};
}

/**
 * Add a collected page to the run's source ledger. Exact duplicates are refused; near-duplicates
 * (syndicated or mirrored copies) join an existing origin family so they never count as independent.
 */
export function addSource(run, page, meta = {}) {
  run.sources ??= [];
  if (run.sources.some(source => source.url === page.url || source.contentHash === page.contentHash)) {
    return {status: 'duplicate'};
  }
  const prints = shingles(page.excerpt);
  let family = null;
  for (const source of run.sources) {
    const sameTitle = page.title.length > 30 && normalizeText(source.title).toLowerCase() === normalizeText(page.title).toLowerCase();
    if (sameTitle || jaccard(prints, shingles(source.excerpt)) >= 0.55) { family = source.family; break; }
  }
  const classification = classifySource(page.url, run.profile?.domain);
  const id = 'S' + String(run.sources.length + 1).padStart(3, '0');
  const source = {
    id, ...page, links: undefined, family: family ?? id, syndicated: Boolean(family),
    ...classification, ...meta,
  };
  delete source.links;
  run.sources.push(source);
  return {status: 'added', source};
}

/** Independent origin families among a set of sources (PRD §3.5 — syndication counts once). */
export const families = sources => new Set(sources.map(source => source.family)).size;

const ttlFor = claim => {
  if (claim.signalType === 'hiring') return TIMING_TTL_DAYS.hiring;
  if (claim.signalType === 'product_launch' || claim.signalType === 'funding') return TIMING_TTL_DAYS.product;
  if (claim.angle === 'timing') return TIMING_TTL_DAYS.event;
  if (claim.angle === 'economics') return TIMING_TTL_DAYS.pricing * 6;
  return TIMING_TTL_DAYS.registration * 2;
};

/**
 * Admit model-extracted claims into the ledger only when the quote is literally present in the
 * retained source. Everything else is kept as a rejected extraction for audit, never scored.
 */
export function admitClaims(run, extracted, {asOf = new Date().toISOString(), analyst = 'extractor'} = {}) {
  run.claims ??= [];
  run.rejectedExtractions ??= [];
  const segments = new Set((run.segments ?? []).map(segment => segment.id));
  let admitted = 0;
  for (const raw of extracted ?? []) {
    const source = run.sources.find(item => item.id === raw.sourceId);
    const reason = !source ? 'unknown source' : !quoteIn(source.excerpt, raw.quote) ? 'quote not found in source' :
      raw.segmentId !== 'general' && !segments.has(raw.segmentId) ? 'unknown segment' : null;
    if (reason) { run.rejectedExtractions.push({...raw, reason}); continue; }
    const duplicate = run.claims.find(claim => claim.sourceId === raw.sourceId && claim.segmentId === raw.segmentId &&
      normalizeText(claim.quote).toLowerCase() === normalizeText(raw.quote).toLowerCase() && claim.direction === raw.direction);
    if (duplicate) continue;
    const stale = Boolean(source.published && daysBetween(source.published, asOf) > ttlFor(raw));
    run.claims.push({
      id: 'C' + String(run.claims.length + 1).padStart(4, '0'), segmentId: raw.segmentId, angle: raw.angle,
      direction: raw.direction, statement: normalizeText(raw.statement).slice(0, 400), quote: normalizeText(raw.quote).slice(0, 400),
      sourceId: source.id, sourceUrl: source.url, family: source.family, tier: source.tier,
      interestedParty: Boolean(raw.interestedParty || source.interestedParty), signalType: raw.signalType ?? 'none',
      stale, epistemic: 'observed', verification: null, analyst, observedAt: source.observed, published: source.published,
    });
    admitted++;
  }
  return admitted;
}

/** Apply independent verifier verdicts, then derive corroboration and contradiction labels. */
export function applyVerification(run, checks, verifierId = 'verifier') {
  const byId = new Map((checks ?? []).map(check => [check.claimId, check]));
  for (const claim of run.claims ?? []) {
    const check = byId.get(claim.id);
    if (!check) continue;
    claim.verification = {verdict: check.verdict, reason: check.reason, by: verifierId};
    claim.epistemic = check.verdict === 'supported' ? 'verified' : check.verdict === 'overstated' ? 'inferred' :
      check.verdict === 'promotional' ? 'observed' : 'unresolved';
    if (check.verdict === 'promotional') claim.interestedParty = true;
  }
  labelCorroboration(run);
}

export function labelCorroboration(run) {
  const groups = new Map();
  for (const claim of run.claims ?? []) {
    if (!['verified', 'corroborated', 'contradicted'].includes(claim.epistemic)) continue;
    const key = claim.segmentId + '|' + claim.angle;
    groups.set(key, [...(groups.get(key) ?? []), claim]);
  }
  for (const claims of groups.values()) {
    const support = claims.filter(claim => claim.direction === 'support' && !claim.stale);
    const against = claims.filter(claim => claim.direction !== 'support' && !claim.stale);
    const supportFamilies = new Set(support.filter(claim => !claim.interestedParty).map(claim => claim.family));
    for (const claim of claims) {
      if (support.length && against.length) claim.epistemic = 'contradicted';
      else if (claim.direction === 'support' && supportFamilies.size >= 2 && !claim.interestedParty) claim.epistemic = 'corroborated';
      else claim.epistemic = 'verified';
    }
  }
}

export const isVerified = claim => ['verified', 'corroborated'].includes(claim.epistemic) && !claim.stale;

// ---------------------------------------------------------------- entity resolution (S5, F07)
const SUFFIX = /\b(inc|llc|ltd|limited|pvt|private|corp|corporation|co|gmbh|plc|technologies|technology|labs|group)\b\.?/g;
const tokens = name => normalizeText(name).toLowerCase().replace(SUFFIX, '').replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(Boolean);
/** Names that could be the same organization: equal after suffix removal, or one is a leading-word prefix of the other. */
export function similarName(a, b) {
  const [x, y] = [tokens(a), tokens(b)];
  if (!x.length || !y.length) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.every((word, index) => long[index] === word);
}
/**
 * Organizations merge only on a shared registrable domain. Same-name records without a domain go to
 * the ambiguity queue instead of being merged — similar names are never sufficient.
 */
export function resolveEntities(run, mentions) {
  run.organizations ??= [];
  run.ambiguities ??= [];
  for (const mention of mentions ?? []) {
    const name = normalizeText(mention.name);
    if (!name || name.length > 120) continue;
    const domain = mention.domain ? rootDomain(mention.domain.startsWith('http') ? mention.domain : 'https://' + mention.domain) : null;
    const existing = domain ? run.organizations.find(org => org.domain === domain) : null;
    if (existing) {
      if (!existing.aliases.includes(name)) existing.aliases.push(name);
      if (!existing.sourceIds.includes(mention.sourceId)) existing.sourceIds.push(mention.sourceId);
      existing.roles = [...new Set([...existing.roles, mention.role])];
      continue;
    }
    const sameName = run.organizations.filter(org => org.aliases.some(alias => similarName(alias, name)));
    if (sameName.length && (!domain || sameName.every(org => org.domain && org.domain !== domain))) {
      run.ambiguities.push({name, domain, sourceId: mention.sourceId, candidates: sameName.map(org => org.id),
        reason: domain ? 'Same name, different domain — not merged' : 'Name match without identifier — not merged'});
      if (!domain) continue;
    }
    run.organizations.push({id: 'O' + shortHash(name + '|' + (domain ?? mention.sourceId)), name, domain, aliases: [name],
      sourceIds: [mention.sourceId], roles: [mention.role], identifier: domain ? 'domain' : 'none'});
  }
}
