import type { Production, SaleCatalog } from '../services/commercial-orders';
import { orderTime } from '../services/commercial-orders';
import { Badge, Button, EmptyState } from './primitives';

export type ReceiptDraft={variantId:string;quantity:string;reference:string};
export function CommercialProduction({data,catalog,campaignId,busy,draft,onChange,onReceive,onStart}:{data:Production;catalog:SaleCatalog;campaignId:string;busy:boolean;draft:ReceiptDraft;onChange:(value:ReceiptDraft)=>void;onReceive:()=>void;onStart:(variantId:string)=>void}){
  const campaign=catalog.campaigns.find(c=>c.id===campaignId);
  const totals=data.variants.reduce((r,v)=>({paid:r.paid+v.paidQuantity,needed:r.needed+v.neededQuantity,producing:r.producing+v.producingQuantity,delivered:r.delivered+v.deliveredQuantity}),{paid:0,needed:0,producing:0,delivered:0});
  const eligible=catalog.variants.filter(v=>catalog.products.some(p=>p.id===v.productId&&p.mode==='preorder'&&p.campaignId===campaignId));
  return <>
    <p>Encomendas pagas criam uma obrigação de entrega. Registre somente unidades recebidas e conferidas; o sistema aloca os itens antes de liberar sobras.</p>
    <div className="commercial-metrics"><span><strong>{totals.paid}</strong> pagas</span><span><strong>{totals.needed}</strong> a produzir</span><span><strong>{totals.producing}</strong> em produção</span><span><strong>{totals.delivered}</strong> entregues</span></div>
    {!data.variants.length?<EmptyState title="Nenhuma encomenda nesta campanha.">Os pedidos por variação aparecerão aqui.</EmptyState>:<ul className="commercial-order-items">{data.variants.map(v=><li key={v.variantId}>
      <strong>{v.productName} · {v.variantName}</strong><span>Pagas: {v.paidQuantity} · Pendentes: {v.pendingQuantity} · Canceladas: {v.cancelledQuantity}</span>
      <span>A produzir: {v.neededQuantity} · Em produção: {v.producingQuantity} · Faltam receber/alocar: {v.outstandingQuantity}</span>
      <span>Recebidas: {v.receivedQuantity} · Alocadas: {v.allocatedQuantity} · Entregues: {v.deliveredQuantity} · Livres agora: {v.freeQuantity}</span>
      {v.reviewQuantity>0&&<Badge tone="waiting">{v.reviewQuantity} unidades com pagamento em revisão</Badge>}
      <Button type="button" disabled={busy||v.neededQuantity<=0} onClick={()=>onStart(v.variantId)}>Registrar início de produção</Button>
    </li>)}</ul>}
    <h3>Recebimento físico</h3>
    <form className="form-fields commercial-form" onSubmit={e=>{e.preventDefault();onReceive();}}><fieldset disabled={busy}>
      <label>Variação recebida<select required value={draft.variantId} onChange={e=>onChange({...draft,variantId:e.target.value})}><option value="">Selecione</option>{eligible.map(v=><option key={v.id} value={v.id}>{catalog.products.find(p=>p.id===v.productId)?.name} · {v.name}</option>)}</select></label>
      <label>Quantidade recebida<input required type="number" min="1" max="1000000" step="1" value={draft.quantity} onChange={e=>onChange({...draft,quantity:e.target.value})}/></label>
      <label>Referência do lote/conferência<input required maxLength={200} value={draft.reference} onChange={e=>onChange({...draft,reference:e.target.value})}/></label>
      <Button variant="primary" disabled={busy||campaign?.stage!=='collection'||!eligible.length}>{busy?'Registrando…':'Registrar recebimento'}</Button>
      {campaign?.stage!=='collection'&&<p>Altere a campanha para a etapa de retiradas antes de receber as mercadorias.</p>}
    </fieldset></form>
    <h3>Recebimentos e divergências</h3>
    {!data.receipts.length?<p>Nenhum lote recebido.</p>:<ul className="commercial-order-items">{data.receipts.map(r=><li key={r.id}><strong>{r.productName} · {r.variantName}</strong><span>{r.reference} · {r.quantity} recebidas</span><span>{r.expectedQuantity} aguardadas naquele momento · {r.allocatedQuantity} alocadas · diferença {r.quantity-Number(r.expectedQuantity)}</span><span>{r.actor} · {orderTime(r.createdAt)}</span></li>)}</ul>}
  </>;
}
