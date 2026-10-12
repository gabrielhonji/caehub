import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { agendaFixture } from './agenda-test-fixture.js';
import { connect, configFromEnv } from './database.js';
import { OrderService } from './orders.js';

test('orders: central reservations, last-unit concurrency, expiry, manual Pix and immutable prices',async()=>{
  const f=await agendaFixture();const send=(method:any,url:string,payload?:object,as:keyof typeof f.apps='owner')=>f.apps[as].inject({method,url,payload});
  try{
    await f.db.run('UPDATE commercial_operations SET reservation_minutes=NULL');
    const cat=(await send('GET','/api/commercial')).json().categories[0];
    const campaigns:string[]=[];for(const name of ['A fictícia','B fictícia'])campaigns.push((await send('POST','/api/commercial/campaigns',{name})).json().id);
    const p=(await send('POST','/api/commercial/products',{name:'Físico fictício',categoryId:cat.id,costCents:100,saleCents:200,campaignId:campaigns[0],mode:'physical'})).json().id;
    const v=(await send('GET','/api/commercial')).json().variants.find((v:any)=>v.productId===p).id;
    assert.equal((await send('POST',`/api/commercial/products/${p}/campaigns`,{campaignId:campaigns[1]})).statusCode,200);
    assert.equal((await send('POST',`/api/commercial/variants/${v}/movements`,{kind:'entry',quantity:10,justification:'Fixture'})).statusCode,201);
    const body=(quantity:number,campaignId=campaigns[0])=>({campaignId,requestKey:randomUUID(),buyerName:'Comprador fictício',items:[{variantId:v,quantity}]});
    // No implicit operational timeout before an authorized configuration.
    assert.equal((await send('POST','/api/commercial/orders',body(1))).statusCode,409);
    assert.equal((await send('PUT','/api/commercial/settings',{reservationMinutes:60,pixInstructions:'Instrução fictícia, sem chave real'})).statusCode,200);
    const aBody=body(7);const a=await send('POST','/api/commercial/orders',aBody);assert.equal(a.statusCode,201,a.body);const aId=a.json().id;
    assert.equal((await send('POST','/api/commercial/orders',body(5,campaigns[1]))).statusCode,409);
    assert.equal((await send('POST','/api/commercial/orders',aBody)).json().id,aId);
    assert.equal((await send('POST','/api/commercial/orders',{...aBody,items:[{variantId:v,quantity:1}]})).statusCode,409);
    let catalog=(await send('GET','/api/commercial')).json();assert.equal(catalog.variants.find((x:any)=>x.id===v).availableQuantity,3);
    assert.equal((await send('POST',`/api/commercial/variants/${v}/movements`,{kind:'exit',quantity:4,justification:'Não pode consumir reserva'})).statusCode,409);
    assert.equal((await send('POST',`/api/commercial/variants/${v}/movements`,{kind:'adjustment',quantity:-4,justification:'Não pode consumir reserva'})).statusCode,409);
    const act=(id:string,action:string,as:keyof typeof f.apps='owner')=>send('POST',`/api/commercial/orders/${id}/actions`,{action,note:'Conferência fictícia'},as);
    assert.equal((await act(aId,'pay','member')).statusCode,403);assert.equal((await act(aId,'collect')).statusCode,409);
    assert.equal((await act(aId,'cancel')).statusCode,200);assert.equal((await act(aId,'cancel')).statusCode,200);
    assert.equal((await send('GET','/api/commercial')).json().variants.find((x:any)=>x.id===v).availableQuantity,10);
    await send('POST',`/api/commercial/variants/${v}/movements`,{kind:'exit',quantity:9,justification:'Fixture última unidade'});
    const last=await Promise.all([send('POST','/api/commercial/orders',body(1)),send('POST','/api/commercial/orders',body(1,campaigns[1]))]);assert.deepEqual(last.map(r=>r.statusCode).sort(),[201,409]);
    const lastId=last.find(r=>r.statusCode===201)!.json().id;
    await f.db.run('UPDATE commercial_order_items SET expires_at=TIMESTAMPADD(MINUTE,-1,NOW(3)) WHERE order_id=?',[lastId]);
    const other=(await send('POST','/api/commercial/orders',body(1))).json().id;
    assert.equal((await act(lastId,'pay')).statusCode,200);const late=(await send('GET',`/api/commercial/orders/${lastId}`)).json();assert.equal(late.order.status,'review');assert.equal(late.order.payment_status,'paid');
    assert.equal((await act(lastId,'allocate')).statusCode,409);assert.equal((await act(lastId,'ready')).statusCode,409);
    await act(other,'cancel');assert.equal((await act(lastId,'allocate')).statusCode,200);assert.equal((await act(lastId,'allocate')).statusCode,200);
    const product=(await send('GET','/api/commercial')).json().products.find((x:any)=>x.id===p);
    await send('PATCH',`/api/commercial/products/${p}`,{name:product.name,categoryId:cat.id,costCents:100,saleCents:300,status:'active',version:product.version});
    const detail=(await send('GET',`/api/commercial/orders/${lastId}`)).json();assert.equal(Number(detail.order.total_cents),200);assert.equal(detail.items[0].unit_price_cents,200);
    assert.equal((await act(lastId,'pay')).statusCode,200);assert.equal((await act(lastId,'cancel')).statusCode,200);assert.equal((await send('GET',`/api/commercial/orders/${lastId}`)).json().order.payment_status,'refund_required');
    assert.equal((await act(lastId,'refund')).statusCode,200);assert.equal((await act(lastId,'refund')).statusCode,200);
    const events=(await send('GET',`/api/commercial/orders/${lastId}`)).json().events;assert.equal(events.filter((e:any)=>e.action==='payment.confirmed_late').length,1);assert.equal(events.filter((e:any)=>e.action==='reservation.expired').length,1);
    assert.equal((await send('POST','/api/commercial/orders',{...body(1),totalCents:1})).statusCode,400);
  }finally{await f.close();}
});

test('orders: preorder production, partial receipts, physical surplus, idempotent pickup and buyer privacy',async()=>{
  const f=await agendaFixture();const send=(method:any,url:string,payload?:object,as:keyof typeof f.apps='owner')=>f.apps[as].inject({method,url,payload});
  try{
    await send('PUT','/api/commercial/settings',{reservationMinutes:60,pixInstructions:''});
    const campaign=(await send('POST','/api/commercial/campaigns',{name:'Produção fictícia'})).json().id;
    const cat=(await send('GET','/api/commercial')).json().categories[0];const p=(await send('POST','/api/commercial/products',{name:'Encomenda fictícia',categoryId:cat.id,costCents:100,saleCents:200,campaignId:campaign,mode:'preorder'})).json().id;
    const v=(await send('GET','/api/commercial')).json().variants.find((v:any)=>v.productId===p).id;
    const buyer=await f.service.membership(f.actors.member);
    const create=async(quantity:number)=>send('POST','/api/commercial/orders',{campaignId:campaign,requestKey:randomUUID(),buyerPersonId:buyer!.person_id,items:[{variantId:v,quantity}]});
    const order=await create(3);assert.equal(order.statusCode,201,order.body);const id=order.json().id;
    const act=(action:string,as:keyof typeof f.apps='owner')=>send('POST',`/api/commercial/orders/${id}/actions`,{action,note:'Fixture'},as);
    assert.equal((await send('GET',`/api/commercial/orders/${id}`,undefined,'member')).statusCode,200);
    assert.equal((await send('GET',`/api/commercial/orders/${id}`,undefined,'other')).statusCode,404);
    assert.equal((await send('GET','/api/commercial/orders',undefined,'other')).json().orders.length,0);
    assert.equal((await send('GET','/api/commercial/orders',undefined,'member')).json().canManage,false);
    const existing=(await send('GET','/api/commercial')).json().products.find((x:any)=>x.id===p);
    assert.equal((await send('PATCH',`/api/commercial/products/${p}`,{name:'Encomenda renomeada fictícia',categoryId:cat.id,costCents:100,saleCents:200,status:'active',version:existing.version})).statusCode,200);
    const pending=await create(2);assert.equal(pending.statusCode,201);const pendingId=pending.json().id;assert.equal((await act('pay')).statusCode,200);
    const prod=(await send('GET',`/api/commercial/campaigns/${campaign}/production`)).json();assert.equal(prod.variants.length,1);assert.equal(Number(prod.variants[0].paidQuantity),3);assert.equal(Number(prod.variants[0].pendingQuantity),2);
    assert.equal((await send('GET','/api/commercial')).json().variants.find((x:any)=>x.id===v).physicalQuantity,0);
    assert.equal((await act('ready')).statusCode,409);
    assert.equal((await send('POST',`/api/commercial/variants/${v}/movements`,{kind:'entry',quantity:3,justification:'Recebimento exige alocação'})).statusCode,409);
    assert.equal((await send('POST',`/api/commercial/campaigns/${campaign}/production/start`,{variantId:v})).json().count,1);
    assert.equal((await act('cancel')).statusCode,409);
    const c=(await send('GET','/api/commercial')).json().campaigns.find((x:any)=>x.id===campaign);
    const receipt={id:randomUUID(),variantId:v,quantity:2,reference:'Lote fictício parcial'};
    assert.equal((await send('POST',`/api/commercial/campaigns/${campaign}/production/receipts`,receipt)).statusCode,409);
    assert.equal((await send('PATCH',`/api/commercial/campaigns/${campaign}`,{name:c.name,description:c.description,semester:c.semester,stage:'collection',status:'active',version:c.version})).statusCode,200);
    assert.equal((await send('POST','/api/commercial/products',{name:'Encomenda etapa 2',categoryId:cat.id,costCents:100,saleCents:200,campaignId:campaign,mode:'preorder'})).statusCode,409);
    assert.equal((await send('POST',`/api/commercial/campaigns/${campaign}/production/receipts`,receipt, 'member')).statusCode,403);
    const rec=await send('POST',`/api/commercial/campaigns/${campaign}/production/receipts`,receipt);assert.equal(rec.statusCode,201,rec.body);assert.equal(rec.json().allocatedQuantity,2);
    assert.equal((await act('ready')).statusCode,409);
    assert.equal((await create(1)).statusCode,409);
    assert.equal((await send('POST',`/api/commercial/campaigns/${campaign}/production/receipts`,receipt)).statusCode,201);
    assert.equal((await send('POST',`/api/commercial/campaigns/${campaign}/production/receipts`,{...receipt,quantity:10})).statusCode,409);
    const second={...receipt,id:randomUUID(),quantity:3,reference:'Lote fictício final'};
    const result=(await send('POST',`/api/commercial/campaigns/${campaign}/production/receipts`,second)).json();assert.equal(result.allocatedQuantity,1);assert.equal(result.freeQuantity,2);
    let variant=(await send('GET','/api/commercial')).json().variants.find((x:any)=>x.id===v);assert.equal(variant.physicalQuantity,5);assert.equal(variant.reservedQuantity,3);assert.equal(variant.availableQuantity,2);
    const surplus=await create(2);assert.equal(surplus.statusCode,201);assert.equal((await send('GET',`/api/commercial/orders/${surplus.json().id}`)).json().items[0].fulfillment,'stock');
    assert.equal((await act('ready')).statusCode,200);assert.equal((await act('ready')).statusCode,200);
    assert.equal((await send('GET','/api/agenda/notifications',undefined,'member')).json().filter((n:any)=>n.kind==='order_ready').length,1);
    assert.equal((await act('collect','other')).statusCode,403);assert.deepEqual((await Promise.all([act('collect'),act('collect')])).map(r=>r.statusCode),[200,200]);assert.equal((await act('cancel')).statusCode,409);
    variant=(await send('GET','/api/commercial')).json().variants.find((x:any)=>x.id===v);assert.equal(variant.physicalQuantity,2);assert.equal(variant.reservedQuantity,2);
    const ledger=(await send('GET',`/api/commercial/variants/${v}/movements`)).json();assert.equal(ledger.filter((m:any)=>m.kind==='exit').length,1);
    await send('POST',`/api/commercial/orders/${surplus.json().id}/actions`,{action:'cancel',note:'Liberação fictícia'});
    await send('POST',`/api/commercial/orders/${pendingId}/actions`,{action:'pay',note:'Pagamento posterior da encomenda original'});
    assert.equal((await send('POST',`/api/commercial/orders/${pendingId}/actions`,{action:'allocate',note:'Alocar sobras efetivamente recebidas'})).statusCode,200);
    const allocated=(await send('GET',`/api/commercial/orders/${pendingId}`)).json();assert.equal(allocated.items[0].allocated_quantity,2);assert.equal(allocated.items[0].production_status,'received');
    assert.equal((await send('GET',`/api/commercial/variants/${v}/movements`)).json().length,ledger.length);
    const fresh=await connect(configFromEnv(process.env));try{const persisted=await fresh.one<any>('SELECT status,collected_at FROM commercial_orders WHERE id=?',[id]);assert.equal(persisted.status,'completed');assert.ok(persisted.collected_at);const orderService=new OrderService(fresh,f.service);await orderService.reconcile();assert.equal((await fresh.one<any>('SELECT physical_quantity FROM commercial_variants WHERE id=?',[v]))!.physical_quantity,2);}finally{await fresh.close();}
    await f.db.run("UPDATE memberships SET status='suspended' WHERE id=?",[f.ids.member]);assert.equal((await send('GET',`/api/commercial/orders/${id}`,undefined,'member')).statusCode,403);
  }finally{await f.close();}
});
