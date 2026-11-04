import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { listRuns, saveRun } from '../../../lib/store';
import { research } from '../../../lib/research';
import pilot from '../../../foxfoster.json' with {type:'json'};
export const runtime = 'nodejs';
export async function GET() { return NextResponse.json(await listRuns()); }
export async function POST(request) {
  const body = await request.json();
  const isPilot=body.pilot==='foxfoster';
  const name=isPilot?pilot.name:String(body.name??'').trim();
  const offer=isPilot?'All six FoxFoster offers':String(body.offer??'').trim();
  const problem=isPilot?'Find evidence-backed customer groups for each offer':String(body.problem??'').trim();
  if (!name || !offer || !problem || name.length>160 || offer.length>160 || problem.length>500) return NextResponse.json({error:'Enter a business, offer, and problem.'},{status:400});
  const run={id:randomUUID(),createdAt:new Date().toISOString(),status:'running',brief:{name,offer,problem,
    website:isPilot?pilot.website:String(body.website??'').trim(),geography:isPilot?'Global':String(body.geography??'Global').trim(),
    model:isPilot?'mixed':['b2b','b2c','mixed'].includes(body.model)?body.model:'b2b',topCount:body.topCount===5?5:3,
    offers:isPilot?pilot.offers:undefined},activity:[{at:new Date().toISOString(),stage:'Start',detail:'Research started'}],sources:[],cards:[],recommendations:[]};
  await saveRun(run);
  research(run).catch(async error=>{run.status='failed';run.error=String(error.message);run.activity.push({at:new Date().toISOString(),stage:'Error',detail:run.error});await saveRun(run)});
  return NextResponse.json({id:run.id},{status:202});
}
