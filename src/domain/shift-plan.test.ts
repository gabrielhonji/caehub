import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weeklyShiftPlan} from './shift-plan';
test('weekly shifts respect weekdays and excluded dates without creating meetings',()=>{
 const input={from:'2026-10-19',to:'2026-10-25',weekdays:[1,2,3,4,5],start:'12:00',end:'14:00',excluded:['2026-10-21']};
 const rows=weeklyShiftPlan(input);assert.equal(rows.length,4);assert.ok(rows.every(row=>Date.parse(row.endsAt)-Date.parse(row.startsAt)===7200000));
 assert.throws(()=>weeklyShiftPlan({...input,end:'11:00'}));assert.throws(()=>weeklyShiftPlan({...input,weekdays:[]}));assert.throws(()=>weeklyShiftPlan({...input,to:'2027-12-01'}));
});
