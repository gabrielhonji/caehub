import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/spaces';
import { money } from '../services/commercial';
import { emptyOrderDraft, newRequestKey, commercialOrderFailure, buyerOrderLabel, orderLabels, orderTime, type OrderDetail, type OrderDraft, type OrderList, type OrderSettings, type Production, type SaleCatalog } from '../services/commercial-orders';
import { AccessDeniedState, Badge, Button, Toast, Dialog, EmptyState, ErrorState, Eyebrow, LoadingState } from './primitives';
import { CommercialOrderForm } from './CommercialOrderForm';
import { CommercialOrderDetail } from './CommercialOrderDetail';
import { CommercialProduction, type ReceiptDraft } from './CommercialProduction';

const failure=commercialOrderFailure;
const emptyFilters={search:'',status:'',paymentStatus:'',deliveryStatus:'',issues:''};
type Flow='create'|'settings'|'production'|'detail';

export function CommercialOrders({catalog,campaignId,onInventoryChange,mode='admin',initialOrderId}:{catalog?:SaleCatalog;campaignId?:string;onInventoryChange?:()=>Promise<void>;mode?:'admin'|'mine';initialOrderId?:string}){
  const [data,setData]=useState<OrderList>(),[error,setError]=useState(''),[feedback,setFeedback]=useState(''),[denied,setDenied]=useState(false);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[flow,setFlow]=useState<Flow>(),[formError,setFormError]=useState('');
  const [filters,setFilters]=useState(emptyFilters),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(20);
  const [detail,setDetail]=useState<OrderDetail>(),[production,setProduction]=useState<Production>(),[settings,setSettings]=useState<OrderSettings>(),[buyers,setBuyers]=useState<{id:string;name:string}[]>([]);
  const [returnFocus,setReturnFocus]=useState<HTMLElement|null>(null),[draft,setDraft]=useState<OrderDraft>(emptyOrderDraft);
  const [requestKey,setRequestKey]=useState(newRequestKey),[receiptKey,setReceiptKey]=useState(newRequestKey);
  const [receipt,setReceipt]=useState<ReceiptDraft>({variantId:'',quantity:'',reference:''});
  const generation=useRef(0),listRefresh=useRef<HTMLButtonElement>(null);const route=mode==='mine'?'my-orders':'orders';
  const query=new URLSearchParams({page:String(page),pageSize:String(pageSize),...(campaignId?{campaignId}:{}),...Object.fromEntries(Object.entries(filters).filter(([,value])=>value))}).toString();
  const load=useCallback(async()=>{
    const current=++generation.current;setLoading(true);
    setFeedback('');try{const result=await api<OrderList>(`/commercial/${route}?${query}`);if(current===generation.current){setData(result);setError('');setDenied(false);}}
    catch(e){if(current===generation.current){setError(failure(e));setDenied((e as {code?:string}).code==='forbidden');}}
    finally{if(current===generation.current)setLoading(false);}
  },[query,route]);
  useEffect(()=>{void load();return()=>{++generation.current;};},[load]);
  useEffect(()=>{setPage(1);setDraft(emptyOrderDraft());setRequestKey(newRequestKey());setReceipt({variantId:'',quantity:'',reference:''});setReceiptKey(newRequestKey());},[campaignId]);
  const filter=(patch:Partial<typeof filters>)=>{setFilters({...filters,...patch});setPage(1);};
  const open=async(kind:Flow,id?:string,preserveFocus=false)=>{
    if(!preserveFocus)setReturnFocus(document.activeElement instanceof HTMLElement?document.activeElement:null);setBusy(true);setFormError('');
    try{
      if(kind==='detail')setDetail(await api<OrderDetail>(`/commercial/${route}/${id}`));
      if(kind==='settings')setSettings(await api<OrderSettings>('/commercial/settings'));
      if(kind==='production')setProduction(await api<Production>(`/commercial/campaigns/${campaignId}/production`));
      if(kind==='create'&&mode==='admin'){const [b,s]=await Promise.all([api<{id:string;name:string}[]>('/commercial/buyers'),api<OrderSettings>('/commercial/settings')]);setBuyers(b);setSettings(s);}
      setFlow(kind);
    }catch(e){setError(failure(e));}finally{setBusy(false);}
  };
  const mutate=async(path:string,body:object,method='POST')=>{
    if(busy)return;setBusy(true);setFormError('');
    setFeedback('');try{const result=await api<{id?:string}>(path,{method,body:JSON.stringify(body)});setFeedback('Operação registrada.');await load();await onInventoryChange?.();window.dispatchEvent(new Event('caehub:agenda-updated'));return result;}
    catch(e){setFormError(failure(e));return undefined;}finally{setBusy(false);}
  };
  const refreshDetail=async()=>{if(!detail||busy)return;setBusy(true);setFormError('');setFeedback('');try{setDetail(await api<OrderDetail>(`/commercial/${route}/${detail.order.id}`));await load();}catch(e){setFormError(failure(e));}finally{setBusy(false);}};
  const create=async()=>{
    const items=draft.items.map(line=>{const v=catalog!.variants.find(v=>v.id===line.variantId),p=catalog!.products.find(p=>p.id===v?.productId);return {variantId:line.variantId,quantity:Number(line.quantity),expectedPriceCents:p!.saleCents};});
    const result=await mutate(`/commercial/${mode==='mine'?'my-orders':'orders'}`,{campaignId,requestKey,items,...(mode==='admin'?{...(draft.buyerPersonId?{buyerPersonId:draft.buyerPersonId}:{buyerName:draft.buyerName}),buyerContact:draft.buyerContact}:{})});
    if(result?.id){setDraft(emptyOrderDraft());setRequestKey(newRequestKey());await open('detail',result.id,true);}
  };
  const act=async(body:{action:string;note:string;version:number;requestKey:string;incidentId?:string})=>{
    const result=await mutate(`/commercial/orders/${detail!.order.id}/actions`,body);
    if(result){await refreshDetail();return true;}return false;
  };
  const refreshProduction=async()=>{setBusy(true);try{setProduction(await api<Production>(`/commercial/campaigns/${campaignId}/production`));}catch(e){setFormError(failure(e));}finally{setBusy(false);}};
  const reloadSettings=async()=>{setBusy(true);try{setSettings(await api<OrderSettings>('/commercial/settings'));setFormError('');}catch(e){setFormError(failure(e));}finally{setBusy(false);}};
  const receive=async()=>{const result=await mutate(`/commercial/campaigns/${campaignId}/production/receipts`,{id:receiptKey,variantId:receipt.variantId,quantity:Number(receipt.quantity),reference:receipt.reference});if(result){setReceiptKey(newRequestKey());setReceipt({...receipt,quantity:'',reference:''});await refreshProduction();}};
  const start=async(variantId:string)=>{if(await mutate(`/commercial/campaigns/${campaignId}/production/start`,{variantId}))await refreshProduction();};
  const close=()=>{if(busy)return;const fallback=!returnFocus?.isConnected?listRefresh.current:null;setFlow(undefined);if(initialOrderId&&mode==='mine')location.hash='#/meus-pedidos';if(fallback)setTimeout(()=>fallback.focus(),0);};
  useEffect(()=>{if(initialOrderId)void open('detail',initialOrderId);},[initialOrderId]);
  if(!data)return denied?<AccessDeniedState/>:error?<ErrorState onRetry={()=>void load()}/>:<LoadingState/>;
  const campaign=catalog?.campaigns.find(c=>c.id===campaignId),canCreate=(data.canManage||mode==='mine')&&campaign?.status==='active';
  const title=flow==='create'?(mode==='mine'?'Registrar meu pedido':'Registrar pedido'):flow==='settings'?'Reservas e instruções Pix':flow==='production'?'Produção e recebimentos':'Detalhes do pedido';
  return <section className="commercial-catalog-section commercial-orders" aria-busy={loading}>
    <div className="compact-heading"><div><Eyebrow>{data.canManage?'OPERAÇÃO COMERCIAL':'MEUS PEDIDOS'}</Eyebrow><h2>{mode==='mine'?'O que você comprou.':'Da compra à retirada.'}</h2></div><div className="card-actions">
      <Button ref={listRefresh} disabled={busy||loading} onClick={()=>void load()}>Atualizar pedidos</Button>
      {data.canManage&&<><Button disabled={busy} onClick={()=>void open('settings')}>Reservas e Pix</Button>{campaignId&&<Button disabled={busy} onClick={()=>void open('production')}>Produção e recebimentos</Button>}</>}
      {canCreate&&<Button variant="primary" disabled={busy} onClick={()=>void open('create')}>{mode==='mine'?'Fazer pedido':'Registrar pedido'}</Button>}
    </div></div>
    {data.canManage&&!campaignId&&<p>Selecione uma campanha para registrar pedidos e acompanhar a produção.</p>}
    <Toast message={feedback}/>{error&&<p className="form-feedback error" role="alert">{error}<Button onClick={()=>void load()}>Atualizar</Button></p>}
    <div className={`commercial-metrics ${mode==='mine'?'buyer-metrics':''}`}><span><strong>{data.summary.total}</strong> pedidos</span><span><strong>{data.summary.paymentPending}</strong> {mode==='mine'?'aguardando pagamento':'pagamentos a conferir'}</span>{mode==='admin'&&<span><strong>{data.summary.review}</strong> em revisão</span>}<span><strong>{data.summary.ready}</strong> {mode==='mine'?'para retirada':'prontos'}</span><span><strong>{data.summary.completed}</strong> {mode==='mine'?'já retirados':'concluídos'}</span>{data.canManage&&<span><strong>{data.summary.refunds}</strong> reembolsos pendentes</span>}</div>
    <details className="commercial-order-filters" open={mode==='admin'?true:undefined}><summary>Filtrar pedidos</summary><div className="commercial-filters form-fields">
      <label>Buscar pedido<input type="search" value={filters.search} onChange={e=>filter({search:e.target.value})} placeholder={mode==='mine'?'Identificador do pedido':'Comprador ou identificador'}/></label>
      <label>Situação do pedido<select value={filters.status} onChange={e=>filter({status:e.target.value})}><option value="">Todas</option>{['pending','confirmed','review','expired','completed','cancelled'].map(s=><option key={s} value={s}>{orderLabels[s]}</option>)}</select></label>
      <label>Pagamento<select value={filters.paymentStatus} onChange={e=>filter({paymentStatus:e.target.value})}><option value="">Todos</option><option value="unconfirmed">A conferir</option>{['pending','problem','paid','refund_required','refunded'].map(s=><option key={s} value={s}>{orderLabels[s]}</option>)}</select></label>
      <label>Retirada<select value={filters.deliveryStatus} onChange={e=>filter({deliveryStatus:e.target.value})}><option value="">Todas</option>{['waiting','ready','collected'].map(s=><option key={s} value={s}>{orderLabels[s]}</option>)}</select></label>
      {data.canManage&&<label>Pendências<select value={filters.issues} onChange={e=>filter({issues:e.target.value})}><option value="">Todos os pedidos</option><option value="open">Com pendência aberta</option></select></label>}
    </div></details>
    {loading&&<p role="status">Atualizando pedidos…</p>}
    {!data.orders.length?<EmptyState title="Nenhum pedido neste filtro.">{mode==='mine'?'Se você já comprou, confira os filtros ou consulte todos os seus pedidos.':'Ajuste os filtros ou registre um pedido na campanha selecionada.'}</EmptyState>:<div className={`commercial-order-list ${mode==='mine'?'buyer-order-list':''}`}>{data.orders.map(o=><article className={`commercial-product ${mode==='mine'?'buyer-order-card':''}`} key={o.id}>
      <header><strong>{mode==='mine'?o.campaignName:o.buyerName}</strong><Badge tone={o.deliveryStatus==='ready'?'active':o.status==='review'||o.status==='expired'?'waiting':'neutral'}>{mode==='mine'?buyerOrderLabel(o):orderLabels[o.status]}</Badge></header>
      <p>{mode==='mine'?`Pedido ${o.id.slice(0,8)} · ${orderTime(o.createdAt)}`:`${o.campaignName} · ${orderTime(o.createdAt)}`}</p>
      {mode==='mine'&&<ul className="buyer-purchased-items">{o.items?.map(item=><li key={item.id}><div><strong>{item.productName}</strong><span>{item.variantName}</span></div><div><strong>{item.quantity} {item.quantity===1?'unidade':'unidades'}</strong><span>{o.deliveryStatus==='collected'?'Já retirado':o.deliveryStatus==='ready'?'Para retirada':item.fulfillment==='preorder'?(o.status==='cancelled'?'Cancelado':o.paymentStatus!=='paid'?'Aguardando pagamento':item.productionStatus==='waiting'?'Aguardando produção':orderLabels[item.productionStatus]??'Encomenda'):'Produto físico'}</span></div></li>)}</ul>}
      <div className="card-actions"><Badge>{mode==='mine'?`Pagamento: ${o.paymentStatus==='paid'?'confirmado':orderLabels[o.paymentStatus]}`:orderLabels[o.paymentStatus]}</Badge>{mode==='admin'&&<Badge>{orderLabels[o.deliveryStatus]}</Badge>}{data.canManage&&Number(o.openIssues)>0&&<Badge tone="waiting">{o.openIssues} pendência(s)</Badge>}</div>
      <footer><div><small>Total do pedido</small><strong>{money(Number(o.totalCents))}</strong></div><Button disabled={busy||loading} onClick={()=>void open('detail',o.id)}>Ver pedido</Button></footer>
      {mode==='admin'&&<small className="commercial-order-id">{o.id}</small>}
    </article>)}</div>}
    <div className="commercial-pagination form-fields"><p>{data.total} pedidos encontrados{data.pages>1&&` · Página ${data.page} de ${data.pages}`}</p>{(mode==='admin'||data.total>10)&&<><div className="card-actions"><Button disabled={page<=1||loading||busy} onClick={()=>setPage(page-1)}>Anterior</Button><Button disabled={page>=data.pages||loading||busy} onClick={()=>setPage(page+1)}>Próxima</Button></div><label>Por página<select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}>{[10,20,50].map(n=><option key={n} value={n}>{n}</option>)}</select></label></>}</div>
    {flow&&<Dialog title={title} size="wide" returnFocus={returnFocus} onClose={close}>
      {formError&&<p role="alert" className="form-feedback error">{formError}</p>}
      {flow==='create'&&catalog&&campaignId&&<CommercialOrderForm catalog={mode==='admin'?{...catalog,reservationMinutes:settings?.reservationMinutes}:catalog} campaignId={campaignId} draft={draft} onChange={setDraft} onSubmit={()=>void create()} busy={busy} buyers={mode==='admin'?buyers:undefined} refresh={()=>void onInventoryChange?.()}/>}
      {flow==='detail'&&detail&&<CommercialOrderDetail key={`${detail.order.id}-${detail.order.version}`} detail={detail} busy={busy} refresh={()=>void refreshDetail()} onAction={act}/>}
      {flow==='production'&&production&&catalog&&campaignId&&<CommercialProduction data={production} catalog={catalog} campaignId={campaignId} busy={busy} draft={receipt} onChange={setReceipt} onReceive={()=>void receive()} onStart={id=>void start(id)}/>}
      {flow==='settings'&&settings&&<form className="form-fields commercial-form" onSubmit={async e=>{e.preventDefault();if(await mutate('/commercial/settings',settings,'PUT'))setFlow(undefined);}}><fieldset disabled={busy}><p>Defina o prazo para novos pedidos. Comprovante enviado não confirma pagamento; Pix exige conferência do recebimento real.</p><label>Prazo da reserva (minutos)<input type="number" min="1" max="10080" step="1" required value={settings.reservationMinutes??''} onChange={e=>setSettings({...settings,reservationMinutes:e.target.value?Number(e.target.value):null})}/></label><div className="card-actions">{[120,1440,2880].map(minutes=><Button type="button" key={minutes} onClick={()=>setSettings({...settings,reservationMinutes:minutes})}>{minutes/60} horas</Button>)}</div><label>Instruções Pix<textarea maxLength={2000} value={settings.pixInstructions} onChange={e=>setSettings({...settings,pixInstructions:e.target.value})} placeholder="Preencha somente com dados reais aprovados."/></label><Button type="button" onClick={()=>void reloadSettings()}>Recarregar configuração</Button><Button variant="primary" disabled={busy}>{busy?'Salvando…':'Salvar configuração'}</Button></fieldset></form>}
    </Dialog>}
  </section>;
}
