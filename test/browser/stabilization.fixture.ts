import {agendaFixture} from '../../src/server/agenda-test-fixture.js';

if(process.env.NODE_ENV!=='development')throw new Error('Disposable development fixture only');
const fixture=await agendaFixture();
const workspaceId='1a4e0bd0-5f4a-4d10-8000-000000000201';
const response=await fixture.apps.owner.inject({method:'PATCH',url:`/api/workspaces/${workspaceId}`,payload:{addMembershipId:fixture.ids.member}});
if(response.statusCode!==200)throw new Error('Workspace fixture setup failed');
await fixture.apps.owner.listen({host:'0.0.0.0',port:8080});
console.log('READY: isolated stabilization fixture; fictitious owner and member only.');
