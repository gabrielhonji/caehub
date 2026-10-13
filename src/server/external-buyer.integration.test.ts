import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { agendaFixture } from './agenda-test-fixture.js';
import { buildApp } from './app.js';
import { DevelopmentIdentityGateway } from './auth.js';

test('external buyers require verified academic access, own their orders and never acquire institutional membership',async()=>{
  const f=await agendaFixture();
  const external={subject:randomUUID(),displayName:'Comprador externo fictício',projectAccess:false,accountAccess:true,buyerAccess:false,owner:false};
  const peer={...external,subject:randomUUID(),buyerAccess:true};
  const app=buildApp(f.service,new DevelopmentIdentityGateway(external)),other=buildApp(f.service,new DevelopmentIdentityGateway(peer));
  const send=(method:string,url:string,payload?:any)=>f.apps.owner.inject({method:method as never,url,payload});
  try{
    const category=(await send('GET','/api/commercial')).json().categories[0].id;
    const campaign=(await send('POST','/api/commercial/campaigns',{name:'Compra acadêmica fictícia'})).json().id;
    const product=(await send('POST','/api/commercial/products',{name:'Produto fictício',categoryId:category,mode:'preorder',campaignId:campaign,costCents:123,saleCents:600})).json().id;
    const variant=(await send('GET','/api/commercial')).json().variants.find((v:any)=>v.productId===product).id;
    const input={campaignId:campaign,requestKey:randomUUID(),items:[{variantId:variant,quantity:2,expectedPriceCents:600}]};
    assert.equal((await app.inject('/api/me')).json().membership,null);
    assert.deepEqual((await app.inject('/api/public/buyer-status')).json(),{canBuy:false,authenticated:true,requiresStudentEmail:true});
    assert.equal((await app.inject({method:'POST',url:'/api/commercial/my-orders',payload:input})).statusCode,403);
    external.buyerAccess=true;
    assert.deepEqual((await app.inject('/api/public/buyer-status')).json(),{canBuy:true});
    const response=await app.inject({method:'POST',url:'/api/commercial/my-orders',payload:input});assert.equal(response.statusCode,201,response.body);
    assert.equal((await app.inject({method:'POST',url:'/api/commercial/my-orders',payload:input})).json().id,response.json().id);
    const detail=await app.inject(`/api/commercial/my-orders/${response.json().id}`);assert.equal(detail.statusCode,200);
    assert.equal(detail.json().order.total_cents,1200);assert.deepEqual(detail.json().availableActions,[]);assert.ok(!detail.body.includes('buyer_person_id'));assert.ok(!detail.body.includes('cost_cents'));
    assert.equal((await other.inject(`/api/commercial/my-orders/${response.json().id}`)).statusCode,404);
    assert.equal((await other.inject('/api/commercial/my-orders')).json().orders.length,0);
    for(const path of ['/api/foundation','/api/agenda','/api/commercial','/api/commercial/orders','/api/commercial/buyers','/api/members','/api/workspaces'])assert.equal((await app.inject(path)).statusCode,403,path);
    assert.equal((await app.inject({method:'POST',url:'/api/commercial/my-orders',payload:{...input,emailVerified:true,role:'president'}})).statusCode,400);
    external.displayName='Outro nome fictício';await app.inject('/api/public/buyer-status');
    assert.equal((await f.db.one<any>('SELECT COUNT(*) AS count FROM people WHERE honji_subject=?',[external.subject])).count,1);
    assert.equal(await f.service.membership(external),undefined);
    assert.equal((await app.inject('/api/me')).json().institutionalAccess,false);
    external.buyerAccess=false;assert.equal((await app.inject(`/api/commercial/my-orders/${response.json().id}`)).statusCode,403);
  }finally{await app.close();await other.close();await f.close();}
});
