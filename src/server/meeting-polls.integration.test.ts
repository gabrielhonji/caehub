import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { agendaFixture } from './agenda-test-fixture.js';

test('poll authorization, multi-vote, deadline, ties and atomic meeting confirmation',async()=>{
  const f=await agendaFixture();
  try {
    const options=[{startsAt:'2027-03-01T12:00:00Z',endsAt:'2027-03-01T13:00:00Z'},{startsAt:'2027-03-02T12:00:00Z',endsAt:'2027-03-02T13:00:00Z'}];
    const input={title:'Reunião fictícia por votação',participantIds:[f.ids.member,f.ids.other],options};
    assert.equal((await f.apps.member.inject({method:'POST',url:'/api/meeting-polls',payload:input})).statusCode,403);
    assert.equal((await f.apps.director.inject({method:'POST',url:'/api/meeting-polls',payload:{...input,options:[options[0],options[0]]}})).statusCode,409);
    const created=await f.apps.director.inject({method:'POST',url:'/api/meeting-polls',payload:input});assert.equal(created.statusCode,201);
    const id=created.json().id,rows=(await f.apps.member.inject({url:'/api/meeting-polls'})).json(),poll=rows.find((p:any)=>p.id===id),[a,b]=poll.options;
    const vote=(app:typeof f.apps.member,optionIds:string[],noneWorks=false)=>app.inject({method:'PUT',url:`/api/meeting-polls/${id}/vote`,payload:{optionIds,noneWorks}});
    assert.equal((await vote(f.apps.owner,[a.id])).statusCode,403);
    assert.equal((await vote(f.apps.member,[randomUUID()])).statusCode,409);
    assert.equal((await vote(f.apps.member,[a.id,a.id])).statusCode,409);
    assert.equal((await vote(f.apps.member,[a.id],true)).statusCode,409);
    assert.equal((await vote(f.apps.member,[],true)).statusCode,200);
    assert.equal((await f.apps.director.inject({method:'POST',url:`/api/meeting-polls/${id}/close`,payload:{confirmed:true}})).statusCode,409);
    assert.equal((await vote(f.apps.member,[a.id,b.id])).statusCode,200);
    assert.equal((await vote(f.apps.member,[a.id])).statusCode,200);
    assert.equal((await vote(f.apps.other,[b.id])).statusCode,200);
    assert.equal((await f.apps.member.inject({method:'POST',url:`/api/meeting-polls/${id}/close`,payload:{confirmed:true,optionId:a.id}})).statusCode,403);
    assert.equal((await f.apps.director.inject({method:'POST',url:`/api/meeting-polls/${id}/close`,payload:{confirmed:true}})).statusCode,409);
    assert.equal((await f.apps.director.inject({method:'POST',url:`/api/meeting-polls/${id}/close`,payload:{confirmed:false,optionId:a.id}})).statusCode,400);
    const results=await Promise.all([1,2].map(()=>f.apps.director.inject({method:'POST',url:`/api/meeting-polls/${id}/close`,payload:{confirmed:true,optionId:a.id}})));
    assert.deepEqual(results.map(r=>r.statusCode),[200,200]);assert.equal(results[0].json().meetingId,results[1].json().meetingId);
    assert.equal((await vote(f.apps.member,[b.id])).statusCode,409);
    const meetingId=results[0].json().meetingId;
    const response=await f.db.many<any>('SELECT membership_id AS id,response FROM meeting_participants WHERE meeting_id=?',[meetingId]);
    assert.equal(response.find(p=>p.id===f.ids.member).response,'confirmed');assert.equal(response.find(p=>p.id===f.ids.other).response,'pending');
    const calendar=(await f.apps.member.inject({url:'/api/agenda?scope=personal&from=2027-03-01T00:00:00Z&to=2027-03-03T00:00:00Z'})).json();
    assert.equal(calendar.filter((p:any)=>p.id===meetingId).length,1);
    assert.equal((await f.apps.director.inject({method:'PATCH',url:`/api/meetings/${meetingId}`,payload:{expectedRevision:1,participantIds:[f.ids.member,f.ids.other,f.ids.owner]}})).statusCode,200);
    assert.equal((await f.db.one<any>('SELECT response FROM meeting_participants WHERE meeting_id=? AND membership_id=? AND removed_at IS NULL',[meetingId,f.ids.owner]))?.response,'pending');
    assert.equal((await f.apps.director.inject({method:'PATCH',url:`/api/meetings/${meetingId}`,payload:{expectedRevision:2,startsAt:'2027-03-01T14:00:00Z',endsAt:'2027-03-01T15:00:00Z'}})).statusCode,200);
    assert.equal((await f.db.one<any>('SELECT response FROM meeting_participants WHERE meeting_id=? AND membership_id=? AND removed_at IS NULL',[meetingId,f.ids.member]))?.response,'pending');
    const expired=(await f.apps.director.inject({method:'POST',url:'/api/meeting-polls',payload:{...input,deadline:'2020-01-01T00:00:00Z'}})).json().id;
    assert.equal((await f.apps.member.inject({method:'PUT',url:`/api/meeting-polls/${expired}/vote`,payload:{optionIds:[],noneWorks:true}})).statusCode,409);
    const persisted=(await f.apps.director.inject({url:'/api/meeting-polls'})).json().find((p:any)=>p.id===id);assert.equal(persisted.meetingId,meetingId);
  }finally {await f.close();}
});
