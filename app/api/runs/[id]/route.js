import { body, handle, startJob } from '../../../../lib/api.js';
import { findAccounts } from '../../../../lib/gtm/accounts.js';
import { controlRun, createRefreshRun, createRun, effectiveStatus, isActive, startRun } from '../../../../lib/pipeline.js';
import { experimentAction, flagEvidence, reviewIcp, validateIcp } from '../../../../lib/review.js';
import { getRun, saveRun } from '../../../../lib/store.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const notFound = () => { throw Object.assign(new Error('Run not found'), {status: 404}); };

export async function GET(_request, {params}) {
  return handle(async () => {
    const {id} = await params;
    const run = await getRun(id) ?? notFound();
    return {...run, status: effectiveStatus(run), active: isActive(id)};
  });
}

export async function POST(request, {params}) {
  return handle(async () => {
    const {id} = await params;
    const input = await body(request);
    switch (input.type) {
      case 'control': return controlRun(id, input.action);
      case 'refresh': {
        const parent = await getRun(id) ?? notFound();
        if (!parent.sources?.length) throw Object.assign(new Error('Nothing to refresh — this run retained no sources'), {status: 409});
        const run = createRefreshRun(parent, input);
        await saveRun(run);
        startRun(run);
        return {id: run.id};
      }
      case 'deepen': {
        const parent = await getRun(id) ?? notFound();
        const card = parent.cards?.find(item => item.id === input.icpId) ?? notFound();
        const offer = parent.profile.offers.find(item => item.id === card.offerId);
        const run = createRun({name: parent.brief.name, offer: card.offer, problem: offer?.problem ?? card.job, website: parent.brief.website,
          geography: parent.brief.geography, model: parent.brief.model, mode: 'deep', topCount: 3});
        run.parentRunId = parent.id;
        run.brief.offers = [{name: card.offer, problem: offer?.problem ?? card.job, segments: [
          {segment: card.segment, motion: card.motion, user: card.user, buyer: card.buyer},
          ...card.boundaryExamples.slice(0, 2).map(text => ({segment: 'Boundary: ' + text.slice(0, 90), motion: card.motion, user: card.user, buyer: card.buyer})),
        ]}];
        run.brief.referenceUrls = parent.brief.referenceUrls ?? [];
        await saveRun(run);
        startRun(run);
        return {id: run.id};
      }
      case 'review': return reviewIcp(id, input.icpId, input);
      case 'flag': return flagEvidence(id, input);
      case 'experiment': return experimentAction(id, input.experimentId, input);
      case 'validate': return validateIcp(id, input.icpId, input);
      case 'findAccounts': {
        const run = await getRun(id) ?? notFound();
        const card = run.cards?.find(item => item.id === input.icpId) ?? notFound();
        if (card.review?.status !== 'accepted') throw Object.assign(new Error('Accept this ICP before discovering sample accounts'), {status: 409});
        return startJob('accounts', `Sample accounts for ${card.segment}`, () => findAccounts(id, input.icpId, {limit: Math.min(Number(input.limit) || 6, 12)}));
      }
      default: throw Object.assign(new Error('Unknown action type'), {status: 400});
    }
  });
}
