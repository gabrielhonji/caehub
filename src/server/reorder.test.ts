import test from 'node:test';
import assert from 'node:assert/strict';
import {planRepeatOrder} from '../domain/reorder.js';
import type {OrderDetail,SaleCatalog} from '../services/commercial-orders.js';
const catalog={campaigns:[{id:'campaign',status:'active',stage:'orders'}],products:[{id:'stock',name:'Caneca',status:'active',mode:'physical',saleCents:600},{id:'preorder',name:'Camiseta',status:'active',mode:'preorder',campaignId:'campaign',saleCents:1000}],variants:[{id:'cup',productId:'stock',status:'active',availableQuantity:2},{id:'shirt',productId:'preorder',status:'active',availableQuantity:0}],links:[{campaignId:'campaign',productId:'stock'},{campaignId:'campaign',productId:'preorder'}]} as unknown as SaleCatalog;
const detail={order:{status:'expired'},items:[{variant_id:'cup',product_name:'Caneca',variant_name:'Única',quantity:3,unit_price_cents:500,fulfillment:'stock'},{variant_id:'shirt',product_name:'Camiseta',variant_name:'M',quantity:1,unit_price_cents:1000,fulfillment:'preorder'},{variant_id:'gone',product_name:'Antigo',variant_name:'Única',quantity:1,unit_price_cents:100,fulfillment:'stock'}]} as unknown as OrderDetail;
test('repeat expired order preserves available quantities and explains removed items and new prices',()=>{
 const plan=planRepeatOrder(detail,'campaign',catalog);
 assert.deepEqual(plan.items,[{variantId:'cup',quantity:'2'},{variantId:'shirt',quantity:'1'}]);
 assert.equal(plan.changes.length,3);assert.match(plan.changes.map(c=>c.reason).join(' '),/2 de 3/);assert.match(plan.changes.map(c=>c.reason).join(' '),/preço mudou/);
 const collection=planRepeatOrder(detail,'campaign',{...catalog,campaigns:catalog.campaigns.map(c=>({...c,stage:'collection'}))});
 assert.deepEqual(collection.items,[{variantId:'cup',quantity:'2'}]);assert.match(collection.changes.map(c=>c.reason).join(' '),/Encomendas encerradas/);
});
test('repeat cannot prepare a closed campaign, active order or empty stock',()=>{
 assert.equal(planRepeatOrder(detail,'campaign',{...catalog,campaigns:[]}).items.length,0);
 assert.ok(planRepeatOrder({...detail,order:{...detail.order,status:'pending'}},'campaign',catalog).blocker);
 const empty=planRepeatOrder(detail,'campaign',{...catalog,products:catalog.products.filter(p=>p.id==='stock'),variants:catalog.variants.map(v=>({...v,availableQuantity:0}))});assert.equal(empty.items.length,0);
});
