import { NextResponse } from 'next/server';
import { getRun } from '../../../../../lib/store';
export const runtime='nodejs';
export async function GET(_request,{params}) {const {id}=await params;const run=await getRun(id);return run?new NextResponse(JSON.stringify(run,null,2),{headers:{'content-type':'application/json','content-disposition':'attachment; filename="prism-run.json"'}}):NextResponse.json({error:'Run not found'},{status:404});}
