import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {agendaFixture} from './agenda-test-fixture.js';

test('human feedback: meeting reasons, organizer projection, archive release, poll alternatives and finance boundaries',async()=>{
 const f=await agendaFixture();try{
 assert.equal((await f.apps.owner.inject({url:'/api/me'})).json().commercialWorkspaceAccess,true);
 assert.equal((await f.apps.member.inject({url:'/api/me'})).json().commercialWorkspaceAccess,false);
 assert.equal((await f.apps.member.inject({url:'/api/commercial'})).statusCode,403);
 const meeting=(await f.apps.director.inject({method:'POST',url:'/api/meetings',payload:{title:'Reunião fictícia UX',startsAt:'2027-02-01T12:00:00Z',endsAt:'2027-02-01T14:00:00Z',participantIds:[f.ids.member,f.ids.other]}})).json();assert.ok(meeting.id);
 const workspace=(await f.apps.owner.inject({url:'/api/workspaces'})).json().find((w:any)=>w.name==='Eventos');
 const restricted=await f.apps.director.inject({method:'POST',url:'/api/meetings',payload:{title:'Reunião restrita fictícia UX',workspaceId:workspace.id,startsAt:'2027-02-03T12:00:00Z',endsAt:'2027-02-03T13:00:00Z',participantIds:[f.ids.owner]}});assert.equal(restricted.statusCode,201,restricted.body);
 assert.equal((await f.apps.member.inject({url:'/api/meetings'})).json().some((m:any)=>m.id===restricted.json().id),false);
 const institutional=await f.apps.director.inject({method:'POST',url:'/api/meetings',payload:{title:'Reunião institucional fictícia UX',startsAt:'2027-02-04T12:00:00Z',endsAt:'2027-02-04T13:00:00Z',participantIds:[f.ids.owner]}});assert.equal(institutional.statusCode,201,institutional.body);
 assert.equal((await f.apps.member.inject({url:'/api/meetings'})).json().some((m:any)=>m.id===institutional.json().id),true);
 const response=(value:object)=>f.apps.member.inject({method:'POST',url:`/api/meetings/${meeting.id}/response`,payload:value});
 assert.equal((await response({response:'maybe'})).statusCode,409);assert.equal((await response({response:'maybe',justification:'Aula fictícia no início.'})).statusCode,200);
 const organized=(await f.apps.director.inject({url:'/api/meetings'})).json().find((m:any)=>m.id===meeting.id);assert.equal(organized.responses.find((p:any)=>p.response==='maybe').justification,'Aula fictícia no início.');
 const own=(await f.apps.member.inject({url:'/api/meetings'})).json().find((m:any)=>m.id===meeting.id);assert.equal(own.responses,undefined);
 assert.equal((await f.apps.member.inject({method:'POST',url:`/api/meetings/${meeting.id}/archive`,payload:{expectedRevision:1}})).statusCode,403);
 assert.equal((await f.apps.director.inject({method:'POST',url:`/api/meetings/${meeting.id}/archive`,payload:{expectedRevision:2}})).statusCode,409);
 const occupancyUrl=`/availability/collective?from=2027-02-01T12:00:00Z&to=2027-02-01T14:00:00Z&membershipIds=${f.ids.member}`;assert.equal((await f.apps.director.inject({url:'/api'+occupancyUrl})).json()[0].status,'busy');
 assert.equal((await f.apps.director.inject({method:'POST',url:`/api/meetings/${meeting.id}/archive`,payload:{expectedRevision:1}})).statusCode,200);assert.equal((await f.apps.director.inject({url:'/api'+occupancyUrl})).json()[0].status,'unknown');
 assert.equal((await f.apps.member.inject({url:'/api/meetings'})).json().some((m:any)=>m.id===meeting.id),false);assert.ok((await f.apps.member.inject({url:'/api/meetings?archived=true'})).json().find((m:any)=>m.id===meeting.id).archivedAt);
 assert.equal((await response({response:'confirmed'})).statusCode,404);
 const options=[{startsAt:'2027-02-02T12:00:00Z',endsAt:'2027-02-02T13:00:00Z'},{startsAt:'2027-02-02T14:00:00Z',endsAt:'2027-02-02T15:00:00Z'}];const created=await f.apps.director.inject({method:'POST',url:'/api/meeting-polls',payload:{title:'Votação fictícia UX',participantIds:[f.ids.member,f.ids.other],options}});assert.equal(created.statusCode,201,created.body);const pollId=created.json().id;
 assert.equal((await f.apps.member.inject({method:'PUT',url:`/api/meeting-polls/${pollId}/vote`,payload:{optionIds:[],noneWorks:true,suggestion:{note:'Sexta seria melhor.',startsAt:'2027-02-05T12:00:00Z',endsAt:'2027-02-05T13:00:00Z'}}})).statusCode,200);
 const poll=(await f.apps.director.inject({url:'/api/meeting-polls'})).json().find((p:any)=>p.id===pollId);assert.equal(poll.participants.find((p:any)=>p.membershipId===f.ids.member).suggestionNote,'Sexta seria melhor.');
 const otherPoll=(await f.apps.other.inject({url:'/api/meeting-polls'})).json().find((p:any)=>p.id===pollId);assert.equal(otherPoll.participants,undefined);assert.equal(otherPoll.suggestionNote,null);
 const campaignId=randomUUID();await f.db.run('INSERT INTO commercial_campaigns (id,organization_id,name) VALUES (?,?,?)',[campaignId,'1a4e0bd0-5f4a-4d10-8000-000000000001','Campanha fictícia UX']);
 assert.equal((await f.apps.member.inject({url:'/api/commercial/analytics?campaignId='+campaignId})).statusCode,403);
 await f.service.joinDepartment(f.actors.owner,'1a4e0bd0-5f4a-4d10-8000-000000000106',f.ids.member,'member');
 const report=await f.apps.member.inject({url:'/api/commercial/analytics?campaignId='+campaignId});assert.equal(report.statusCode,200,report.body);assert.equal(report.json().canEdit,false);assert.equal(report.json().totals.profitCents,null);
 const target={fixedCostCents:10000,revenueGoalCents:30000,costBudgetCents:20000,profitGoalCents:5000,revision:0};
 assert.equal((await f.apps.member.inject({method:'PUT',url:'/api/commercial/analytics/'+campaignId,payload:target})).statusCode,403);
 assert.equal((await f.apps.owner.inject({method:'PUT',url:'/api/commercial/analytics/'+campaignId,payload:target})).statusCode,200);
 assert.equal((await f.apps.owner.inject({method:'PUT',url:'/api/commercial/analytics/'+campaignId,payload:target})).statusCode,409);
 const category=(await f.apps.owner.inject({url:'/api/commercial'})).json().categories.find((c:any)=>c.name==='Adesivos');const product=await f.apps.owner.inject({method:'POST',url:'/api/commercial/products',payload:{name:'Produto fictício UX',categoryId:category.id,costCents:200,saleCents:500,mode:'physical',campaignId,options:category.options}});assert.equal(product.statusCode,201,product.body);
 assert.equal((await f.apps.member.inject({url:'/api/me'})).json().commercialWorkspaceAccess,true);assert.equal((await f.apps.member.inject({url:'/api/commercial'})).statusCode,403);
 const summary=(await f.apps.member.inject({url:'/api/commercial/analytics?campaignId='+campaignId})).json();assert.equal(summary.scenarios.find((s:any)=>s.id===product.json().id).breakEvenUnits,34);assert.equal(summary.scenarios.find((s:any)=>s.id===product.json().id).profitStartsAtUnits,34);

 const catalog=(await f.apps.owner.inject({url:'/api/commercial'})).json(),variant=catalog.variants.find((v:any)=>v.productId===product.json().id),orderId=randomUUID();
 await f.db.run("INSERT INTO commercial_orders (id,campaign_id,buyer_name,buyer_contact,request_key,request_hash,total_cents,payment_status,paid_at) VALUES (?,?,?,?,?,?,?,'paid',NOW(3))",[orderId,campaignId,'Comprador fictício sigiloso','fixture@example.invalid',randomUUID(),'f'.repeat(64),20000]);
 await f.db.run("INSERT INTO commercial_order_items (id,order_id,variant_id,product_name,variant_name,fulfillment,quantity,unit_price_cents,unit_cost_cents) VALUES (?,?,?,?,?,'stock',40,500,200)",[randomUUID(),orderId,variant.id,'Produto fictício UX','Variação fictícia']);
 const result=await f.apps.member.inject({url:'/api/commercial/analytics?campaignId='+campaignId});assert.equal(result.json().totals.revenueCents,20000);assert.equal(result.json().totals.costCents,8000);assert.equal(result.json().totals.profitCents,2000);assert.equal(result.body.includes('Comprador fictício sigiloso'),false);
 await f.db.run('UPDATE commercial_products SET cost_cents=300 WHERE id=?',[product.json().id]);assert.equal((await f.apps.member.inject({url:'/api/commercial/analytics?campaignId='+campaignId})).json().totals.costCents,8000);
 await f.db.run('UPDATE commercial_order_items SET unit_cost_cents=NULL WHERE order_id=?',[orderId]);const incomplete=(await f.apps.member.inject({url:'/api/commercial/analytics?campaignId='+campaignId})).json();assert.equal(incomplete.totals.costCents,null);assert.equal(incomplete.totals.profitCents,null);assert.equal(incomplete.totals.unknownCostUnits,40);
 }finally{await f.close();}
});
