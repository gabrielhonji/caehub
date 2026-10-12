import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { agendaFixture } from './agenda-test-fixture.js';
import { buildApp } from './app.js';

test('public portal projects sale fields only, shares inventory and preserves buyer authorization',async()=>{
  const f=await agendaFixture();
  const anonymous=buildApp(f.service,{current:async()=>undefined});
  const outside=buildApp(f.service,{current:async()=>({subject:randomUUID(),displayName:'Externo fictício',projectAccess:true,owner:false})});
  const send=(method:any,url:string,payload?:object)=>f.apps.owner.inject({method,url,payload});
  try{
    assert.equal((await anonymous.inject('/')).statusCode,200);
    assert.deepEqual((await anonymous.inject('/api/public/buyer-status')).json(),{canBuy:false});
    assert.deepEqual((await outside.inject('/api/public/buyer-status')).json(),{canBuy:false});
    assert.deepEqual((await f.apps.member.inject('/api/public/buyer-status')).json(),{canBuy:true});
    for(const path of ['/api/foundation','/api/commercial','/api/commercial/shop','/api/commercial/my-orders','/api/commercial/settings','/api/commercial/buyers'])assert.equal((await anonymous.inject(path)).statusCode,403,path);
    const settings=(await send('GET','/api/commercial/settings')).json();await send('PUT','/api/commercial/settings',{reservationMinutes:60,pixInstructions:'Pix fictício privado de pedido',revision:settings.revision});
    const category=(await send('GET','/api/commercial')).json().categories[0].id;
    const c1=(await send('POST','/api/commercial/campaigns',{name:'Campanha pública fictícia A',semester:'2026.1'})).json().id;
    const c2=(await send('POST','/api/commercial/campaigns',{name:'Campanha pública fictícia B',semester:'2026.2'})).json().id;
    const stock=(await send('POST','/api/commercial/products',{name:'Produto público fictício',description:'Descrição pública',categoryId:category,mode:'physical',campaignId:c1,costCents:123,saleCents:500})).json().id;
    const pre=(await send('POST','/api/commercial/products',{name:'Modelo exclusivo fictício',categoryId:category,mode:'preorder',campaignId:c1,costCents:123,saleCents:600})).json().id;
    const state=(await send('GET','/api/commercial')).json(),variant=state.variants.find((v:any)=>v.productId===stock).id,preVariant=state.variants.find((v:any)=>v.productId===pre).id;
    await send('POST',`/api/commercial/products/${stock}/campaigns`,{campaignId:c2});await send('POST',`/api/commercial/variants/${variant}/movements`,{kind:'entry',quantity:10,justification:'Fixture pública'});
    const response=await anonymous.inject('/api/public/catalog');assert.equal(response.statusCode,200);assert.equal(response.headers['cache-control'],'no-store');const catalog=response.json();
    assert.deepEqual(Object.keys(catalog.products.find((p:any)=>p.id===stock)).sort(),['id','name','description','sku','category','mode','campaignId','saleCents','status'].sort());
    assert.ok(!response.body.includes('cost'));assert.ok(!response.body.includes('buyer'));assert.ok(!response.body.includes('Pix fictício'));assert.ok(!response.body.includes('physicalQuantity'));assert.equal(catalog.links.filter((l:any)=>l.productId===stock).length,2);assert.equal(catalog.links.filter((l:any)=>l.productId===pre).length,1);
    const body={campaignId:c1,requestKey:randomUUID(),items:[{variantId:variant,quantity:2,expectedPriceCents:500}]};
    assert.equal((await anonymous.inject({method:'POST',url:'/api/commercial/my-orders',payload:body})).statusCode,403);
    assert.equal((await outside.inject({method:'POST',url:'/api/commercial/my-orders',payload:body})).statusCode,403);
    const order=await f.apps.member.inject({method:'POST',url:'/api/commercial/my-orders',payload:body});assert.equal(order.statusCode,201,order.body);
    assert.equal((await f.apps.member.inject({method:'POST',url:'/api/commercial/my-orders',payload:body})).json().id,order.json().id);
    assert.equal((await anonymous.inject('/api/public/catalog')).json().variants.find((v:any)=>v.id===variant).availableQuantity,8);
    const detail=(await f.apps.member.inject(`/api/commercial/my-orders/${order.json().id}`)).json();assert.equal(detail.order.payment_status,'pending');assert.equal(detail.order.campaignName,'Campanha pública fictícia A');assert.equal(detail.canManage,false);assert.deepEqual(detail.availableActions,[]);
    assert.equal((await f.apps.other.inject(`/api/commercial/my-orders/${order.json().id}`)).statusCode,404);
    const c=(await send('GET','/api/commercial')).json().campaigns.find((c:any)=>c.id===c1);await send('PATCH',`/api/commercial/campaigns/${c1}`,{name:c.name,description:c.description,semester:c.semester,stage:'collection',status:'active',version:c.version});
    assert.ok((await anonymous.inject('/api/public/catalog')).json().products.some((p:any)=>p.id===pre));
    assert.equal((await f.apps.member.inject({method:'POST',url:'/api/commercial/my-orders',payload:{campaignId:c1,requestKey:randomUUID(),items:[{variantId:preVariant,quantity:1,expectedPriceCents:600}]}})).statusCode,409);
    const p=(await send('GET','/api/commercial')).json().products.find((p:any)=>p.id===stock);await send('PATCH',`/api/commercial/products/${stock}`,{name:p.name,categoryId:category,costCents:123,saleCents:500,status:'archived',version:p.version});
    const archived=(await anonymous.inject('/api/public/catalog')).json();assert.ok(!archived.products.some((p:any)=>p.id===stock));assert.ok(!archived.variants.some((v:any)=>v.id===variant));
    await f.db.run("UPDATE memberships SET status='suspended' WHERE id=?",[f.ids.member]);assert.deepEqual((await f.apps.member.inject('/api/public/buyer-status')).json(),{canBuy:false});
  }finally{await anonymous.close();await outside.close();await f.close();}
});
