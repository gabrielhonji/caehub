import { useState } from 'react';
import { money } from '../services/commercial';
import { actionLabels, newRequestKey, nextOrderStep, orderEventLabel, orderLabels, orderTime, type OrderDetail } from '../services/commercial-orders';
import { Badge, Button } from './primitives';

export function CommercialOrderDetail({detail,busy,refresh,onAction}:{detail:OrderDetail;busy:boolean;refresh:()=>void;onAction:(body:{action:string;note:string;version:number;requestKey:string;incidentId?:string})=>Promise<boolean>}){
  const [action,setAction]=useState(''),[note,setNote]=useState(''),[incidentId,setIncidentId]=useState(''),[requestKey,setRequestKey]=useState(newRequestKey);
  const [ack,setAck]=useState(false);const o=detail.order;
  const choose=(action:string,id='')=>{setAction(action);setIncidentId(id);setAck(false);setRequestKey(newRequestKey());};
  const requiresAcknowledgement=['pay','refund','cancel','collect'].includes(action);
  const acknowledgement:Record<string,string>={pay:'Conferi o recebimento real do Pix, além do comprovante enviado.',refund:'Conferi a comprovação de que o reembolso manual foi realizado.',cancel:o.payment_status==='paid'?'Entendo que o cancelamento libera os itens e deixa o reembolso manual pendente.':'Conferi o pedido e autorizo liberar a reserva.',collect:'Conferi todos os itens e a entrega efetiva ao comprador.'};
  return <>
    <p className="commercial-order-id">Pedido {o.id}</p><h3>{o.buyer_name}</h3>{o.buyer_contact&&<p>{o.buyer_contact}</p>}
    <div className="card-actions"><Badge>{orderLabels[o.status]}</Badge><Badge>{orderLabels[o.payment_status]}</Badge><Badge>{orderLabels[o.delivery_status]}</Badge></div>
    <p className="commercial-next-step" role="status">{nextOrderStep(detail)}</p>
    <p>Total registrado: <strong>{money(Number(o.total_cents))}</strong></p>{o.paid_at&&<p>Pagamento conferido em {orderTime(o.paid_at)}.</p>}{o.collected_at&&<p>Retirada em {orderTime(o.collected_at)}.</p>}
    <ul className="commercial-order-items">{detail.items.map(i=><li key={i.id}><strong>{i.product_name} · {i.variant_name}</strong><span>{i.quantity} × {money(i.unit_price_cents)} · {orderLabels[i.production_status]}</span><span>{orderLabels[i.allocation_status]} · {i.allocated_quantity}/{i.quantity} unidades</span>{i.expires_at&&i.allocation_status==='provisional'&&<span>Reserva até {orderTime(i.expires_at)}</span>}</li>)}</ul>
    {o.payment_status!=='paid'&&!['cancelled','completed','expired'].includes(o.status)&&<><h3>Pagamento Pix</h3><p className="commercial-pix">{detail.pixInstructions||'Instruções Pix ainda não configuradas. Consulte o responsável pela campanha.'}</p><p>Comprovante enviado não confirma pagamento. Aguarde a conferência da equipe.</p></>}
    <div className="card-actions"><Button disabled={busy} onClick={refresh}>Atualizar detalhes</Button></div>
    {detail.canManage&&<>
      <h3>Operar este pedido</h3><div className="card-actions">{detail.availableActions.map(a=><Button key={a} type="button" disabled={busy} aria-pressed={action===a} onClick={()=>choose(a)}>{actionLabels[a]}</Button>)}</div>
      {!detail.availableActions.includes('cancel')&&!['completed','cancelled'].includes(o.status)&&<p>Há itens enviados à produção. Abra uma pendência para tratar o caso com o responsável.</p>}
      {action&&<form className="form-fields commercial-form" onSubmit={async e=>{e.preventDefault();if(await onAction({action,note,version:o.version,requestKey,...(incidentId?{incidentId}:{})})){setAction('');setNote('');setAck(false);setRequestKey(newRequestKey());}}}><fieldset disabled={busy}><h4>{actionLabels[action]}</h4><label>Justificativa ou referência da conferência<textarea required maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/></label>{requiresAcknowledgement&&<label className="commercial-ack"><input type="checkbox" required checked={ack} onChange={e=>setAck(e.target.checked)}/><span>{acknowledgement[action]}</span></label>}<Button variant="primary" disabled={busy||!note.trim()||(requiresAcknowledgement&&!ack)}>{busy?'Registrando…':'Registrar operação'}</Button></fieldset></form>}
      <h3>Pendências administrativas</h3>{!detail.incidents.length?<p>Nenhuma ocorrência registrada.</p>:<ul className="commercial-order-items">{detail.incidents.map(i=><li key={i.id}><Badge tone={i.status==='open'?'waiting':'neutral'}>{i.status==='open'?'Aberta':'Resolvida'}</Badge><strong>{i.note}</strong><span>{i.actor} · {orderTime(i.createdAt)}</span>{i.resolution&&<><span>{i.resolution}</span><span>{i.resolvedBy} · {i.resolvedAt&&orderTime(i.resolvedAt)}</span></>}{i.status==='open'&&<Button disabled={busy} onClick={()=>choose('resolve_exception',i.id)}>Resolver pendência</Button>}</li>)}</ul>}
    </>}
    <h3>Histórico</h3><ol className="commercial-order-items">{detail.events.map(e=><li key={e.id}><strong>{orderEventLabel(e.action)}</strong><span>{e.actor?`${e.actor} · `:''}{orderTime(e.createdAt)}</span>{e.note&&<span>{e.note}</span>}</li>)}</ol>
  </>;
}
