import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { agendaFixture } from './agenda-test-fixture.js';
import { connect, configFromEnv } from './database.js';

test('commercial catalog, ledger, concurrency, authorization and campaign exclusivity',async()=>{
  const f=await agendaFixture();const {apps,db}=f;const initial=(await apps.owner.inject({method:'GET',url:'/api/commercial'})).json();const cat=initial.categories.find((c:any)=>c.name==='Adesivos');const defaultCampaign=(await apps.owner.inject({method:'POST',url:'/api/commercial/campaigns',payload:{name:'Campanha fictícia'}})).json().id;
  const send=async(method:'GET'|'POST'|'PATCH',url:string,payload?:object,as:keyof typeof apps='owner')=>apps[as].inject({method,url,payload});
  const create=async(mode='physical',campaignId?:string)=>{const r=await send('POST','/api/commercial/products',{name:'Adesivo fictício',categoryId:cat.id,costCents:100,saleCents:200,mode,campaignId:campaignId??defaultCampaign,options:[{name:'Modelo',values:['Modelo A','Modelo B']}]});assert.equal(r.statusCode,201,r.body);return r.json().id;};
  try{
    const productId=await create();const catalog=(await send('GET','/api/commercial')).json();const variants=catalog.variants.filter((v:any)=>v.productId===productId);assert.equal(variants.length,2);const v=variants[0],other=variants[1];
    const move=async(kind:string,quantity:number,as:keyof typeof apps='owner')=>send('POST',`/api/commercial/variants/${v.id}/movements`,{kind,quantity,justification:'Conferência fictícia',reference:'TESTE'},as);
    assert.equal((await move('entry',50)).json().balance,50);assert.equal((await move('exit',8)).json().balance,42);assert.equal((await move('exit',43)).statusCode,409);assert.equal((await move('adjustment',3)).json().balance,45);
    let history=(await send('GET',`/api/commercial/variants/${v.id}/movements`)).json();assert.equal(history.length,3);assert.ok(history.every((m:any)=>m.actor===f.actors.owner.displayName&&m.justification&&m.createdAt));assert.deepEqual(history.map((m:any)=>m.quantity).sort((a:number,b:number)=>a-b),[-8,3,50]);
    assert.equal((await send('GET','/api/commercial',undefined,'member')).statusCode,403);assert.equal((await move('entry',1,'member')).statusCode,403);assert.equal((await move('entry',1,'director')).statusCode,403);
    const products=(await f.service.departments()).find(d=>d.name==='Produtos')!;
    assert.equal((await apps.owner.inject({method:'POST',url:`/api/departments/${products.id}/participants`,payload:{membershipId:f.ids.member,kind:'member'}})).statusCode,201);
    assert.equal((await move('entry',1,'member')).statusCode,403);
    assert.equal((await apps.owner.inject({method:'POST',url:`/api/departments/${products.id}/participants`,payload:{membershipId:f.ids.director,kind:'director'}})).statusCode,201);
    assert.equal((await send('GET','/api/commercial',undefined,'director')).statusCode,200);
    const concurrent=await Promise.all([move('exit',30,'director'),move('exit',30,'director')]);assert.deepEqual(concurrent.map(r=>r.statusCode).sort(),[201,409]);
    const state=(await send('GET','/api/commercial')).json();assert.equal(state.variants.find((x:any)=>x.id===v.id).physicalQuantity,15);assert.equal(state.variants.find((x:any)=>x.id===other.id).physicalQuantity,0);
    assert.equal((await move('adjustment',-16)).statusCode,409);
    assert.equal((await send('POST',`/api/commercial/variants/${v.id}/movements`,{kind:'adjustment',quantity:1})).statusCode,400);
    assert.equal((await move('entry',-1)).statusCode,400);assert.equal((await move('entry',1.5)).statusCode,400);
    const p=state.products.find((p:any)=>p.id===productId);const edit={name:p.name,description:p.description,categoryId:p.categoryId,costCents:100,saleCents:1299,status:'archived',version:p.version};
    assert.equal((await send('PATCH',`/api/commercial/products/${productId}`,edit)).statusCode,200);assert.equal((await move('entry',1)).statusCode,409);assert.equal((await send('PATCH',`/api/commercial/products/${productId}`,edit)).statusCode,409);
    const campaigns=[];for(const name of ['Camisetas 2026','Camisetas 2027']){const r=await send('POST','/api/commercial/campaigns',{name});assert.equal(r.statusCode,201);campaigns.push(r.json().id);}
    const preorder=await create('preorder',campaigns[0]);assert.equal((await send('POST',`/api/commercial/products/${preorder}/campaigns`,{campaignId:campaigns[1]})).statusCode,409);
    assert.equal((await send('POST',`/api/commercial/products/${productId}/campaigns`,{campaignId:campaigns[0]})).statusCode,200);assert.equal((await send('POST',`/api/commercial/products/${productId}/campaigns`,{campaignId:campaigns[1]})).statusCode,200);
    const after=(await send('GET','/api/commercial')).json();const pre=after.variants.find((x:any)=>x.productId===preorder);assert.equal(pre.physicalQuantity,0);
    assert.equal((await send('POST',`/api/commercial/variants/${pre.id}/movements`,{kind:'entry',quantity:2,justification:'Sobras físicas recebidas'})).json().balance,2);
    assert.equal((await send('PATCH',`/api/commercial/products/${preorder}`,{...edit,campaignId:campaigns[1]})).statusCode,400);
    assert.equal((await send('POST','/api/commercial/products',{name:'Inválido',sku:p.sku,mode:'physical',variants:[{name:'Única',sku:randomUUID()}]})).statusCode,400);
    assert.equal((await apps.owner.inject({method:'DELETE',url:`/api/commercial/variants/${v.id}/movements`})).statusCode,404);
    const fresh=await connect(configFromEnv(process.env));try{const persisted=await fresh.one<any>('SELECT physical_quantity FROM commercial_variants WHERE id=?',[v.id]);assert.equal(persisted.physical_quantity,15);const ledger=await fresh.one<any>('SELECT SUM(quantity) AS quantity,COUNT(*) AS count FROM commercial_movements WHERE variant_id=?',[v.id]);assert.equal(Number(ledger.quantity),15);assert.equal(ledger.count,4);}finally{await fresh.close();}
    await db.run("UPDATE memberships SET status='suspended' WHERE id=?",[f.ids.director]);assert.equal((await move('entry',1,'director')).statusCode,403);
  }finally{await f.close();}
});
