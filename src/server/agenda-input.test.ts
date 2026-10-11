import assert from 'node:assert/strict';
import test from 'node:test';
import {isTime,nextTime,timetableIssues} from '../domain/agenda-input.js';

test('grade confirmation requires metadata, every valid block and explicit review',()=>{
  const valid={term:'Semestre fictício',validFrom:'2026-08-01',validTo:'2026-12-15',reviewed:true,rows:[{weekday:1,startTime:'13:00',endTime:'17:30'}]};
  assert.deepEqual(timetableIssues(valid),[]);
  const incomplete=timetableIssues({...valid,term:' ',validFrom:'',reviewed:false,rows:[{weekday:1,startTime:null,endTime:null}]});
  assert.ok(incomplete.some(i=>i.includes('período letivo')));assert.ok(incomplete.some(i=>i.includes('primeiro dia')));assert.ok(incomplete.some(i=>i.includes('inicial')));assert.ok(incomplete.some(i=>i.includes('final')));assert.ok(incomplete.some(i=>i.includes('conferiu')));
  assert.ok(timetableIssues({...valid,validTo:'2026-07-01'}).some(i=>i.includes('último dia')));
  assert.ok(timetableIssues({...valid,rows:[{weekday:1,startTime:'17:30',endTime:'13:00'}]}).some(i=>i.includes('posterior')));
  assert.ok(timetableIssues({...valid,rows:[{weekday:9,startTime:'13:00',endTime:'17:30'}]}).some(i=>i.includes('dia válido')));
  assert.ok(timetableIssues({...valid,rows:[]}).some(i=>i.includes('bloco')));
});

test('clock bounds preserve precise custom times and never generate an invalid end past midnight',()=>{
  assert.equal(isTime('13:50'),true);assert.equal(isTime('24:00'),false);assert.equal(isTime('13:99'),false);
  assert.equal(nextTime('13:50'),'14:20');assert.equal(nextTime('23:58'),'23:59');assert.equal(nextTime('23:59'),'');assert.equal(nextTime(''),'');
});
