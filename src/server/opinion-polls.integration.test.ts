import assert from 'node:assert/strict';
import test from 'node:test';
import {agendaFixture} from './agenda-test-fixture.js';

test('independent polls persist votes, isolate participants and close without creating meetings',async()=>{
 const f=await agendaFixture();try{
  const input={title:'Escolha fictícia de atividade',description:'Teste sem reunião',participantIds:[f.ids.member,f.ids.director],options:['Oficina','Palestra']};
  assert.equal((await f.apps.member.inject({method:'POST',url:'/api/opinion-polls',payload:input})).statusCode,403);
  assert.equal((await f.apps.owner.inject({method:'POST',url:'/api/opinion-polls',payload:{...input,options:['Repetida','repetida']}})).statusCode,409);
  const created=await f.apps.owner.inject({method:'POST',url:'/api/opinion-polls',payload:input});assert.equal(created.statusCode,201,created.body);const id=created.json().id;
  const own=(await f.apps.member.inject({method:'GET',url:'/api/opinion-polls'})).json().find((p:any)=>p.id===id);assert.ok(own.invited);assert.equal(own.open,true);assert.equal(own.canManage,false);
  assert.ok(!(await f.apps.other.inject({method:'GET',url:'/api/opinion-polls'})).json().some((p:any)=>p.id===id));
  const vote=(app:typeof f.apps.member,optionId:string)=>app.inject({method:'PUT',url:`/api/opinion-polls/${id}/vote`,payload:{optionId}});
  assert.equal((await vote(f.apps.other,own.options[0].id)).statusCode,403);
  assert.equal((await vote(f.apps.member,f.ids.other)).statusCode,409);
  assert.equal((await vote(f.apps.member,own.options[0].id)).statusCode,200);assert.equal((await vote(f.apps.member,own.options[1].id)).statusCode,200);
  const voted=(await f.apps.member.inject({method:'GET',url:'/api/opinion-polls'})).json().find((p:any)=>p.id===id);assert.equal(voted.responseCount,1);assert.equal(voted.options[0].votes,0);assert.equal(voted.options[1].votes,1);
  assert.equal((await f.apps.member.inject({method:'POST',url:`/api/opinion-polls/${id}/close`,payload:{confirmed:true}})).statusCode,403);
  const before=await f.db.one<any>('SELECT COUNT(*) AS n FROM meetings');
  for(let i=0;i<2;i++)assert.equal((await f.apps.owner.inject({method:'POST',url:`/api/opinion-polls/${id}/close`,payload:{confirmed:true}})).statusCode,200);
  assert.equal((await f.db.one<any>('SELECT COUNT(*) AS n FROM meetings'))!.n,before!.n);
  assert.equal((await vote(f.apps.member,own.options[0].id)).statusCode,409);
  const closed=(await f.apps.member.inject({method:'GET',url:'/api/opinion-polls'})).json().find((p:any)=>p.id===id);assert.equal(closed.open,false);assert.ok(closed.closedAt);
 }finally{await f.close();}
});
