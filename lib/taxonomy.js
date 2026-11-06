/**
 * Research taxonomy (PRD §6), rubric (§10), red-team tests (§8), evidence vocabulary (§3, §9) and
 * feedback reason codes (§15). Everything other modules need to speak the same language.
 */

// PRD §6 research clusters. `dimension` maps the angle onto the §10.1 scoring rubric (null = context only).
export const ANGLES = {
  pain:        {label: 'Demand and pain',            dimension: 'pain',      priority: 1,
    pro: ['problem', 'struggle with', 'challenges', 'pain points'], anti: ['not a priority', 'overrated', 'do not need']},
  roles:       {label: 'Users vs buyers',             dimension: 'economics', priority: 1,
    pro: ['who is responsible for', 'job description', 'head of'], anti: ['no budget authority', 'approval process']},
  economics:   {label: 'Ability and willingness to pay', dimension: 'economics', priority: 1,
    pro: ['pricing', 'budget', 'cost of', 'tender'], anti: ['too expensive', 'free alternative', 'budget cuts']},
  competition: {label: 'Competition and substitutes', dimension: 'advantage', priority: 1,
    pro: ['alternatives', 'vs', 'competitors'], anti: ['in-house', 'open source', 'free tool']},
  risks:       {label: 'Risks and exclusions',        dimension: null,        priority: 1,
    pro: ['requirements', 'compliance'], anti: ['not allowed', 'restrictions', 'why we stopped']},
  timing:      {label: 'Timing and triggers',          dimension: 'timing',    priority: 2,
    pro: ['deadline', 'new regulation', 'launch', 'hiring'], anti: ['delayed', 'postponed']},
  reach:       {label: 'Reachability',                 dimension: 'reach',     priority: 2,
    pro: ['association', 'community', 'conference', 'directory'], anti: ['hard to reach']},
  friction:    {label: 'Adoption friction',            dimension: 'fit',       priority: 2,
    pro: ['integration', 'implementation', 'onboarding'], anti: ['switching costs', 'security review', 'migration problems']},
  identity:    {label: 'Customer identity',            dimension: null,        priority: 2,
    pro: ['companies', 'organizations', 'list of'], anti: []},
  fit:         {label: 'Strategic fit and delivery',   dimension: 'delivery',  priority: 3,
    pro: ['case study', 'delivered', 'customers'], anti: ['failed project', 'churn']},
  technographic: {label: 'Technographic context',      dimension: 'fit',       priority: 3,
    pro: ['API', 'platform', 'stack'], anti: []},
  structure:   {label: 'Market structure',             dimension: null,        priority: 3,
    pro: ['number of', 'market', 'industry report'], anti: ['consolidation', 'declining']},
  macro:       {label: 'Macro and regional',           dimension: null,        priority: 3,
    pro: ['regulation', 'government', 'statistics'], anti: []},
  adjacency:   {label: 'Underexplored adjacencies',    dimension: null,        priority: 3,
    pro: ['partners', 'resellers', 'ecosystem'], anti: []},
};
export const ANGLE_KEYS = Object.keys(ANGLES);

// PRD §6 mandatory cross-cuts — recorded on the coverage matrix so skipped cuts are visible.
export const CROSS_CUTS = [
  'historical vs recent', 'small vs large organizations', 'incumbent vs new entrant', 'urgent vs latent demand',
  'direct vs channel sale', 'buyer vs user', 'price-sensitive vs value-sensitive', 'positive vs negative evidence',
  'local vs international', 'reachable vs theoretically addressable', 'recurring vs episodic need',
  'regulation-dependent vs voluntary purchase',
];

// PRD §10.1 rubric (weights sum to 100). Strategy versions may override weights via the learning loop.
export const RUBRIC = Object.freeze({
  pain:      {weight: 20, label: 'Pain intensity and frequency'},
  fit:       {weight: 15, label: 'Offer–problem fit'},
  economics: {weight: 15, label: 'Economic buyer and value'},
  reach:     {weight: 10, label: 'Reachability and channel feasibility'},
  timing:    {weight: 10, label: 'Timing / trigger usefulness'},
  delivery:  {weight: 10, label: 'Delivery and repeatability'},
  advantage: {weight: 10, label: 'Competitive advantage'},
  research:  {weight: 10, label: 'Quality of supporting research'},
});

// PRD §8 — the 15 attacks the skeptic must run on every shortlisted segment.
export const RED_TEAM_TESTS = {
  no_pain:             'Do customers actually experience the problem frequently and severely?',
  no_budget:           'Is the end user enthusiastic but unable to authorize purchase?',
  false_signal:        'Is a launch, hiring post, funding event or tech detection wrongly treated as buying intent?',
  substitution:        'Is a free, incumbent, agency or in-house alternative sufficient?',
  inaccessibility:     'Can the segment be reached economically without prohibited data or platforms?',
  economics:           'Do acquisition, servicing, price, procurement and retention make it unattractive?',
  product_mismatch:    'Does the buyer need a different maturity, integration, certification or capability?',
  evidence_bias:       'Are references repeated press releases, affiliate reviews, stale directories or vendor marketing?',
  selection_bias:      'Did queries overrepresent visible online companies or one language/region?',
  category_error:      'Were learners confused with institutional buyers, or users with economic buyers?',
  timing:              'Is the need episodic, closed, already fulfilled or too early?',
  regulation_trust:    'Can this business actually serve the buyer jurisdiction and security requirements?',
  competitor_response: 'Would a scaled incumbent neutralize the differentiation?',
  counterfactual:      'If the named trigger disappeared, would the account still fit?',
  boundary:            'Do the rules distinguish examples just outside the ICP?',
};
export const RED_TEAM_KEYS = Object.keys(RED_TEAM_TESTS);

export const ARCHETYPES = ['vertical', 'company_type', 'buyer_role', 'use_case', 'ecosystem_adjacency',
  'channel_partner', 'lifecycle_event', 'geography', 'substitute_switcher', 'underserved_niche', 'consumer', 'institution'];

export const EPISTEMIC = ['hypothesis', 'observed', 'inferred', 'verified', 'corroborated', 'contradicted', 'unresolved'];
export const GRADES = ['A', 'B', 'C', 'D', 'U'];
export const DECISIONS = ['explore_first', 'conditional_test', 'defer', 'reject'];
export const MATURITY = ['candidate', 'researched', 'evidence_supported', 'field_testing', 'commercially_validated',
  'rejected', 'archived', 'revisit_later'];

// Signals that look like timing but are never purchase intent on their own (PRD §3.3, F08).
export const WEAK_TIMING_SIGNALS = ['product_launch', 'hiring', 'funding', 'tech_detected', 'website_change', 'expansion'];
export const STRONG_SIGNALS = ['explicit_procurement', 'published_rfp', 'regulatory_deadline', 'customer_confirmed_pain'];

// PRD §15.2 feedback reason codes.
export const REASON_CODES = {
  no_need: 'Buyer had no real need', no_authority: 'Contact lacked purchase authority', no_budget: 'No budget available',
  too_small: 'Organization too small', too_large: 'Organization too large / enterprise procurement',
  wrong_vertical: 'Wrong vertical or category', wrong_buyer: 'Wrong buyer role', timing_off: 'Wrong timing',
  already_served: 'Already served by incumbent or in-house', price_mismatch: 'Price mismatch',
  stale_data: 'Stale data', bad_merge: 'Incorrect entity merge', bad_source: 'Unreliable source',
  bad_claim: 'Claim not supported by its quote', useful_discovery: 'Useful non-obvious discovery',
  good_fit: 'Confirmed good fit', other: 'Other',
};

// PRD §9.3 source hierarchy. Tier 5 (model output) is never evidence and never assigned to a page.
export const SOURCE_TIERS = {
  1: 'First-party, registry, filing or public procurement',
  2: 'Industry body, standard, public dataset or study',
  3: 'Independent journalism, review or directory',
  4: 'Forum, community, job ad or event listing',
};

export const TIMING_TTL_DAYS = {product: 180, hiring: 60, event: 90, pricing: 60, registration: 720, default: 365};
