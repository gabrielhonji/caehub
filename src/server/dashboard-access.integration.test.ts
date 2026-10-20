import test from 'node:test';
import assert from 'node:assert/strict';
import {agendaFixture} from './agenda-test-fixture';
test('dashboard access is configured server-side without granting commercial management',async()=>{
 const f=await agendaFixture();let original:string[]|undefined;try{
 const department='1a4e0bd0-5f4a-4d10-8000-000000000104';
 await f.service.joinDepartment(f.actors.owner,department,f.ids.member,'member');
 const read=()=>f.apps.member.inject({url:'/api/commercial/analytics'});
 assert.equal((await read()).statusCode,403);
 const config=(await f.apps.owner.inject({url:'/api/commercial/dashboard-access'})).json();original=config.departmentIds;
 const update=(app:typeof f.apps.owner,ids:string[],revision=config.revision)=>app.inject({method:'PUT',url:'/api/commercial/dashboard-access',payload:{departmentIds:ids,revision}});
 assert.equal((await update(f.apps.member,[department])).statusCode,403);
 assert.equal((await update(f.apps.owner,['ffffffff-ffff-4fff-8fff-ffffffffffff'])).statusCode,409);
 assert.equal((await update(f.apps.owner,[department])).statusCode,200);
 assert.equal((await read()).statusCode,200);
 assert.equal((await read()).json().canEdit,false);
 assert.equal((await f.apps.member.inject({url:'/api/commercial'})).statusCode,403);
 assert.equal((await f.apps.member.inject({url:'/api/commercial/dashboard-access'})).statusCode,403);
 assert.equal((await update(f.apps.owner,[])).statusCode,409);
 assert.equal((await update(f.apps.owner,[],config.revision+1)).statusCode,200);
 assert.equal((await read()).statusCode,403);
 assert.equal((await f.apps.owner.inject({url:'/api/commercial/analytics'})).statusCode,200);
 }finally{if(original)await f.db.run('UPDATE commercial_dashboard_access SET department_ids=?,revision=revision+1 WHERE organization_id=?',[JSON.stringify(original),'1a4e0bd0-5f4a-4d10-8000-000000000001']);await f.close();}
});
