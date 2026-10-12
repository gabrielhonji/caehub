import test from 'node:test';
import assert from 'node:assert/strict';
import {configFromEnv,connect,migrate} from './database.js';
import {InstitutionalService} from './service.js';
import {KanbanService} from './kanban.js';
import {debugProfile} from './debug-profiles.js';
test('department debug profiles use actual department contexts without appearing as real participants',async()=>{
 const db=await connect(configFromEnv(process.env));try{await migrate(db);const service=new InstitutionalService(db),kanban=new KanbanService(db,service);
 for(const [mode,department]of [['events_director','Eventos'],['events_member','Eventos'],['products_member','Produtos']] as const){const profile=debugProfile(mode)!;const actor={subject:profile.subject,displayName:profile.name,owner:false,projectAccess:true};const spaces=await service.listWorkspaces(actor);assert.ok(spaces.length);assert.equal(spaces.every(s=>s.department===department),true);const seedSpace=spaces.find(s=>s.id==='1a4e0bd0-5f4a-4d10-8000-000000000205'||s.id==='1a4e0bd0-5f4a-4d10-8000-000000000204')!;const boards=await kanban.listBoards(actor,seedSpace.id);assert.ok(boards.length);const board=await kanban.board(actor,boards[0].id);assert.equal(board.canManage,mode==='events_director');const participants=await service.workspaceParticipants(seedSpace.id);assert.equal(participants.some(p=>String(p.honjiSubject).startsWith('caehub-debug-')),false);}
 assert.equal(debugProfile('xii_secretary_member')!.access,false);assert.equal(debugProfile('xii_sports_member')!.access,false);
 }finally{await db.close();}
});
