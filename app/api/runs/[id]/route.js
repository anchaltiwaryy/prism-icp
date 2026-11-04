import { NextResponse } from 'next/server';
import { getRun } from '../../../../lib/store';
export const runtime='nodejs';
export async function GET(_request,{params}) { const {id}=await params; const run=await getRun(id); return run?NextResponse.json(run):NextResponse.json({error:'Run not found'},{status:404}); }
