import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './app.js';
import { DevelopmentIdentityGateway } from './auth.js';
import { configFromEnv, connect, migrate } from './database.js';
import { InstitutionalService } from './service.js';
import { KanbanService } from './kanban.js';

const owner = { subject: 'kanban-owner', displayName: 'Kanban Owner', projectAccess: true, owner: true };
const member = { subject: 'kanban-member', displayName: 'Kanban Member', projectAccess: true, owner: false };

test('Kanban persists its vertical flow and hides director cards from members', async () => {
  const db = await connect(configFromEnv(process.env));
  await migrate(db); await migrate(db);
  const ownerApp = buildApp(new InstitutionalService(db), new DevelopmentIdentityGateway(owner));
  const workspaceId = '1a4e0bd0-5f4a-4d10-8000-000000000201';
  const ownerMe = await ownerApp.inject({ method: 'GET', url: '/api/me' });
  assert.equal(ownerMe.statusCode, 200);
  const columnsBefore = await db.many<any>('SELECT c.id,c.name FROM board_columns c JOIN boards b ON b.id=c.board_id WHERE b.workspace_id=? ORDER BY c.position', [workspaceId]);
  assert.deepEqual(columnsBefore.map((column) => column.name), ['Ideias','Planejado','Em andamento','Aguardando','Concluído']);

  let memberId = (await db.one<any>(`SELECT m.id FROM memberships m JOIN people p ON p.id=m.person_id WHERE p.honji_subject=?`, [member.subject]))?.id;
  if (!memberId) {
    const created = await ownerApp.inject({ method:'POST',url:'/api/members',payload:{honjiSubject:member.subject,displayName:member.displayName,role:'member'} });
    assert.equal(created.statusCode,201); memberId=created.json().id;
  }
  await ownerApp.inject({ method:'PATCH',url:`/api/workspaces/${workspaceId}`,payload:{addMembershipId:memberId} });
  const boardId=(await ownerApp.inject({method:'GET',url:`/api/workspaces/${workspaceId}/boards`})).json()[0].id;
  const board=(await ownerApp.inject({method:'GET',url:`/api/boards/${boardId}`})).json();
  const deadline='2026-11-20T12:00:00.000Z';
  const dated=await ownerApp.inject({method:'POST',url:`/api/boards/${boardId}/cards`,payload:{title:'Prazo fictício UX',dueAt:deadline,priority:'high'}});assert.equal(dated.statusCode,201,dated.body);
  const datedId=dated.json().id;assert.equal(new Date((await ownerApp.inject({url:`/api/cards/${datedId}`})).json().dueAt).toISOString(),deadline);
  const editedDeadline='2026-11-21T12:00:00.000Z';
  assert.equal((await ownerApp.inject({method:'PATCH',url:`/api/cards/${datedId}`,payload:{dueAt:editedDeadline}})).statusCode,200);
  assert.equal(new Date((await ownerApp.inject({url:`/api/cards/${datedId}`})).json().dueAt).toISOString(),editedDeadline);
  assert.equal((await ownerApp.inject({method:'PATCH',url:`/api/cards/${datedId}`,payload:{dueAt:null,archived:true}})).statusCode,200);
  const created=await ownerApp.inject({method:'POST',url:`/api/boards/${boardId}/cards`,payload:{title:`Restrito ${Date.now()}`,columnId:board.columns[0].id,visibility:'directors'}});
  assert.equal(created.statusCode,201); const cardId=created.json().id;
  const moved=await ownerApp.inject({method:'POST',url:`/api/cards/${cardId}/move`,payload:{columnId:board.columns[4].id,version:1}});
  assert.equal(moved.statusCode,200);
  assert.ok((await ownerApp.inject({method:'GET',url:`/api/cards/${cardId}`})).json().completedAt);

  const memberApp=buildApp(new InstitutionalService(db),new DevelopmentIdentityGateway(member));
  assert.equal((await memberApp.inject({method:'GET',url:`/api/cards/${cardId}`})).statusCode,404);
  const publicCard=await ownerApp.inject({method:'POST',url:`/api/boards/${boardId}/cards`,payload:{title:`Público ${Date.now()}`,columnId:board.columns[0].id}});
  const publicId=publicCard.json().id;
  assert.equal((await memberApp.inject({method:'POST',url:`/api/cards/${publicId}/helpers/me`})).statusCode,200);
  assert.equal((await memberApp.inject({method:'POST',url:`/api/cards/${publicId}/checklist`,payload:{content:'Validar item'}})).statusCode,201);
  assert.equal((await memberApp.inject({method:'POST',url:`/api/cards/${publicId}/comments`,payload:{body:'Comentário persistido'}})).statusCode,201);
  const detail=(await memberApp.inject({method:'GET',url:`/api/cards/${publicId}`})).json();
  assert.equal(detail.helpers.length,1); assert.equal(detail.checklist.length,1); assert.equal(detail.comments.length,1);
  assert.equal(detail.currentMembershipId,memberId); assert.ok(detail.eligibleParticipants.some((participant:any)=>participant.membershipId===memberId));
  let identityChecks=0;
  const foundationApp=buildApp(new InstitutionalService(db),{current:async()=>{identityChecks+=1;return member;}});
  const foundation=await foundationApp.inject({method:'GET',url:'/api/foundation'});
  assert.equal(foundation.statusCode,200,foundation.body);
  assert.equal(identityChecks,1,'foundation must cross the identity boundary only once');
  assert.ok(foundation.json().workspaces.some((workspace:any)=>workspace.id===workspaceId));
  assert.ok(foundation.json().boards.some((candidate:any)=>candidate.id===boardId));
  await foundationApp.close();
  assert.equal((await memberApp.inject({method:'PATCH',url:`/api/cards/${publicId}`,payload:{visibility:'directors'}})).statusCode,403);
  assert.equal((await memberApp.inject({method:'PATCH',url:`/api/cards/${publicId}`,payload:{priority:'high',dueAt:null,tags:['teste']}})).statusCode,200);
  assert.equal((await memberApp.inject({method:'POST',url:`/api/cards/${publicId}/transfers`,payload:{toMembershipId:'00000000-0000-4000-8000-000000000099'}})).statusCode,403);
  await new KanbanService(db,new InstitutionalService(db)).myTasks(member,{participation:'helper'});
  const tasks=await memberApp.inject({method:'GET',url:'/api/my-tasks?participation=helper'});
  assert.equal(tasks.statusCode,200,tasks.body); assert.ok(tasks.json().some((card:any)=>card.id===publicId));
  const targetSubject='kanban-transfer-target';
  let targetId=(await db.one<any>('SELECT m.id FROM memberships m JOIN people p ON p.id=m.person_id WHERE p.honji_subject=?',[targetSubject]))?.id;
  if(!targetId){const target=await ownerApp.inject({method:'POST',url:'/api/members',payload:{honjiSubject:targetSubject,displayName:'Transfer Target',role:'member'}});targetId=target.json().id;}
  await ownerApp.inject({method:'PATCH',url:`/api/workspaces/${workspaceId}`,payload:{addMembershipId:targetId}});
  const assigned=await ownerApp.inject({method:'POST',url:`/api/boards/${boardId}/cards`,payload:{title:`Transferência ${Date.now()}`,columnId:board.columns[0].id,responsibleMembershipId:memberId}});
  assert.equal((await memberApp.inject({method:'POST',url:`/api/cards/${assigned.json().id}/transfers`,payload:{toMembershipId:'00000000-0000-4000-8000-000000000099'}})).statusCode,409);
  const transfer=await memberApp.inject({method:'POST',url:`/api/cards/${assigned.json().id}/transfers`,payload:{toMembershipId:targetId}});
  assert.equal(transfer.statusCode,201); assert.equal(transfer.json().immediate,false);
  const targetApp=buildApp(new InstitutionalService(db),new DevelopmentIdentityGateway({subject:targetSubject,displayName:'Transfer Target',projectAccess:true,owner:false}));
  assert.equal((await targetApp.inject({method:'POST',url:`/api/transfers/${transfer.json().id}/decision`,payload:{decision:'accepted'}})).statusCode,200);
  assert.equal((await targetApp.inject({method:'POST',url:`/api/transfers/${transfer.json().id}/decision`,payload:{decision:'accepted'}})).statusCode,409);
  await targetApp.close();
  await ownerApp.close(); await memberApp.close(); await db.close();
});
