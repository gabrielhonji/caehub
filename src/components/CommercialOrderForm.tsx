import type { OrderDraft, SaleCatalog } from '../services/commercial-orders';
import { money } from '../services/commercial';
import { Button } from './primitives';

export function CommercialOrderForm({catalog,campaignId,draft,onChange,onSubmit,busy,buyers,refresh}:{catalog:SaleCatalog;campaignId:string;draft:OrderDraft;onChange:(draft:OrderDraft)=>void;onSubmit:()=>void;busy:boolean;buyers?:{id:string;name:string}[];refresh:()=>void}){
  const campaign=catalog.campaigns.find(c=>c.id===campaignId);
  const variants=catalog.variants.filter(v=>v.status==='active'&&catalog.products.some(p=>p.id===v.productId&&p.status==='active'&&p.saleCents!==null&&(buyers!==undefined||p.mode==='physical'||campaign?.stage==='orders')&&catalog.links.some(l=>l.productId===p.id&&l.campaignId===campaignId)));
  const selected=draft.items.map(line=>{const v=variants.find(v=>v.id===line.variantId),p=catalog.products.find(p=>p.id===v?.productId);return {v,p,quantity:Number(line.quantity),preorder:p?.mode==='preorder'&&campaign?.stage==='orders'};});
  const total=selected.reduce((n,row)=>n+(row.p?.saleCents??0)*row.quantity,0);
  const valid=selected.length>0&&selected.every(row=>row.p&&row.v&&Number.isInteger(row.quantity)&&row.quantity>0&&row.quantity<=1000000&&(row.preorder||row.quantity<=row.v.availableQuantity));
  const missingReservation=catalog.reservationMinutes===null&&selected.some(row=>row.p&&!row.preorder);
  const updateLine=(index:number,patch:Partial<OrderDraft['items'][number]>)=>onChange({...draft,items:draft.items.map((line,i)=>i===index?{...line,...patch}:line)});
  return <form className="form-fields commercial-form" onSubmit={e=>{e.preventDefault();onSubmit();}}><fieldset disabled={busy}>
    <p><strong>{campaign?.name}</strong> · {campaign?.stage==='collection'?'Somente unidades físicas livres; novas encomendas encerradas.':'Produtos físicos têm reserva provisória. Encomendas são produzidas após a confirmação do pagamento.'}</p>
    {buyers&&<><label>Comprador cadastrado<select value={draft.buyerPersonId} onChange={e=>onChange({...draft,buyerPersonId:e.target.value})}><option value="">Comprador externo (cadastro administrativo)</option>{buyers.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>{!draft.buyerPersonId&&<label>Nome do comprador externo<input required maxLength={255} value={draft.buyerName} onChange={e=>onChange({...draft,buyerName:e.target.value})}/></label>}<label>Contato para operação (opcional)<input maxLength={255} value={draft.buyerContact} onChange={e=>onChange({...draft,buyerContact:e.target.value})}/></label></>}
    {!buyers&&<aside className="checkout-guidance"><strong>Confira seus itens antes de confirmar</strong><p>O pedido fica na sua conta Honji. Após confirmar, você recebe os dados do Pix; a equipe confere o pagamento manualmente.</p></aside>}
    {draft.items.map((line,index)=>{const row=selected[index];return <div className="commercial-order-line" key={index} data-item-number={`${index+1}º`}>
      {!buyers&&row.p&&row.v?<div className="checkout-product"><strong>{row.p.name}</strong><span>{row.v.name}</span><small>{money(row.p.saleCents)} por unidade · {row.preorder?'Sob encomenda':'Pronta entrega'}</small></div>:      <label>Produto e variação<select required value={line.variantId} onChange={e=>updateLine(index,{variantId:e.target.value})}><option value="">Selecione</option>{variants.map(v=>{const p=catalog.products.find(p=>p.id===v.productId)!;const preorder=p.mode==='preorder'&&campaign?.stage==='orders';return <option key={v.id} value={v.id} disabled={draft.items.some((l,i)=>i!==index&&l.variantId===v.id)||(!preorder&&v.availableQuantity<=0)}>{p.name} · {v.name} · {money(p.saleCents)} · {preorder?'Encomenda':`${v.availableQuantity} livres`}</option>})}</select></label>}
      <label>Quantidade<input type="number" min="1" max="1000000" step="1" required value={line.quantity} onChange={e=>updateLine(index,{quantity:e.target.value})}/></label>
      {row.p&&<p className="commercial-line-total">{row.preorder?'Sob encomenda':`${row.v?.availableQuantity??0} unidades livres`} · subtotal {money(Number.isFinite(row.quantity)?(row.p.saleCents??0)*row.quantity:0)}{row.v&&!row.preorder&&row.quantity>row.v.availableQuantity&&<span role="alert">Quantidade maior que o estoque livre. Atualize ou reduza o item.</span>}</p>}
      {draft.items.length>1&&<Button variant="danger" type="button" onClick={()=>onChange({...draft,items:draft.items.filter((_,i)=>i!==index)})}>Remover {index+1}º item</Button>}
    </div>})}
    <div className="card-actions"><Button type="button" disabled={draft.items.length>=100||draft.items.some(item=>!item.variantId)} onClick={()=>onChange({...draft,items:[...draft.items,{variantId:'',quantity:'1'}]})}>Adicionar item</Button><Button type="button" onClick={refresh}>Atualizar catálogo</Button></div>
    <div className="commercial-total" role="status"><span>Total previsto</span><strong>{money(Number.isFinite(total)?total:0)}</strong><small>O sistema valida preço e disponibilidade novamente ao registrar.</small></div>
    {missingReservation&&<p role="alert">O prazo da reserva ainda precisa ser configurado pela equipe para vender produtos físicos.</p>}
    <Button variant="primary" disabled={busy||!valid||missingReservation||campaign?.status!=='active'}>{busy?'Registrando…':buyers?'Registrar pedido':'Confirmar meu pedido'}</Button>
  </fieldset></form>;
}
