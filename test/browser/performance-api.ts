// Disposable DB only. Counts SQL without logging values or identities.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { agendaFixture } from '../../src/server/agenda-test-fixture.js';
if(process.env.NODE_ENV!=='development'||!process.env.DB_NAME?.startsWith('gabriel_perf12'))throw new Error('Explicit disposable performance database required');
const fixture=await agendaFixture();
const pool=fixture.db.pool;
const query=pool.query.bind(pool),execute=pool.execute.bind(pool);
let queries:string[]=[];
pool.query=((sql:unknown,...args:unknown[])=>{queries.push(String(sql));return (query as Function)(sql,...args);}) as typeof pool.query;
pool.execute=((sql:unknown,...args:unknown[])=>{queries.push(String(sql));return (execute as Function)(sql,...args);}) as typeof pool.execute;
try{
 for(const url of ['/api/foundation','/api/agenda/foundation?from=2026-10-12T00:00:00Z&to=2026-10-19T00:00:00Z&scope=personal','/api/public/catalog']){
  const samples=[];
  for(let i=0;i<5;i++){
   queries=[];const start=performance.now();const response=await fixture.apps.owner.inject({url});
   assert.equal(response.statusCode,200,response.body);
   samples.push({ms:Math.round((performance.now()-start)*100)/100,queries:queries.length,duplicateSql:queries.length-new Set(queries).size,bytes:Buffer.byteLength(response.body)});
  }
  console.log(JSON.stringify({url,samples}));
 }
}finally{await fixture.close();}
