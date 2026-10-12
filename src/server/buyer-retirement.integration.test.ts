import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { agendaFixture } from './agenda-test-fixture.js';

test('collection storefront hides exclusive models; own orders preserve exact quantities and idempotent replays',async()=>{
  const f=await agendaFixture();
  const send=(method:any,url:string,payload?:object,as:keyof typeof f.apps='owner')=>f.apps[as].inject({method,url,payload});
  try{
    const category=(await send('GET','/api/commercial')).json().categories[0].id;
    const campaign=(await send('POST','/api/commercial/campaigns',{name:'Retirada fictícia',semester:'2026.2'})).json().id;
    const model=(await send('POST','/api/commercial/products',{name:'Camiseta exclusiva fictícia',categoryId:category,mode:'preorder',campaignId:campaign,costCents:100,saleCents:200})).json().id;
    const variant=(await send('GET','/api/commercial')).json().variants.find((v:any)=>v.productId===model).id;
    const purchase={campaignId:campaign,requestKey:randomUUID(),items:[{variantId:variant,quantity:3,expectedPriceCents:200}]};
    const own=await send('POST','/api/commercial/my-orders',purchase,'member');assert.equal(own.statusCode,201,own.body);const id=own.json().id;
    const other=await send('POST','/api/commercial/my-orders',{...purchase,requestKey:randomUUID(),items:[{variantId:variant,quantity:7,expectedPriceCents:200}]},'other');assert.equal(other.statusCode,201);
    const c=(await send('GET','/api/commercial')).json().campaigns.find((c:any)=>c.id===campaign);
    await send('PATCH',`/api/commercial/campaigns/${campaign}`,{name:c.name,description:c.description,semester:c.semester,stage:'collection',status:'active',version:c.version});
    const d=(await send('GET',`/api/commercial/orders/${id}`)).json();await send('POST',`/api/commercial/orders/${id}/actions`,{action:'pay',note:'Somente fixture',version:d.order.version,requestKey:randomUUID()});
    const received=await send('POST',`/api/commercial/campaigns/${campaign}/production/receipts`,{id:randomUUID(),variantId:variant,quantity:12,reference:'Lote fictício com sobras'});assert.equal(received.statusCode,201,received.body);
    const catalog=(await send('GET','/api/commercial/shop',undefined,'member')).json();assert.ok(!catalog.products.some((p:any)=>p.id===model));assert.ok(!catalog.variants.some((v:any)=>v.id===variant));assert.ok(!catalog.links.some((l:any)=>l.productId===model));
    // Reject a direct request even though this exclusive model has free physical units.
    const refused=await send('POST','/api/commercial/my-orders',{...purchase,requestKey:randomUUID()},'member');assert.equal(refused.statusCode,409);assert.match(refused.json().message,/encomendas encerraram/);
    const replay=await send('POST','/api/commercial/my-orders',purchase,'member');assert.equal(replay.statusCode,201);assert.equal(replay.json().id,id);
    const mine=(await send('GET',`/api/commercial/my-orders?campaignId=${campaign}` ,undefined,'member')).json();assert.equal(mine.total,1);assert.equal(mine.orders[0].items[0].quantity,3);assert.equal(mine.orders[0].items[0].productName,'Camiseta exclusiva fictícia');assert.equal(mine.orders[0].items[0].allocatedQuantity,3);assert.ok(!JSON.stringify(mine).includes(other.json().id));assert.ok(!JSON.stringify(mine).includes('cost'));assert.ok(!JSON.stringify(mine).includes('buyerContact'));
    assert.equal((await send('GET',`/api/commercial/my-orders/${id}`,undefined,'other')).statusCode,404);
    const otherList=(await send('GET',`/api/commercial/my-orders?campaignId=${campaign}`,undefined,'other')).json();assert.equal(otherList.orders[0].items[0].quantity,7);
    const action=async(action:string)=>{const d=(await send('GET',`/api/commercial/orders/${id}`)).json();return send('POST',`/api/commercial/orders/${id}/actions`,{action,note:'Fixture de retirada',version:d.order.version,requestKey:randomUUID()});};
    assert.equal((await action('ready')).statusCode,200);assert.equal((await send('GET',`/api/commercial/my-orders?campaignId=${campaign}`,undefined,'member')).json().orders[0].deliveryStatus,'ready');
    assert.equal((await action('collect')).statusCode,200);const collected=(await send('GET',`/api/commercial/my-orders?campaignId=${campaign}`,undefined,'member')).json().orders[0];assert.equal(collected.deliveryStatus,'collected');assert.equal(collected.items[0].quantity,3);
    const admin=(await send('GET','/api/commercial')).json();assert.ok(admin.products.some((p:any)=>p.id===model));
  }finally{await f.close();}
});
