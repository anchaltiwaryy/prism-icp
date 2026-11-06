import { body, handle, jobs, startJob } from '../../../lib/api.js';
import { accountAction } from '../../../lib/gtm/accounts.js';
import { draftSequence, queueDraft } from '../../../lib/gtm/outreach.js';
import { activeStrategy, decideProposal, generateProposals, measure, recordOutcome, rollbackStrategy } from '../../../lib/learning.js';
import { createLLM } from '../../../lib/llm.js';
import { readCollection, updateCollection } from '../../../lib/store.js';
import { REASON_CODES } from '../../../lib/taxonomy.js';
import { rootDomain } from '../../../lib/util.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    const [accounts, outbox, suppression, learning, metrics, strategy] = await Promise.all([
      readCollection('accounts'), readCollection('outbox'), readCollection('suppression'), readCollection('learning'), measure(), activeStrategy()]);
    const llm = createLLM();
    return {
      accounts: accounts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), outbox, suppression,
      learning: {strategy, proposals: learning.proposals ?? [], changelog: learning.changelog ?? [], metrics},
      jobs: [...jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 10),
      health: {llm: llm.describe(), provider: llm.provider, search: process.env.SEARXNG_URL ? 'SearXNG + public HTML fallbacks' : 'Public HTML search (DuckDuckGo, Bing)',
        ownInbox: Boolean(process.env.PRISM_OWN_INBOX)},
      reasonCodes: REASON_CODES,
    };
  });
}

export async function POST(request) {
  return handle(async () => {
    const input = await body(request);
    if (input.type === 'account') {
      if (input.action === 'draft') return startJob('draft', 'Draft outreach', () => draftSequence(input.accountId));
      if (input.action === 'queue') return queueDraft(input.accountId, input);
      return accountAction(input.accountId, input);
    }
    if (input.type === 'learning') {
      if (input.action === 'propose') return generateProposals();
      if (input.action === 'rollback') return rollbackStrategy(input.actor);
      return decideProposal(input.id, input);
    }
    if (input.type === 'outcome') return recordOutcome(input);
    if (input.type === 'suppress') {
      const domain = rootDomain(String(input.domain ?? '').includes('://') ? input.domain : 'https://' + input.domain);
      if (!domain) throw Object.assign(new Error('Enter a domain'), {status: 400});
      await updateCollection('suppression', list => { if (!list.some(item => item.domain === domain)) list.push({domain, at: new Date().toISOString(), by: input.actor ?? 'human:anonymous'}); });
      return {domain};
    }
    throw Object.assign(new Error('Unknown action type'), {status: 400});
  });
}
