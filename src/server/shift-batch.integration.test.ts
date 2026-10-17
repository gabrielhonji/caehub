import type {ShiftInput} from './shifts.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {agendaFixture} from './agenda-test-fixture.js';
import {shiftPlan} from '../domain/shift-plan.js';
import {academicTerm} from '../domain/academic-term.js';

test('event shifts respect breaks, create atomically and deduplicate retries',async()=>{
 const f=await agendaFixture();try{
  const rows=shiftPlan({date:'2026-11-23',start:'08:00',minutes:240,count:3,breakStart:'12:00',breakEnd:'14:00'});assert.equal(rows.length,3);assert.equal(Date.parse(rows[1].startsAt)-Date.parse(rows[0].endsAt),2*3600000);
  const shifts:ShiftInput[]=rows.map((row,i)=>({...row,title:`Mostra fictícia · ${i}`,workspaceId:'1a4e0bd0-5f4a-4d10-8000-000000000201',maximumCapacity:2}));const requestKey=randomUUID();
  const create=(app:typeof f.apps.owner,key=requestKey,input=shifts)=>app.inject({method:'POST',url:'/api/shifts/batch',payload:{requestKey:key,shifts:input}});
  assert.equal((await create(f.apps.member)).statusCode,403);
  const responses=await Promise.all([create(f.apps.owner),create(f.apps.owner)]);for(const r of responses)assert.equal(r.statusCode,201,r.body);assert.deepEqual(responses[0].json(),responses[1].json());assert.equal(responses[0].json().ids.length,3);
  const [first]=responses[0].json().ids;assert.equal((await f.db.one<any>('SELECT maximum_capacity FROM agenda_shifts WHERE id=?',[first]))!.maximum_capacity,2);
  const before=(await f.db.one<any>('SELECT COUNT(*) AS n FROM agenda_shifts'))!.n;
  assert.equal((await create(f.apps.owner,randomUUID(),[shifts[0],{...shifts[1],relatedMeetingId:randomUUID()}])).statusCode,409);assert.equal((await f.db.one<any>('SELECT COUNT(*) AS n FROM agenda_shifts'))!.n,before);
  assert.equal((await create(f.apps.owner,requestKey,[{...shifts[0],title:'Outro'}])).statusCode,409);
  assert.throws(()=>shiftPlan({date:'2026-11-23',start:'08:00',minutes:240,count:3,breakStart:'14:00',breakEnd:'12:00'}));
  const term=academicTerm(new Date('2026-10-17T12:00:00'));assert.equal(term.term,'2026/2');assert.equal(term.validFrom,'2026-08-18');assert.equal(term.validTo,'2026-12-19');assert.equal(term.verified,true);assert.equal(academicTerm(new Date('2027-02-01T12:00:00')).verified,false);
 }finally{await f.close();}
});
