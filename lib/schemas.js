/**
 * JSON Schemas for every model role. They double as structured-output constraints (Anthropic
 * `output_config.format`, Claude CLI `--json-schema`) and as the contract the deterministic gates read.
 * Only features accepted by structured outputs are used: every object closes with additionalProperties:false.
 */
import { ANGLE_KEYS, ARCHETYPES, RED_TEAM_KEYS } from './taxonomy.js';

const str = (description) => (description ? {type: 'string', description} : {type: 'string'});
const num = (description) => ({type: 'number', description});
const bool = (description) => ({type: 'boolean', description});
const enm = (values, description) => ({type: 'string', enum: values, ...(description ? {description} : {})});
const arr = (items, description) => ({type: 'array', items, ...(description ? {description} : {})});
const obj = (properties) => ({type: 'object', properties, required: Object.keys(properties), additionalProperties: false});

const ORIGIN = enm(['user_declared', 'publicly_observed', 'agent_inferred']);

export const SCHEMAS = {
  intake: obj({
    summary: str('Two sentences describing what the business sells and to whom, without hype.'),
    businessModel: enm(['b2b', 'b2c', 'b2b2c', 'mixed', 'unknown']),
    offers: arr(obj({
      name: str(), category: str(), productOrService: enm(['product', 'service', 'mixed', 'unknown']),
      userJob: str('Job the end user is trying to get done'), buyerJob: str('Job the paying buyer is trying to get done'),
      promisedOutcome: str('Outcome as stated, or "unknown"'), origin: ORIGIN,
      quote: str('Verbatim quote from a supplied page supporting this offer, or empty string'),
      sourceUrl: str('URL of the page the quote came from, or empty string'),
    })),
    facts: arr(obj({statement: str(), origin: ORIGIN, quote: str(), sourceUrl: str()})),
    assumptions: arr(str('Assumption the research is making that the owner should confirm')),
    unknowns: arr(str('Material fact that is not established (pricing, region, capacity…)')),
    geographies: arr(str()),
  }),

  cartographer: obj({
    segments: arr(obj({
      offer: str('Exact offer name'), name: str('Short precise segment name'), archetype: enm(ARCHETYPES),
      motion: str('Buying motion, e.g. direct team purchase, procurement, channel, individual paid, institution sponsored'),
      user: str(), buyer: str('Economic buyer role; say "to verify" when unknown'), influencers: arr(str()),
      job: str('Customer job-to-be-done'), whyPlausible: str(), trigger: str('Event that might create readiness'),
      disqualifiers: arr(str()), searchTerms: arr(str('Industry jargon, alternate buyer labels, regional terms')),
      antiSignals: arr(str('Observable sign this segment is a poor fit')),
      model: enm(['b2b', 'b2c', 'institution']),
    })),
  }),

  extractor: obj({
    claims: arr(obj({
      sourceId: str(), segmentId: str('Segment id this bears on, or "general"'), angle: enm(ANGLE_KEYS),
      direction: enm(['support', 'challenge', 'exclusion']),
      statement: str('One-sentence claim, no more than the quote establishes'),
      quote: str('Exact verbatim substring of the source text, 20-300 characters'),
      interestedParty: bool('True when the source is the vendor or a party promoting itself'),
      signalType: enm(['none', 'product_launch', 'hiring', 'funding', 'regulatory_deadline', 'explicit_procurement',
        'published_rfp', 'customer_confirmed_pain', 'expansion', 'tech_detected']),
    })),
    organizations: arr(obj({
      name: str(), domain: str('Domain if shown on the page, else empty string'), sourceId: str(),
      role: enm(['example_customer', 'competitor', 'partner', 'vendor', 'buyer_example', 'other']),
    })),
  }),

  analyst: obj({
    cards: arr(obj({
      segmentId: str(), definition: str('Precise ICP definition a researcher could apply'),
      hypothesis: str('Falsifiable statement: who, what pain, what would disprove it'),
      job: str(), trigger: str(), structuralFit: arr(str('Observable criterion an account must meet')),
      disqualifiers: arr(str()), boundaryExamples: arr(str('Example just outside the ICP and why it is excluded')),
      buyingGroup: obj({user: str(), champion: str(), economicBuyer: str(), influencers: arr(str()), gates: arr(str())}),
      economics: str('Budget logic; say what is unknown'), channels: arr(str()), positioning: str(),
      evidenceNeeds: arr(str()), supportingClaimIds: arr(str()), counterClaimIds: arr(str()),
    })),
    alternatives: arr(obj({
      name: str(), type: enm(['direct', 'substitute', 'agency', 'in_house', 'status_quo', 'non_consumption', 'free_tool']),
      offer: str(), note: str(), claimIds: arr(str()),
    })),
  }),

  skeptic: obj({
    reviews: arr(obj({
      segmentId: str(),
      tests: arr(obj({
        id: enm(RED_TEAM_KEYS), result: enm(['pass', 'concern', 'fail', 'not_assessed']), note: str(),
        claimIds: arr(str()), sourceId: str('Source id of disconfirming evidence, or empty'),
        quote: str('Verbatim disconfirming quote, or empty'),
      })),
      strongestFor: str(), strongestAgainst: str(), assumptions: arr(str('Falsifiable assumption')),
      falsePositiveCauses: arr(str()), wouldChangeDecision: str(),
      killSwitch: obj({fired: bool(), reason: str(), sourceId: str(), quote: str()}),
      status: enm(['survive', 'revise', 'reject', 'defer']),
    })),
  }),

  verifier: obj({
    checks: arr(obj({
      claimId: str(), verdict: enm(['supported', 'overstated', 'not_supported', 'promotional', 'mismatch']),
      reason: str(),
    })),
  }),

  designer: obj({
    plans: arr(obj({
      segmentId: str(),
      experiments: arr(obj({
        type: enm(['problem_interviews', 'concept_test', 'pricing_conversation', 'channel_response_test', 'pilot', 'partner_trial']),
        hypothesis: str(), sample: str(), recruitingCriteria: arr(str()), script: arr(str('Open, non-leading question')),
        passCriterion: str(), killCriterion: str(), minimumEvidence: str(),
      })),
      leadBrief: obj({
        searchQueries: arr(str()), directories: arr(str('Permitted public directory or association, no personal-data sources')),
        accountCriteria: arr(str()), scoringRules: arr(str()), monitoringSignals: arr(str()), exclusions: arr(str()),
      }),
    })),
  }),

  accountFit: obj({
    organization: str(), whatTheyDo: str(),
    criteria: arr(obj({criterion: str(), status: enm(['met', 'not_met', 'unknown']), quote: str()})),
    disqualifiers: arr(obj({disqualifier: str(), status: enm(['present', 'absent', 'unknown']), quote: str()})),
    signals: arr(obj({type: enm(['product_launch', 'hiring', 'funding', 'expansion', 'regulatory_deadline',
      'explicit_procurement', 'published_rfp', 'customer_confirmed_pain', 'tech_detected', 'other']),
      statement: str(), quote: str()})),
    structuralFit: enm(['likely', 'possible', 'unlikely', 'unknown']),
    hook: str('One factual, quoted observation a seller could reference, or empty'),
  }),

  outreach: obj({
    steps: arr(obj({
      step: num('1, 2 or 3'), subject: str(),
      lines: arr(obj({
        text: str(), tag: enm(['ACCOUNT', 'OFFER', 'GENERATED']),
        claimIds: arr(str('Claim ids backing an ACCOUNT or OFFER line; empty for GENERATED')),
      })),
    })),
  }),
};
