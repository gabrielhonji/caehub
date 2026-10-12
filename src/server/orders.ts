import { createHash, randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { CAECOMP_ORGANIZATION_ID as org, type Database } from './database.js';
import type { Actor } from './domain.js';
import { Conflict, Forbidden, InstitutionalService, NotFound } from './service.js';
import { CommercialService } from './commercial.js';
import { lockCommercial, reserved } from './commercial-inventory.js';
import { notify } from './agenda-common.js';

const purchaseFields={campaignId:z.string().uuid(),requestKey:z.string().uuid(),items:z.array(z.object({variantId:z.string().uuid(),quantity:z.number().int().positive().max(1000000),expectedPriceCents:z.number().int().min(0).max(2147483647).optional()}).strict()).min(1).max(100)};
const uniqueItems=(v:{items:{variantId:string}[]})=>new Set(v.items.map(i=>i.variantId)).size===v.items.length;
export const purchaseInput=z.object(purchaseFields).strict().refine(uniqueItems,{message:'Não repita variações.'});
export const orderInput=z.object({...purchaseFields,buyerPersonId:z.string().uuid().optional(),buyerName:z.string().trim().min(1).max(255).optional(),buyerContact:z.string().trim().max(255).default('')}).strict().refine(uniqueItems,{message:'Não repita variações.'});
export const orderAction=z.object({action:z.enum(['pay','payment_problem','allocate','ready','collect','cancel','refund','exception','resolve_exception']),note:z.string().trim().min(1).max(1000),version:z.number().int().positive().optional(),requestKey:z.string().uuid().optional(),incidentId:z.string().uuid().optional()}).strict();
export const receiptInput=z.object({id:z.string().uuid(),variantId:z.string().uuid(),quantity:z.number().int().positive().max(1000000),reference:z.string().trim().min(1).max(200)}).strict();
export const settingsInput=z.object({reservationMinutes:z.number().int().min(1).max(10080),pixInstructions:z.string().trim().max(2000),revision:z.number().int().positive().optional()}).strict();
export const orderListInput=z.object({campaignId:z.string().uuid().optional(),page:z.coerce.number().int().min(1).max(100000).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(20),search:z.string().trim().max(160).default(''),status:z.enum(['pending','confirmed','expired','review','cancelled','completed']).optional(),paymentStatus:z.enum(['unconfirmed','pending','problem','paid','refund_required','refunded']).optional(),deliveryStatus:z.enum(['waiting','ready','collected']).optional(),issues:z.literal('open').optional(),mine:z.literal('true').optional()}).strict();
const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,canonical(value)])):value;
const requestHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

export class OrderService {
  readonly commercial: CommercialService;
  constructor(readonly db:Database, readonly institution:InstitutionalService){this.commercial=new CommercialService(db,institution);}
  async manage(actor:Actor){if(actor.debugView&&actor.debugView.mode!=='real')throw new Forbidden('Perfis de consulta não operam pedidos.');await this.commercial.authorize(actor);}
  async canManage(actor:Actor){try{await this.manage(actor);return true;}catch(e){if(e instanceof Forbidden)return false;throw e;}}
  async settings(actor:Actor){await this.manage(actor);return this.db.one<RowDataPacket>('SELECT reservation_minutes AS reservationMinutes,pix_instructions AS pixInstructions,revision FROM commercial_operations WHERE organization_id=?',[org]);}
  async configure(actor:Actor,input:z.infer<typeof settingsInput>){await this.manage(actor);await this.db.transaction(async db=>{await lockCommercial(db);const config=await db.one<RowDataPacket>('SELECT revision FROM commercial_operations WHERE organization_id=?',[org]);if(input.revision!==undefined&&input.revision!==config!.revision)throw new Conflict('A configuração mudou. Reabra antes de salvar.');await db.run('UPDATE commercial_operations SET reservation_minutes=?,pix_instructions=?,revision=revision+1 WHERE organization_id=?',[input.reservationMinutes,input.pixInstructions,org]);await new InstitutionalService(db).audit(actor,'commercial.settings.updated','organization',org,{reservationMinutes:input.reservationMinutes});});return {ok:true};}
  async event(db:Database,orderId:string,actor:Actor,action:string,note=''){const id=randomUUID();await db.run('INSERT INTO commercial_order_events(id,order_id,action,actor_subject,actor_name,note) VALUES (?,?,?,?,?,?)',[id,orderId,action,actor.subject,actor.displayName,note]);if(action!=='order.created')await db.run('UPDATE commercial_orders SET version=version+1 WHERE id=?',[orderId]);return id;}
  async expire(db:Database){
    const expired=await db.many<RowDataPacket>(`SELECT DISTINCT o.id FROM commercial_orders o JOIN commercial_order_items i ON i.order_id=o.id WHERE i.allocation_status='provisional' AND i.expires_at<=NOW(3) ORDER BY o.id`);
    for(const o of expired){await db.run("UPDATE commercial_order_items SET allocation_status='released',allocated_quantity=0 WHERE order_id=? AND allocation_status='provisional'",[o.id]);await db.run("UPDATE commercial_orders SET status='expired' WHERE id=? AND status='pending'",[o.id]);await this.event(db,o.id,{subject:'system:reservations',displayName:'Reconciliação de reservas',projectAccess:false,owner:false},'reservation.expired','Prazo encerrado; unidades liberadas.');}
  }
  async reconcile(){return this.db.transaction(async db=>{await lockCommercial(db);await this.expire(db);},'READ COMMITTED');}
  async create(actor:Actor,input:z.infer<typeof orderInput>){
    await this.manage(actor);
    return this.persistOrder(actor,input);
  }
  async buy(actor:Actor,input:z.infer<typeof purchaseInput>){
    const member=await this.institution.requireMember(actor);
    if(actor.debugView&&actor.debugView.mode!=='real')throw new Forbidden('Perfis de consulta não fazem compras.');
    return this.persistOrder(actor,{...input,buyerPersonId:member.person_id,buyerContact:''},true);
  }
  private async persistOrder(actor:Actor,input:z.infer<typeof orderInput>,selfService=false){
    return this.db.transaction(async db=>{
      await lockCommercial(db);await this.expire(db);
      const items=[...input.items].sort((a,b)=>a.variantId.localeCompare(b.variantId)),hash=requestHash({...input,items});
      // 1.10 hashed the schema's property order. Preserve replays across upgrade.
      const legacyHash=createHash('sha256').update(JSON.stringify({campaignId:input.campaignId,requestKey:input.requestKey,...(input.buyerPersonId?{buyerPersonId:input.buyerPersonId}:{}),...(input.buyerName!==undefined?{buyerName:input.buyerName}:{}),buyerContact:input.buyerContact,items})).digest('hex');
      const existing=await db.one<RowDataPacket>('SELECT id,request_hash FROM commercial_orders WHERE request_key=?',[input.requestKey]);if(existing){if(existing.request_hash!==hash&&existing.request_hash!==legacyHash)throw new Conflict('Identificador do pedido já usado com outros dados.');return {id:existing.id};}
      const campaign=await this.commercial.products.campaign(db,input.campaignId);
      const config=await db.one<RowDataPacket>('SELECT reservation_minutes FROM commercial_operations WHERE organization_id=?',[org]);
      const buyer=input.buyerPersonId?await db.one<RowDataPacket>("SELECT p.id,p.display_name FROM people p JOIN memberships m ON m.person_id=p.id WHERE p.id=? AND m.organization_id=? AND p.honji_subject NOT LIKE 'caehub-debug-%'",[input.buyerPersonId,org]):undefined;
      if(input.buyerPersonId&&!buyer)throw new Conflict('Selecione um comprador cadastrado no projeto.');
      if(!buyer&&!input.buyerName)throw new Conflict('Informe o nome do comprador externo.');
      const rows:RowDataPacket[]=[];let total=0;
      for(const item of [...input.items].sort((a,b)=>a.variantId.localeCompare(b.variantId))){
        const v=await db.one<RowDataPacket>(`SELECT v.*,p.name AS product_name,p.sale_cents,p.mode,p.campaign_id FROM commercial_variants v JOIN commercial_products p ON p.id=v.product_id JOIN commercial_campaign_products l ON l.product_id=p.id WHERE v.id=? AND p.organization_id=? AND l.campaign_id=? AND p.status='active' AND v.status='active' FOR UPDATE`,[item.variantId,org,input.campaignId]);
        if(!v||v.sale_cents===null)throw new Conflict('Produto indisponível nesta campanha ou preço ainda não definido.');
        if(selfService&&v.mode==='preorder'&&campaign.stage!=='orders')throw new Conflict('As encomendas encerraram. Consulte a quantidade do seu pedido em Meus pedidos para acompanhar a retirada.');
        if(item.expectedPriceCents!==undefined&&item.expectedPriceCents!==Number(v.sale_cents))throw new Conflict('O preço de um item mudou. Atualize o catálogo e confira o total antes de registrar.');
        if(v.mode==='preorder'&&v.campaign_id!==input.campaignId)throw new Conflict('Encomenda de outra campanha.');
        const fulfillment=v.mode==='preorder'&&campaign.stage==='orders'?'preorder':'stock';
        if(fulfillment==='stock'){
          if(!config?.reservation_minutes)throw new Conflict('Configure o prazo de reserva antes de registrar pedidos de estoque.');
          if(v.physical_quantity-await reserved(db,v.id)<item.quantity)throw new Conflict('Estoque livre insuficiente. Nenhum item foi reservado.');
        }
        total+=Number(v.sale_cents)*item.quantity;if(!Number.isSafeInteger(total))throw new Conflict('Total acima do limite.');
        rows.push({...v,quantity:item.quantity,fulfillment} as RowDataPacket);
      }
      const id=randomUUID();await db.run('INSERT INTO commercial_orders(id,campaign_id,buyer_person_id,buyer_name,buyer_contact,request_key,request_hash,total_cents) VALUES (?,?,?,?,?,?,?,?)',[id,input.campaignId,buyer?.id??null,buyer?.display_name??input.buyerName,input.buyerContact,input.requestKey,hash,total]);
      for(const v of rows)await db.run(`INSERT INTO commercial_order_items(id,order_id,variant_id,product_name,variant_name,fulfillment,quantity,unit_price_cents,allocation_status,allocated_quantity,expires_at,production_status) VALUES (?,?,?,?,?,?,?,?,?,?,IF(? IS NULL,NULL,TIMESTAMPADD(MINUTE,?,NOW(3))),?)`,[randomUUID(),id,v.id,v.product_name,v.name,v.fulfillment,v.quantity,v.sale_cents,v.fulfillment==='stock'?'provisional':'none',v.fulfillment==='stock'?v.quantity:0,v.fulfillment==='stock'?config!.reservation_minutes:null,config?.reservation_minutes??null,v.fulfillment==='preorder'?'waiting':'not_needed']);
      await this.event(db,id,actor,'order.created');return {id};
    },'READ COMMITTED');
  }
  async shop(actor:Actor){
    await this.institution.requireMember(actor);
    return this.publicCatalog();
  }
  async publicCatalog(){
    const campaigns=await this.db.many<RowDataPacket>("SELECT id,name,description,semester,stage,status,version FROM commercial_campaigns WHERE organization_id=? AND status='active' ORDER BY semester DESC,name",[org]);
    const products=await this.db.many<RowDataPacket>(`SELECT DISTINCT p.id,p.name,p.description,p.sku,p.category,p.mode,p.campaign_id AS campaignId,p.sale_cents AS saleCents,p.status FROM commercial_products p JOIN commercial_campaign_products l ON l.product_id=p.id JOIN commercial_campaigns c ON c.id=l.campaign_id WHERE p.organization_id=? AND p.status='active' AND p.sale_cents IS NOT NULL AND c.status='active' AND (p.mode='physical' OR c.stage='orders') ORDER BY p.name`,[org]);
    const variants=await this.db.many<RowDataPacket>(`SELECT v.id,v.product_id AS productId,v.name,v.status,v.attributes,CAST(v.physical_quantity-COALESCE(r.quantity,0) AS SIGNED) AS availableQuantity FROM commercial_variants v JOIN commercial_products p ON p.id=v.product_id LEFT JOIN (SELECT variant_id,SUM(allocated_quantity) AS quantity FROM commercial_order_items WHERE allocation_status='committed' OR (allocation_status='provisional' AND expires_at>NOW(3)) GROUP BY variant_id) r ON r.variant_id=v.id WHERE p.organization_id=? AND p.status='active' AND p.sale_cents IS NOT NULL AND v.status='active' AND EXISTS(SELECT 1 FROM commercial_campaign_products l JOIN commercial_campaigns c ON c.id=l.campaign_id WHERE l.product_id=p.id AND c.status='active' AND (p.mode='physical' OR c.stage='orders')) ORDER BY v.name`,[org]);
    const links=await this.db.many<RowDataPacket>(`SELECT l.campaign_id AS campaignId,l.product_id AS productId FROM commercial_campaign_products l JOIN commercial_campaigns c ON c.id=l.campaign_id JOIN commercial_products p ON p.id=l.product_id WHERE c.organization_id=? AND c.status='active' AND (p.mode='physical' OR c.stage='orders') AND p.status='active' AND p.sale_cents IS NOT NULL`,[org]);
    const config=await this.db.one<RowDataPacket>('SELECT reservation_minutes FROM commercial_operations WHERE organization_id=?',[org]);
    return {campaigns,products,variants,links,reservationMinutes:config?.reservation_minutes??null};
  }
  async list(actor:Actor,campaignId?:string,query?:z.infer<typeof orderListInput>){
    const member=await this.institution.requireMember(actor),canManage=await this.canManage(actor);
    const q=query??orderListInput.parse({campaignId});
    if(q.issues&&!canManage)throw new Forbidden('Pendências administrativas exigem operador.');
    await this.reconcile();
    const where=['c.organization_id=?'],values:unknown[]=[org];
    if(q.campaignId){where.push('c.id=?');values.push(q.campaignId);}
    if(!canManage||q.mine){where.push('o.buyer_person_id=?');values.push(member.person_id);}
    const scoped=where.join(' AND '),scopeValues=[...values];
    for(const [key,column] of [['status','status'],['paymentStatus','payment_status'],['deliveryStatus','delivery_status']] as const)if(q[key]){if(key==='paymentStatus'&&q[key]==='unconfirmed')where.push("o.payment_status IN ('pending','problem') AND o.status NOT IN ('cancelled','completed')");else{where.push(`o.${column}=?`);values.push(q[key]);}}
    if(q.search){where.push('(o.buyer_name LIKE ? OR o.id LIKE ?)');values.push(`%${q.search}%`,`%${q.search}%`);}
    if(q.issues)where.push("EXISTS(SELECT 1 FROM commercial_order_incidents x WHERE x.order_id=o.id AND x.status='open')");
    const from=`FROM commercial_orders o JOIN commercial_campaigns c ON c.id=o.campaign_id WHERE ${where.join(' AND ')}`;
    const count=await this.db.one<RowDataPacket>(`SELECT COUNT(*) AS total ${from}`,values);
    const rows=await this.db.many<RowDataPacket>(`SELECT o.id,o.campaign_id AS campaignId,c.name AS campaignName,o.buyer_name AS buyerName,o.total_cents AS totalCents,o.status,o.payment_status AS paymentStatus,o.delivery_status AS deliveryStatus,o.created_at AS createdAt,o.version ${canManage?",(SELECT COUNT(*) FROM commercial_order_incidents x WHERE x.order_id=o.id AND x.status='open') AS openIssues":''} ${from} ORDER BY o.created_at DESC,o.id DESC LIMIT ? OFFSET ?`,[...values,q.pageSize,(q.page-1)*q.pageSize]);
    const summary=await this.db.one<RowDataPacket>(`SELECT COUNT(*) AS total,COALESCE(SUM(o.payment_status IN ('pending','problem') AND o.status NOT IN ('cancelled','completed')),0) AS paymentPending,COALESCE(SUM(o.status='review'),0) AS review,COALESCE(SUM(o.delivery_status='ready'),0) AS ready,COALESCE(SUM(o.status='completed'),0) AS completed,COALESCE(SUM(o.payment_status='refund_required'),0) AS refunds FROM commercial_orders o JOIN commercial_campaigns c ON c.id=o.campaign_id WHERE ${scoped}`,scopeValues);
    if(!canManage||q.mine){
      const ids=rows.map(row=>row.id);
      const items=ids.length?await this.db.many<RowDataPacket>(`SELECT id,order_id AS orderId,product_name AS productName,variant_name AS variantName,quantity,unit_price_cents AS unitPriceCents,fulfillment,production_status AS productionStatus,allocated_quantity AS allocatedQuantity FROM commercial_order_items WHERE order_id IN (${ids.map(()=>'?').join(',')}) ORDER BY product_name,variant_name`,ids):[];
      for(const row of rows)row.items=items.filter(item=>item.orderId===row.id).map(({orderId,...item})=>item);
    }
    return {orders:rows,canManage:canManage&&!q.mine,total:Number(count!.total),page:q.page,pageSize:q.pageSize,pages:Math.max(1,Math.ceil(Number(count!.total)/q.pageSize)),summary};
  }
  async order(db:Database,id:string){const o=await db.one<RowDataPacket>('SELECT o.* FROM commercial_orders o JOIN commercial_campaigns c ON c.id=o.campaign_id WHERE o.id=? AND c.organization_id=? FOR UPDATE',[id,org]);if(!o)throw new NotFound('Pedido não encontrado.');return o;}
  async detail(actor:Actor,id:string,ownOnly=false){
    const member=await this.institution.requireMember(actor),canManage=!ownOnly&&await this.canManage(actor);
    return this.db.transaction(async db=>{
    await lockCommercial(db);await this.expire(db);
    const o=await db.one<RowDataPacket>('SELECT o.*,c.name AS campaignName,c.stage AS campaignStage FROM commercial_orders o JOIN commercial_campaigns c ON c.id=o.campaign_id WHERE o.id=? AND c.organization_id=?',[id,org]);
    if(!o||(!canManage&&o.buyer_person_id!==member.person_id))throw new NotFound('Pedido não encontrado.');
    const items=await db.many<RowDataPacket>('SELECT * FROM commercial_order_items WHERE order_id=? ORDER BY product_name,variant_name',[id]);
    const events=await db.many<RowDataPacket>(`SELECT id,action,actor_name AS actor,note,created_at AS createdAt FROM commercial_order_events WHERE order_id=? ${canManage?'':"AND action NOT IN ('administrative.exception','administrative.resolved')"} ORDER BY created_at,id`,[id]);
    const config=await db.one<RowDataPacket>('SELECT pix_instructions FROM commercial_operations WHERE organization_id=?',[org]);
    const incidents=canManage?await db.many<RowDataPacket>('SELECT id,status,note,actor_name AS actor,resolution,resolved_by AS resolvedBy,created_at AS createdAt,resolved_at AS resolvedAt FROM commercial_order_incidents WHERE order_id=? ORDER BY created_at,id',[id]):[];
    // Internal identity subjects/contact are returned only to the operator.
    if(!canManage){delete o.buyer_contact;delete o.payment_actor;delete o.delivery_actor;delete o.request_key;delete o.request_hash;delete o.buyer_person_id;for(const event of events){delete event.actor;delete event.note;}}
    return {order:o,items,events,incidents,availableActions:canManage?this.actions(o,items):[],pixInstructions:config?.pix_instructions??'',canManage};
    },'READ COMMITTED');
  }
  private actions(o:RowDataPacket,items:RowDataPacket[]){
    const actions=['exception'];
    if(['pending','problem'].includes(o.payment_status)&&!['cancelled','completed'].includes(o.status))actions.push('pay','payment_problem');
    if(o.payment_status==='paid'&&['review','confirmed'].includes(o.status)&&items.some(i=>i.allocated_quantity<i.quantity&&(i.fulfillment==='stock'||i.production_status==='waiting')))actions.push('allocate');
    if(o.status==='confirmed'&&o.payment_status==='paid'&&o.delivery_status==='waiting'&&o.campaignStage==='collection'&&items.every(i=>i.allocation_status==='committed'&&i.allocated_quantity===i.quantity))actions.push('ready');
    if(o.delivery_status==='ready'&&o.campaignStage==='collection')actions.push('collect');
    if(!['cancelled','completed'].includes(o.status)&&!items.some(i=>i.production_status==='in_production'))actions.push('cancel');
    if(o.status==='cancelled'&&o.payment_status==='refund_required')actions.push('refund');
    return actions;
  }
  async allocate(db:Database,o:RowDataPacket,items:RowDataPacket[]){
    let allocated=0;
    for(const i of items.filter(i=>i.allocated_quantity<i.quantity)){
      const v=await db.one<RowDataPacket>('SELECT physical_quantity FROM commercial_variants WHERE id=? FOR UPDATE',[i.variant_id]);
      const available=v!.physical_quantity-await reserved(db,i.variant_id),needed=i.quantity-i.allocated_quantity;
      if(i.fulfillment==='stock'&&available<needed)throw new Conflict('Estoque livre insuficiente para regularizar o pedido.');
      // Existing received surplus can satisfy an obligation still awaiting production.
      // Production already commissioned is reconciled only through receipts.
      if(i.fulfillment==='preorder'&&i.production_status==='in_production')continue;
      const quantity=Math.min(available,needed);if(quantity<=0)continue;
      allocated+=quantity;
      await db.run("UPDATE commercial_order_items SET allocation_status='committed',allocated_quantity=allocated_quantity+?,expires_at=NULL,production_status=? WHERE id=?",[quantity,i.fulfillment==='preorder'&&quantity===needed?'received':i.production_status,i.id]);
    }
    if(allocated===0&&o.status!=='review'&&items.some(i=>i.fulfillment==='preorder'&&i.production_status==='waiting'&&i.allocated_quantity<i.quantity))throw new Conflict('Não há unidades físicas livres para esta encomenda. Registre o recebimento ou aguarde a produção.');
    await db.run("UPDATE commercial_orders SET status='confirmed' WHERE id=?",[o.id]);
  }
  async act(actor:Actor,id:string,input:z.infer<typeof orderAction>){
    await this.manage(actor);
    return this.db.transaction(async db=>{
      await lockCommercial(db);await this.expire(db);const o=await this.order(db,id);
      const items=await db.many<RowDataPacket>('SELECT * FROM commercial_order_items WHERE order_id=? ORDER BY variant_id FOR UPDATE',[id]);
      const action=input.action;
      const hash=requestHash({orderId:id,actor:actor.subject,...input});
      if(input.requestKey){const previous=await db.one<RowDataPacket>('SELECT request_hash FROM commercial_order_commands WHERE id=?',[input.requestKey]);if(previous){if(previous.request_hash!==hash)throw new Conflict('Esta operação já foi enviada com outros dados. Atualize o pedido.');return {id};}}
      const finish=async()=>{if(input.requestKey)await db.run('INSERT INTO commercial_order_commands(id,order_id,request_hash) VALUES (?,?,?)',[input.requestKey,id,hash]);return {id};};
      const alreadyDone=(action==='pay'&&o.payment_status==='paid')||(action==='ready'&&o.delivery_status==='ready')||(action==='collect'&&o.delivery_status==='collected')||(action==='cancel'&&o.status==='cancelled')||(action==='refund'&&o.payment_status==='refunded');
      if(alreadyDone)return finish();
      if(input.version!==undefined&&input.version!==o.version)throw new Conflict('Este pedido mudou enquanto estava aberto. Atualize os detalhes antes de operar.');
      if(action==='exception'){const eventId=await this.event(db,id,actor,'administrative.exception',input.note);await db.run('INSERT INTO commercial_order_incidents(id,order_id,note,actor_name) VALUES (?,?,?,?)',[eventId,id,input.note,actor.displayName]);return finish();}
      if(action==='resolve_exception'){
        if(!input.incidentId)throw new Conflict('Selecione a pendência a resolver.');
        const incident=await db.one<RowDataPacket>('SELECT status FROM commercial_order_incidents WHERE id=? AND order_id=? FOR UPDATE',[input.incidentId,id]);
        if(!incident||incident.status!=='open')throw new Conflict('Pendência inexistente ou já resolvida.');
        await db.run("UPDATE commercial_order_incidents SET status='resolved',resolution=?,resolved_by=?,resolved_at=NOW(3) WHERE id=?",[input.note,actor.displayName,input.incidentId]);
        await this.event(db,id,actor,'administrative.resolved',input.note);return finish();
      }
      if(action==='pay'){
        if(o.payment_status==='paid')return finish();
        if(!['pending','problem'].includes(o.payment_status)||['cancelled','completed'].includes(o.status))throw new Conflict('Este pedido não aceita confirmação de pagamento.');
        const late=items.some(i=>i.fulfillment==='stock'&&i.allocation_status!=='provisional');
        await db.run("UPDATE commercial_orders SET payment_status='paid',payment_actor=?,paid_at=NOW(3),status=? WHERE id=?",[actor.subject,late?'review':'confirmed',id]);
        if(!late)await db.run("UPDATE commercial_order_items SET allocation_status='committed',expires_at=NULL WHERE order_id=? AND allocation_status='provisional'",[id]);
        await this.event(db,id,actor,late?'payment.confirmed_late':'payment.confirmed',input.note);
        return finish();
      }
      if(action==='payment_problem'){
        if(!['pending','problem'].includes(o.payment_status)||!['pending','expired'].includes(o.status))throw new Conflict('Pagamento já confirmado ou pedido encerrado.');
        await db.run("UPDATE commercial_orders SET payment_status='problem' WHERE id=?",[id]);
      }
      if(action==='allocate'){
        if(o.payment_status!=='paid'||!['review','confirmed'].includes(o.status))throw new Conflict('Regularização exige pagamento confirmado.');
        await this.allocate(db,o,items);
      }
      if(action==='ready'){
        if(o.delivery_status==='ready')return finish();
        const c=await db.one<RowDataPacket>('SELECT stage FROM commercial_campaigns WHERE id=? FOR UPDATE',[o.campaign_id]);
        if(c!.stage!=='collection'||o.status!=='confirmed'||o.payment_status!=='paid'||items.some(i=>i.allocation_status!=='committed'||i.allocated_quantity!==i.quantity))throw new Conflict('Retirada exige etapa 2, pagamento e todos os itens recebidos/alocados.');
        await db.run("UPDATE commercial_orders SET delivery_status='ready' WHERE id=?",[id]);
        if(o.buyer_person_id){const m=await db.one<RowDataPacket>("SELECT id FROM memberships WHERE person_id=? AND organization_id=? AND status='active'",[o.buyer_person_id,org]);if(m)await notify(db,[m.id],'order_ready','order',id,'Seu pedido está pronto para retirada.');}
      }
      if(action==='collect'){
        if(o.delivery_status==='collected')return finish();
        if(o.status!=='confirmed'||o.payment_status!=='paid'||o.delivery_status!=='ready')throw new Conflict('Marque o pedido completo como pronto antes da entrega.');
        const c=await db.one<RowDataPacket>('SELECT stage FROM commercial_campaigns WHERE id=? FOR UPDATE',[o.campaign_id]);if(c!.stage!=='collection')throw new Conflict('A entrega exige a etapa de retiradas.');
        for(const i of items){if(i.allocation_status!=='committed'||i.allocated_quantity!==i.quantity)throw new Conflict('Item ainda não alocado.');await this.movement(db,actor,i.variant_id,-i.quantity,'Retirada do pedido',id);}
        await db.run("UPDATE commercial_order_items SET allocation_status='consumed',allocated_quantity=0 WHERE order_id=?",[id]);
        await db.run("UPDATE commercial_orders SET status='completed',delivery_status='collected',delivery_actor=?,collected_at=NOW(3) WHERE id=?",[actor.subject,id]);
      }
      if(action==='cancel'){
        if(o.status==='cancelled')return finish();
        if(o.delivery_status==='collected'||items.some(i=>i.production_status==='in_production'))throw new Conflict('Pedido entregue ou em produção exige tratamento administrativo; registre a ocorrência.');
        await db.run("UPDATE commercial_order_items SET allocation_status='released',allocated_quantity=0,expires_at=NULL WHERE order_id=?",[id]);
        await db.run("UPDATE commercial_orders SET status='cancelled',delivery_status='waiting',payment_status=IF(payment_status='paid','refund_required',payment_status) WHERE id=?",[id]);
      }
      if(action==='refund'){
        if(o.payment_status==='refunded')return finish();
        if(o.status!=='cancelled'||o.payment_status!=='refund_required')throw new Conflict('Registre cancelamento com reembolso pendente primeiro.');
        await db.run("UPDATE commercial_orders SET payment_status='refunded' WHERE id=?",[id]);
      }
      await this.event(db,id,actor,`order.${action}`,input.note);return finish();
    },'READ COMMITTED');
  }
  async movement(db:Database,actor:Actor,variantId:string,delta:number,justification:string,reference:string){
    const v=await db.one<RowDataPacket>('SELECT physical_quantity FROM commercial_variants WHERE id=? FOR UPDATE',[variantId]);
    const balance=v!.physical_quantity+delta;if(balance<0||balance>2147483647)throw new Conflict('Saldo físico inconsistente ou acima do limite.');
    await db.run('UPDATE commercial_variants SET physical_quantity=? WHERE id=?',[balance,variantId]);
    await db.run('INSERT INTO commercial_movements(id,variant_id,kind,quantity,balance_after,actor_subject,actor_name,justification,operational_reference) VALUES (?,?,?,?,?,?,?,?,?)',[randomUUID(),variantId,delta>0?'entry':'exit',delta,balance,actor.subject,actor.displayName,justification,reference]);
  }
  async production(actor:Actor,campaignId:string){
    await this.manage(actor);return this.db.transaction(async db=>{await lockCommercial(db);await this.commercial.campaign(db,campaignId);
    const variants=await db.many<RowDataPacket>(`SELECT i.variant_id AS variantId,p.name AS productName,v.name AS variantName,
      SUM(IF(o.payment_status='paid' AND o.status IN ('confirmed','completed'),i.quantity,0)) AS paidQuantity,
      SUM(IF(o.status IN ('pending','expired'),i.quantity,0)) AS pendingQuantity,
      SUM(IF(o.status='cancelled',i.quantity,0)) AS cancelledQuantity,
      SUM(IF(o.payment_status='paid' AND o.status='review',i.quantity,0)) AS reviewQuantity,
      SUM(IF(o.status='completed',i.quantity,0)) AS deliveredQuantity,
      SUM(IF(o.payment_status='paid' AND o.status='confirmed',i.allocated_quantity,0)) AS allocatedQuantity,
      SUM(IF(o.payment_status='paid' AND o.status='confirmed',i.quantity-i.allocated_quantity,0)) AS outstandingQuantity,
      SUM(IF(o.payment_status='paid' AND o.status='confirmed' AND i.production_status='waiting',i.quantity-i.allocated_quantity,0)) AS neededQuantity,
      SUM(IF(o.payment_status='paid' AND o.status='confirmed' AND i.production_status='in_production',i.quantity-i.allocated_quantity,0)) AS producingQuantity
      FROM commercial_order_items i JOIN commercial_orders o ON o.id=i.order_id JOIN commercial_variants v ON v.id=i.variant_id JOIN commercial_products p ON p.id=v.product_id WHERE o.campaign_id=? AND i.fulfillment='preorder' GROUP BY i.variant_id,p.name,v.name ORDER BY p.name,v.name`,[campaignId]);
    const receipts=await db.many<RowDataPacket>('SELECT r.id,r.variant_id AS variantId,p.name AS productName,v.name AS variantName,r.quantity,r.expected_quantity AS expectedQuantity,r.allocated_quantity AS allocatedQuantity,r.reference,r.actor_name AS actor,r.created_at AS createdAt FROM commercial_production_receipts r JOIN commercial_variants v ON v.id=r.variant_id JOIN commercial_products p ON p.id=v.product_id WHERE r.campaign_id=? ORDER BY r.created_at DESC,r.id DESC',[campaignId]);
    for(const v of variants){for(const key of ['paidQuantity','pendingQuantity','cancelledQuantity','reviewQuantity','deliveredQuantity','allocatedQuantity','outstandingQuantity','neededQuantity','producingQuantity'])v[key]=Number(v[key]);v.receivedQuantity=receipts.filter(r=>r.variantId===v.variantId).reduce((n,r)=>n+r.quantity,0);v.freeQuantity=(await db.one<RowDataPacket>('SELECT physical_quantity FROM commercial_variants WHERE id=?',[v.variantId]))!.physical_quantity-await reserved(db,v.variantId);}
    return {variants,receipts};
    },'READ COMMITTED');
  }
  async startProduction(actor:Actor,campaignId:string,variantId:string){
    await this.manage(actor);return this.db.transaction(async db=>{await lockCommercial(db);await this.commercial.campaign(db,campaignId);
      const rows=await db.many<RowDataPacket>(`SELECT i.id,i.order_id FROM commercial_order_items i JOIN commercial_orders o ON o.id=i.order_id WHERE o.campaign_id=? AND i.variant_id=? AND i.fulfillment='preorder' AND o.status='confirmed' AND o.payment_status='paid' AND i.production_status='waiting'`,[campaignId,variantId]);
      for(const i of rows){await db.run("UPDATE commercial_order_items SET production_status='in_production' WHERE id=?",[i.id]);await this.event(db,i.order_id,actor,'production.started');}return {count:rows.length};
    },'READ COMMITTED');
  }
  async receive(actor:Actor,campaignId:string,input:z.infer<typeof receiptInput>){
    await this.manage(actor);return this.db.transaction(async db=>{
      await lockCommercial(db);const existing=await db.one<RowDataPacket>('SELECT * FROM commercial_production_receipts WHERE id=?',[input.id]);if(existing){if(existing.campaign_id!==campaignId||existing.variant_id!==input.variantId||existing.quantity!==input.quantity||existing.reference!==input.reference)throw new Conflict('Identificador de recebimento já usado com outros dados.');return {id:input.id};}
      const c=await db.one<RowDataPacket>("SELECT stage FROM commercial_campaigns WHERE id=? AND organization_id=? FOR UPDATE",[campaignId,org]);if(!c||c.stage!=='collection')throw new Conflict('Recebimento exige a etapa de retiradas da campanha.');
      const v=await db.one<RowDataPacket>("SELECT v.id FROM commercial_variants v JOIN commercial_products p ON p.id=v.product_id WHERE v.id=? AND p.campaign_id=? AND p.mode='preorder' AND p.organization_id=? FOR UPDATE",[input.variantId,campaignId,org]);if(!v)throw new Conflict('Selecione uma variação sob encomenda da campanha.');
      const items=await db.many<RowDataPacket>(`SELECT i.*,o.created_at FROM commercial_order_items i JOIN commercial_orders o ON o.id=i.order_id WHERE o.campaign_id=? AND i.variant_id=? AND i.fulfillment='preorder' AND o.payment_status='paid' AND o.status='confirmed' AND i.production_status IN ('waiting','in_production') ORDER BY o.created_at,o.id FOR UPDATE`,[campaignId,input.variantId]);
      const expected=items.reduce((n,i)=>n+i.quantity-i.allocated_quantity,0);let remaining=input.quantity;
      await this.movement(db,actor,input.variantId,input.quantity,'Recebimento de produção',input.id);
      for(const i of items){const quantity=Math.min(remaining,i.quantity-i.allocated_quantity);if(!quantity)continue;const full=i.allocated_quantity+quantity===i.quantity;await db.run("UPDATE commercial_order_items SET allocated_quantity=allocated_quantity+?,allocation_status='committed',production_status=? WHERE id=?",[quantity,full?'received':i.production_status,i.id]);await this.event(db,i.order_id,actor,'production.received',`${quantity} unidade(s); recebimento ${input.id}; ${input.reference}`);remaining-=quantity;}
      await db.run('INSERT INTO commercial_production_receipts(id,campaign_id,variant_id,quantity,expected_quantity,allocated_quantity,reference,actor_subject,actor_name) VALUES (?,?,?,?,?,?,?,?,?)',[input.id,campaignId,input.variantId,input.quantity,expected,input.quantity-remaining,input.reference,actor.subject,actor.displayName]);
      return {id:input.id,allocatedQuantity:input.quantity-remaining,freeQuantity:remaining,expectedQuantity:expected};
    },'READ COMMITTED');
  }
}
