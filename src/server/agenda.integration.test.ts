import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from './app.js';
import { DevelopmentIdentityGateway } from './auth.js';
import { configFromEnv, connect, migrate } from './database.js';
import { InstitutionalService } from './service.js';

const actor = (subject:string, displayName:string, owner=false) => ({ subject, displayName, projectAccess:true, owner });

test('Agenda persists meetings, resets confirmations and protects private availability', async () => {
  const db=await connect(configFromEnv(process.env));await migrate(db);await migrate(db);
  const suffix=Date.now();
  const ownerActor=actor(`agenda-owner-${suffix}`,'Owner Agenda',true);
  const directorActor=actor(`agenda-director-${suffix}`,'Diretora Agenda');
  const memberActor=actor(`agenda-member-${suffix}`,'Membro Agenda');
  const guestActor=actor(`agenda-guest-${suffix}`,'Convidada Agenda');
  const ownerApp=buildApp(new InstitutionalService(db),new DevelopmentIdentityGateway(ownerActor));
  const directorId=(await ownerApp.inject({method:'POST',url:'/api/members',payload:{honjiSubject:directorActor.subject,displayName:directorActor.displayName,role:'director'}})).json().id;
  const memberId=(await ownerApp.inject({method:'POST',url:'/api/members',payload:{honjiSubject:memberActor.subject,displayName:memberActor.displayName,role:'member'}})).json().id;
  const guestId=(await ownerApp.inject({method:'POST',url:'/api/members',payload:{honjiSubject:guestActor.subject,displayName:guestActor.displayName,role:'member'}})).json().id;
  const directorApp=buildApp(new InstitutionalService(db),new DevelopmentIdentityGateway(directorActor));
  const memberApp=buildApp(new InstitutionalService(db),new DevelopmentIdentityGateway(memberActor));
  const startsAt='2026-11-16T18:00:00.000Z',endsAt='2026-11-16T19:00:00.000Z';
  const created=await directorApp.inject({method:'POST',url:'/api/meetings',payload:{title:'Reunião reservada',description:'Descrição que não pode vazar',location:'Sala 1',startsAt,endsAt,participantIds:[memberId]}});
  assert.equal(created.statusCode,201,created.body);const meetingId=created.json().id;

  const personal=await memberApp.inject({method:'GET',url:`/api/agenda?scope=personal&from=2026-11-16T00:00:00.000Z&to=2026-11-17T00:00:00.000Z`});
  assert.equal(personal.statusCode,200,personal.body);assert.equal(personal.json()[0].response,'pending');assert.equal(personal.json()[0].description,'Descrição que não pode vazar');
  const options=await directorApp.inject({method:'GET',url:'/api/availability/options'});
  assert.equal(options.statusCode,200,options.body);assert.ok(options.json().some((item:any)=>item.id===guestId));
  assert.equal((await memberApp.inject({method:'GET',url:'/api/availability/options'})).statusCode,403);
  assert.equal((await memberApp.inject({method:'POST',url:`/api/meetings/${meetingId}/response`,payload:{response:'confirmed'}})).statusCode,200);
  assert.equal((await memberApp.inject({method:'POST',url:'/api/meetings',payload:{title:'Sem permissão',startsAt,endsAt,participantIds:[]}})).statusCode,403);
  assert.equal((await memberApp.inject({method:'PATCH',url:`/api/meetings/${meetingId}`,payload:{expectedRevision:1,participantIds:[]}})).statusCode,403);
  const workspaceMeeting=await ownerApp.inject({method:'POST',url:'/api/meetings',payload:{title:'Reunião de espaço',workspaceId:'1a4e0bd0-5f4a-4d10-8000-000000000201',startsAt,endsAt,participantIds:[memberId]}});
  assert.equal(workspaceMeeting.statusCode,201,workspaceMeeting.body);
  assert.equal((await memberApp.inject({method:'GET',url:`/api/agenda?scope=workspace&workspaceId=1a4e0bd0-5f4a-4d10-8000-000000000201&from=2026-11-16T00:00:00.000Z&to=2026-11-17T00:00:00.000Z`})).statusCode,403);

  const availability=await memberApp.inject({method:'POST',url:'/api/availability/me',payload:{kind:'weekly',weekday:1,startTime:'18:00',endTime:'20:00',note:'Aula particular'}});
  assert.equal(availability.statusCode,201,availability.body);const blockId=availability.json().id;
  assert.equal((await ownerApp.inject({method:'PUT',url:`/api/availability/me/${blockId}`,payload:{kind:'weekly',weekday:1,startTime:'19:00',endTime:'20:00'}})).statusCode,403);
  assert.equal((await memberApp.inject({method:'GET',url:`/api/availability/collective?from=${encodeURIComponent(startsAt)}&to=${encodeURIComponent(endsAt)}`})).statusCode,403);

  const collective=await directorApp.inject({method:'GET',url:`/api/availability/collective?from=${encodeURIComponent(startsAt)}&to=${encodeURIComponent(endsAt)}&membershipIds=${memberId}`});
  assert.equal(collective.statusCode,200,collective.body);assert.deepEqual(collective.json(),[{membershipId:memberId,displayName:memberActor.displayName,status:'busy'}]);
  assert.equal(collective.body.includes('Descrição que não pode vazar'),false);assert.equal(collective.body.includes('Aula particular'),false);

  const changed=await directorApp.inject({method:'PATCH',url:`/api/meetings/${meetingId}`,payload:{expectedRevision:1,startsAt:'2026-11-16T19:00:00.000Z',endsAt:'2026-11-16T20:00:00.000Z',participantIds:[memberId]}});
  assert.equal(changed.statusCode,200,changed.body);assert.equal(changed.json().rescheduled,true);assert.equal(changed.json().revision,2);
  assert.equal((await directorApp.inject({method:'PATCH',url:`/api/meetings/${meetingId}`,payload:{expectedRevision:1,title:'Atualização concorrente'}})).statusCode,409);
  const reloadedApp=buildApp(new InstitutionalService(db),new DevelopmentIdentityGateway(memberActor));
  const afterRestart=await reloadedApp.inject({method:'GET',url:'/api/agenda?scope=personal&from=2026-11-16T00:00:00.000Z&to=2026-11-17T00:00:00.000Z'});
  const persistedMeeting=afterRestart.json().find((item:any)=>item.id===meetingId);
  assert.equal(persistedMeeting.response,'pending');
  const notifications=await reloadedApp.inject({method:'GET',url:'/api/agenda/notifications'});
  assert.deepEqual(notifications.json().slice(0,2).map((item:any)=>item.kind),['rescheduled','invited']);
  assert.equal((await directorApp.inject({method:'PATCH',url:`/api/meetings/${meetingId}`,payload:{expectedRevision:2,participantIds:[memberId,guestId]}})).statusCode,200);
  assert.equal((await directorApp.inject({method:'PATCH',url:`/api/meetings/${meetingId}`,payload:{expectedRevision:3,participantIds:[memberId]}})).statusCode,200);
  const guestApp=buildApp(new InstitutionalService(db),new DevelopmentIdentityGateway(guestActor));
  const guestCalendar=await guestApp.inject({method:'GET',url:'/api/agenda?scope=personal&from=2026-11-16T00:00:00.000Z&to=2026-11-17T00:00:00.000Z'});
  assert.equal(guestCalendar.json().some((item:any)=>item.id===meetingId),false);
  assert.equal((await guestApp.inject({method:'GET',url:'/api/agenda/notifications'})).json()[0].kind,'removed');

  await guestApp.close();await reloadedApp.close();await memberApp.close();await directorApp.close();await ownerApp.close();await db.close();
  assert.ok(directorId);
});
