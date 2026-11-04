import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {research} from './lib/research.js';
import {saveRun} from './lib/store.js';
const pilot=JSON.parse(await readFile('foxfoster.json','utf8'));
const run={id:randomUUID(),createdAt:new Date().toISOString(),status:'running',brief:{name:pilot.name,offer:'All six FoxFoster offers',problem:'Find supported customer groups for each offer',website:pilot.website,geography:'Global',model:'mixed',topCount:3,offers:pilot.offers},activity:[],sources:[],cards:[],recommendations:[]};
await saveRun(run);console.log('RUN_ID='+run.id);
try{await research(run);console.log('DONE',run.status,run.sources.length,run.cards.length,run.recommendations.length)}catch(e){run.status='failed';run.error=e.message;await saveRun(run);console.error(e);process.exitCode=1}
