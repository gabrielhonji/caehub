import assert from 'node:assert/strict';
import test from 'node:test';
import { agendaFixture } from './agenda-test-fixture.js';
import { buildApp } from './app.js';
import { DevelopmentIdentityGateway } from './auth.js';

test('weekly occupancy unions departments and people, protects privacy and persists review requests',async()=>{
  const f=await agendaFixture();try{
    const department=(await f.apps.owner.inject({method:'GET',url:'/api/organization/departments'})).json()[0].id;
    await f.apps.owner.inject({method:'POST',url:`/api/departments/${department}/participants`,payload:{membershipId:f.ids.member}});
    await f.apps.member.inject({method:'POST',url:'/api/availability/me',payload:{kind:'weekly',weekday:1,startTime:'08:00',endTime:'09:00',note:'Nota privada fictícia'}});
    const query=`from=2026-11-02T00:00:00.000Z&to=2026-11-09T00:00:00.000Z&slotMinutes=60&membershipIds=${f.ids.other}&departmentIds=${department}`;
    const grid=await f.apps.director.inject({method:'GET',url:`/api/availability/week?${query}`});assert.equal(grid.statusCode,200,grid.body);
    assert.equal(grid.json().slots.length,168);
    assert.ok(grid.json().members.some((m:any)=>m.membershipId===f.ids.member));assert.ok(grid.json().members.some((m:any)=>m.membershipId===f.ids.other));
    const slot=grid.json().slots.find((slot:any)=>slot.startsAt==='2026-11-02T08:00:00.000Z');
    assert.equal(slot.statuses.find((m:any)=>m.membershipId===f.ids.member).status,'busy');assert.equal(slot.statuses.find((m:any)=>m.membershipId===f.ids.other).status,'unknown');
    assert.equal(grid.body.includes('Nota privada'),false);assert.equal((await f.apps.member.inject({method:'GET',url:`/api/availability/week?${query}`})).statusCode,403);
    const input={title:'Organizando reunião fictícia',from:'2026-11-02T00:00:00.000Z',to:'2026-11-09T00:00:00.000Z',deadline:'2020-01-01T00:00:00.000Z',participantIds:[f.ids.member,f.ids.other]};
    assert.equal((await f.apps.member.inject({method:'POST',url:'/api/availability/requests',payload:input})).statusCode,403);
    const created=await f.apps.director.inject({method:'POST',url:'/api/availability/requests',payload:input});assert.equal(created.statusCode,200,created.body);const id=created.json().id;
    assert.equal((await f.apps.member.inject({method:'POST',url:`/api/availability/requests/${id}/review`,payload:{kind:'unchanged'}})).statusCode,200);
    assert.equal((await f.apps.owner.inject({method:'POST',url:`/api/availability/requests/${id}/review`,payload:{kind:'updated'}})).statusCode,403);
    const list=(await f.apps.director.inject({method:'GET',url:'/api/availability/requests'})).json().find((r:any)=>r.id===id);assert.equal(list.pendingCount,1);assert.equal(list.participants.find((p:any)=>p.membershipId===f.ids.member).reviewKind,'unchanged');
    const own=(await f.apps.member.inject({method:'GET',url:'/api/availability/requests'})).json().find((r:any)=>r.id===id);assert.equal(own.participants.length,1);
    const notice=(await f.apps.member.inject({method:'GET',url:'/api/agenda/notifications'})).json().find((n:any)=>n.resourceId===id);assert.equal(notice.kind,'availability_requested');
    assert.equal((await f.apps.other.inject({method:'POST',url:`/api/agenda/notifications/${notice.id}/read`})).statusCode,404);
    assert.equal((await f.apps.member.inject({method:'POST',url:`/api/agenda/notifications/${notice.id}/read`})).statusCode,200);
    const restart=buildApp(f.service,new DevelopmentIdentityGateway(f.actors.director));try{assert.equal((await restart.inject({method:'GET',url:'/api/availability/requests'})).json().find((r:any)=>r.id===id).pendingCount,1);}finally{await restart.close();}
  }finally{await f.close();}
});
