import {useEffect,useRef,useState} from 'react';
import {api} from '../services/spaces';
import {commercialOrderFailure,emptyOrderDraft,newRequestKey,type OrderDetail,type OrderDraft,type SaleCatalog} from '../services/commercial-orders';
import {planRepeatOrder,type RepeatPlan} from '../domain/reorder';
import {money} from '../services/commercial';
import {CommercialOrderForm} from './CommercialOrderForm';
import {Button,Dialog,ErrorState,LoadingState} from './primitives';

export function RepeatOrder({orderId,campaignId,onClose,onCreated}:{orderId:string;campaignId:string;onClose:()=>void;onCreated:(id:string)=>void}){
 const [catalog,setCatalog]=useState<SaleCatalog>(),[plan,setPlan]=useState<RepeatPlan>(),[loading,setLoading]=useState(true),[error,setError]=useState(''),[checkout,setCheckout]=useState(false),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
 const [draft,setDraft]=useState<OrderDraft>(emptyOrderDraft),keys=useRef(new Map<string,string>()),pending=useRef(false);
 useEffect(()=>{let active=true;setLoading(true);setError('');setCheckout(false);Promise.all([api<OrderDetail>(`/commercial/my-orders/${orderId}`),api<SaleCatalog>('/public/catalog')]).then(([detail,latest])=>{if(!active)return;const next=planRepeatOrder(detail,campaignId,latest);setCatalog(latest);setPlan(next);setDraft({...emptyOrderDraft(),items:next.items});}).catch(e=>{if(active)setError(commercialOrderFailure(e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[orderId,campaignId,retry]);
 const submit=async()=>{
  if(pending.current||!catalog||!draft.items.length)return;pending.current=true;setBusy(true);setError('');
  try{
   const items=draft.items.map(line=>{const variant=catalog.variants.find(v=>v.id===line.variantId),product=catalog.products.find(p=>p.id===variant?.productId);if(!product)throw new Error('Um item ficou indisponível. Atualize a disponibilidade.');return {variantId:line.variantId,quantity:Number(line.quantity),expectedPriceCents:product.saleCents};});
   const signature=JSON.stringify({campaignId,items});const requestKey=keys.current.get(signature)??newRequestKey();keys.current.set(signature,requestKey);
   const created=await api<{id:string}>('/commercial/my-orders',{method:'POST',body:JSON.stringify({campaignId,requestKey,items})});
   onCreated(created.id);
  }catch(e){setError(commercialOrderFailure(e));}finally{pending.current=false;setBusy(false);}
 };
 return <Dialog title={checkout?'Conferir novo pedido':'Refazer pedido vencido'} protectChanges size="wide" onClose={()=>{if(!busy)onClose();}}>
 {loading?<LoadingState/>:!catalog||!plan?<ErrorState onRetry={()=>setRetry(value=>value+1)}/>:checkout?<><p>Este será um novo pedido, com preços e disponibilidade atuais. O pedido vencido permanece no histórico.</p><CommercialOrderForm catalog={catalog} campaignId={campaignId} draft={draft} onChange={setDraft} onSubmit={()=>void submit()} busy={busy} refresh={()=>setRetry(value=>value+1)}/></>:<div className="reorder-review">
 <p>Confira os itens antes de refazer. Nenhuma nova reserva foi criada.</p>
 {plan.blocker&&<p role="status">{plan.blocker}</p>}
 {plan.changes.length>0&&<div className="reorder-changes" role="status"><strong>O pedido precisa de ajustes</strong><ul>{plan.changes.map((change,index)=><li key={index}><strong>{change.label}</strong><p>{change.reason}</p></li>)}</ul></div>}
 {plan.items.length>0?<><h3>Itens disponíveis para o novo pedido</h3><ul>{plan.items.map(line=>{const variant=catalog.variants.find(v=>v.id===line.variantId)!,product=catalog.products.find(p=>p.id===variant.productId)!;return <li key={line.variantId}>{line.quantity} × {product.name} · {variant.name} — {money(Number(product.saleCents)*Number(line.quantity))}</li>;})}</ul><div className="form-actions"><Button variant="primary" onClick={()=>setCheckout(true)}>{plan.changes.length?'Prosseguir com os itens disponíveis':'Conferir novo pedido'}</Button><Button onClick={onClose}>Cancelar</Button></div></>:<p>Nenhum item deste pedido está disponível para refazer.</p>}
 <div className="form-actions"><Button onClick={()=>setRetry(value=>value+1)}>Atualizar disponibilidade</Button><a className="button button-secondary" href="#/comercial/comprar" onClick={onClose}>Abrir lojinha</a></div>
 </div>}
 {error&&<p role="alert">{error}</p>}
 </Dialog>;
}
