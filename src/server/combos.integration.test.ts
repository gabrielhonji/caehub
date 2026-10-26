import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {agendaFixture} from './agenda-test-fixture.js';

test('combos freeze one price and reserve mixed components exactly once',async()=>{
  const f=await agendaFixture();
  try{
    const initial=(await f.apps.owner.inject('/api/commercial')).json();
    const settings=(await f.apps.owner.inject('/api/commercial/settings')).json();
    assert.equal((await f.apps.owner.inject({method:'PUT',url:'/api/commercial/settings',payload:{reservationMinutes:60,pixInstructions:'Instrução fictícia',revision:settings.revision}})).statusCode,200);
    const category=initial.categories.find((value:any)=>value.name==='Adesivos');
    const campaign=(await f.apps.owner.inject({method:'POST',url:'/api/commercial/campaigns',payload:{name:'Combo fictício',stage:'orders'}})).json().id;
    const create=async(name:string,mode:'physical'|'preorder')=>{
      const response=await f.apps.owner.inject({method:'POST',url:'/api/commercial/products',payload:{name,categoryId:category.id,costCents:100,saleCents:200,mode,campaignId:campaign,options:[]}});
      assert.equal(response.statusCode,201,response.body);return response.json().id;
    };
    const physical=await create('Caneca fictícia','physical'),preorder=await create('Camiseta fictícia','preorder');
    const catalog=(await f.apps.owner.inject('/api/commercial')).json();
    const physicalVariant=catalog.variants.find((value:any)=>value.productId===physical),preorderVariant=catalog.variants.find((value:any)=>value.productId===preorder);
    assert.equal((await f.apps.owner.inject({method:'POST',url:`/api/commercial/variants/${physicalVariant.id}/movements`,payload:{kind:'entry',quantity:5,justification:'Estoque fictício'}})).statusCode,201);
    const combo=await f.apps.owner.inject({method:'POST',url:'/api/commercial/combos',payload:{campaignId:campaign,name:'Combo misto fictício',pricing:{mode:'manual',priceCents:350},items:[{variantId:physicalVariant.id,quantity:1},{variantId:preorderVariant.id,quantity:1}]}});
    assert.equal(combo.statusCode,201,combo.body);assert.equal(combo.json().baseCents,400);assert.equal(combo.json().priceCents,350);
    const publicCatalog=(await f.apps.member.inject('/api/commercial/shop')).json();assert.equal(publicCatalog.combos.find((value:any)=>value.id===combo.json().id).priceCents,350);
    const order=await f.apps.member.inject({method:'POST',url:'/api/commercial/my-orders',payload:{campaignId:campaign,requestKey:randomUUID(),items:[{comboId:combo.json().id,quantity:2,expectedPriceCents:350}]}});
    assert.equal(order.statusCode,201,order.body);
    const detail=(await f.apps.member.inject(`/api/commercial/my-orders/${order.json().id}`)).json();assert.equal(detail.order.total_cents,700);assert.equal(detail.items.length,2);
    const physicalItem=detail.items.find((value:any)=>value.variant_id===physicalVariant.id),preorderItem=detail.items.find((value:any)=>value.variant_id===preorderVariant.id);
    assert.equal(physicalItem.quantity,2);assert.equal(physicalItem.allocated_quantity,2);assert.equal(preorderItem.quantity,2);assert.equal(preorderItem.allocated_quantity,0);
    assert.equal(Number((await f.db.one<any>('SELECT SUM(allocated_quantity) AS total FROM commercial_order_items WHERE order_id=? AND variant_id=?',[order.json().id,physicalVariant.id]))!.total),2);
  }finally{await f.close();}
});
