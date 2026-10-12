import { useEffect, useRef, useState } from 'react';
import { HonjiBrand } from './Brand';
import { Badge, Button, Dialog, EmptyState, ErrorState, Eyebrow, LoadingState } from './primitives';
import { CommercialOrderForm } from './CommercialOrderForm';
import { CommercialOrderDetail } from './CommercialOrderDetail';
import { CommercialOrders } from './CommercialOrders';
import { api } from '../services/spaces';
import { money } from '../services/commercial';
import { emptyOrderDraft, newRequestKey, type OrderDetail, type OrderDraft, type SaleCatalog } from '../services/commercial-orders';
import { readTheme, saveTheme } from '../services/theme';
import '../styles/commercial.css';
import '../styles/public-portal.css';

const selectionKey='caehub-public-selection';
type Selection={campaignId:string;items:OrderDraft['items'];requestKey:string};
function restore():Selection|undefined{try{const v=JSON.parse(sessionStorage.getItem(selectionKey)??'null');if(v&&typeof v.campaignId==='string'&&typeof v.requestKey==='string'&&Array.isArray(v.items)&&v.items.length<=100&&v.items.every((i:unknown)=>i&&typeof i==='object'&&'variantId' in i&&typeof i.variantId==='string'&&'quantity' in i&&typeof i.quantity==='string'))return v;}catch{/* Temporary selection is optional. */}}

export function PublicPortal(){
  const saved=useRef(restore());
  const [catalog,setCatalog]=useState<SaleCatalog>(),[error,setError]=useState(false),[canBuy,setCanBuy]=useState(false);
  const [campaignId,setCampaignId]=useState(saved.current?.campaignId??''),[draft,setDraft]=useState<OrderDraft>(()=>({...emptyOrderDraft(),items:saved.current?.items??[]}));
  const [requestKey,setRequestKey]=useState(saved.current?.requestKey??newRequestKey()),[productId,setProductId]=useState(''),[variantId,setVariantId]=useState(''),[quantity,setQuantity]=useState('1');
  const [checkout,setCheckout]=useState(false),[busy,setBusy]=useState(false),[formError,setFormError]=useState(''),[detail,setDetail]=useState<OrderDetail>();
  const submitting=useRef(false);
  const [ordersVersion,setOrdersVersion]=useState(0);
  const [notice,setNotice]=useState('');
  const [theme,setTheme]=useState(()=>readTheme()??(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
  const load=async()=>{try{const next=await api<SaleCatalog>('/public/catalog');setCatalog(next);setCampaignId(current=>current||next.campaigns[0]?.id||'');setError(false);}catch{setError(true);}};
  useEffect(()=>{void load();void api<{canBuy:boolean}>('/public/buyer-status').then(v=>setCanBuy(v.canBuy)).catch(()=>setCanBuy(false));},[]);
  useEffect(()=>{document.documentElement.dataset.theme=theme;saveTheme(theme);},[theme]);
  useEffect(()=>{try{if(draft.items.length)sessionStorage.setItem(selectionKey,JSON.stringify({campaignId,items:draft.items,requestKey}));else sessionStorage.removeItem(selectionKey);}catch{/* Selection still works in memory. */}},[campaignId,draft.items,requestKey]);
  const campaign=catalog?.campaigns.find(c=>c.id===campaignId);
  const products=catalog?.products.filter(p=>catalog.links.some(l=>l.campaignId===campaignId&&l.productId===p.id))??[];
  const product=products.find(p=>p.id===productId),variants=catalog?.variants.filter(v=>v.productId===product?.id)??[],variant=variants.find(v=>v.id===variantId);
  const preorder=product?.mode==='preorder'&&campaign?.stage==='orders';
  const valid=variant&&Number.isInteger(Number(quantity))&&Number(quantity)>0&&Number(quantity)<=1000000&&(preorder||Number(quantity)<=variant.availableQuantity);
  const chooseCampaign=(id:string)=>{if(id===campaignId)return;setCampaignId(id);setProductId('');setDraft({...emptyOrderDraft(),items:[]});setRequestKey(newRequestKey());setFormError('');};
  const add=()=>{if(!valid)return;const line=draft.items.find(i=>i.variantId===variantId);const nextQuantity=(line?Number(line.quantity):0)+Number(quantity);if(!preorder&&nextQuantity>variant.availableQuantity){setFormError('A quantidade selecionada supera o estoque livre. Reduza os itens.');return;}setDraft({...draft,items:line?draft.items.map(i=>i===line?{...i,quantity:String(nextQuantity)}:i):[...draft.items,{variantId,quantity}]});setRequestKey(newRequestKey());setProductId('');setFormError('');};
  const total=draft.items.reduce((sum,line)=>{const v=catalog?.variants.find(v=>v.id===line.variantId),p=products.find(p=>p.id===v?.productId);return sum+(p?.saleCents??0)*Number(line.quantity);},0);
  const changeDraft=(next:OrderDraft)=>{setDraft(next);setRequestKey(newRequestKey());};
  const refreshDetail=async()=>{
    if(!detail||busy)return;setBusy(true);setFormError('');
    try{setDetail(await api<OrderDetail>(`/commercial/my-orders/${detail.order.id}`));}
    catch{setFormError('Não foi possível atualizar o pedido. Tente novamente.');}
    finally{setBusy(false);}
  };
  const submit=async()=>{
    if(submitting.current||!catalog)return;submitting.current=true;setBusy(true);setFormError('');
    let registered=false;
    try{
      const items=draft.items.map(line=>{const v=catalog.variants.find(v=>v.id===line.variantId),p=products.find(p=>p.id===v?.productId);if(!p)throw new Error('Um item não está mais disponível nesta campanha. Atualize e corrija a seleção.');return {variantId:line.variantId,quantity:Number(line.quantity),expectedPriceCents:p.saleCents};});
      const result=await api<{id:string}>('/commercial/my-orders',{method:'POST',body:JSON.stringify({campaignId,requestKey,items})});
      registered=true;setNotice(`Pedido ${result.id} registrado. Acompanhe em Meus pedidos.`);
      setDraft({...emptyOrderDraft(),items:[]});setRequestKey(newRequestKey());setCheckout(false);
      setOrdersVersion(value=>value+1);
      setDetail(await api<OrderDetail>(`/commercial/my-orders/${result.id}`));await load();
    }catch(e){if(registered)setNotice('O pedido foi registrado. Atualize Meus pedidos para consultar os detalhes e o Pix.');else setFormError(e instanceof TypeError?'Não foi possível alcançar o sistema. Tente novamente com a mesma seleção.':(e as Error).message);}finally{submitting.current=false;setBusy(false);}
  };
  return <div className="app-shell public-portal"><a className="skip-link" href="#content">Pular para o conteúdo</a>
    <header className="site-header"><div className="header-inner"><div className="navbar-brands"><HonjiBrand/><span className="navbar-divider"/><a href="/" className="public-wordmark">CAEHUB</a></div><nav aria-label="Portal público"><a href="#campanhas">Lojinha</a><a href="#pedidos">Meus pedidos</a><a href="/#/espacos">Área interna</a></nav><Button onClick={()=>setTheme(theme==='light'?'dark':'light')} aria-label={`Ativar tema ${theme==='light'?'escuro':'claro'}`}>{theme==='light'?'Escuro':'Claro'}</Button></div></header>
    <main id="content" className="content"><section className="commercial-heading public-intro"><div><Eyebrow>01 / HONJI + CAECOMP</Eyebrow><h1>Feito para reunir.<br/><em>Também para levar.</em></h1><p>O CAEHUB conecta a gestão, a colaboração e as campanhas do CAECOMP. Desenvolvido por Honji em parceria com o Centro Acadêmico de Engenharia de Computação.</p><div className="card-actions"><a className="button button-primary" href="#campanhas">Conhecer a lojinha ↓</a><a className="button button-secondary" href="/auth/login">Entrar com Honji</a></div></div><aside><Eyebrow>DO PEDIDO À RETIRADA</Eyebrow><h2>Uma campanha.<br/>Duas etapas.</h2><p>Escolha durante as vendas e encomendas. Acompanhe o pagamento, a produção e a retirada pela sua conta.</p><p>O Pix é conferido manualmente pela equipe.</p></aside></section>
    <section id="campanhas" className="commercial-campaign-section"><div className="compact-heading"><div><Eyebrow>02 / LOJINHA</Eyebrow><h2>As campanhas do CAECOMP.</h2></div><Button onClick={()=>void load()}>Atualizar catálogo</Button></div>
    {!catalog?(error?<ErrorState onRetry={()=>void load()}/>:<LoadingState/>):<>{error&&<p role="alert">Não foi possível atualizar. Confira novamente antes de comprar.</p>}{!catalog.campaigns.length?<EmptyState title="Novas campanhas vêm por aí.">Quando a equipe abrir uma campanha, seus produtos aparecerão aqui.</EmptyState>:<><div className="commercial-campaigns" role="group" aria-label="Selecionar campanha">{catalog.campaigns.map(c=><button key={c.id} className="commercial-campaign" aria-pressed={c.id===campaignId} onClick={()=>chooseCampaign(c.id)}><span>{c.semester||'Semestre a definir'}</span><strong>{c.name}</strong><small>{c.stage==='orders'?'Vendas e encomendas':'Retirada e estoque'}</small></button>)}</div>{campaign?<><p>{campaign.description}</p><p>{campaign.stage==='orders'?'Produtos físicos e modelos exclusivos sob encomenda.':'Novas encomendas encerradas. Somente unidades físicas livres podem ser compradas.'}</p>{!products.length?<EmptyState title="O catálogo está sendo preparado.">Os produtos publicados aparecerão nesta campanha.</EmptyState>:<div className="commercial-catalog">{products.map(p=><article className="commercial-product" key={p.id}><div className="public-product-placeholder" aria-label="Produto sem imagem cadastrada"><span>{p.category}</span></div><header><Eyebrow>{p.category}</Eyebrow><Badge>{p.mode==='preorder'?'Modelo exclusivo':'Produto físico'}</Badge></header><h3>{p.name}</h3><p className="commercial-product-description">{p.description||'Consulte as variações disponíveis.'}</p><div className="commercial-product-price"><strong>{money(p.saleCents)}</strong><span>por unidade</span></div><Button onClick={()=>{setProductId(p.id);setVariantId(catalog.variants.find(v=>v.productId===p.id)?.id??'');setQuantity('1');setFormError('');}}>Ver produto</Button></article>)}</div>}</>:<p role="alert">A campanha selecionada não está mais aberta. Escolha outra campanha e confira seus itens.</p>}</>}</>}
    </section>
    {catalog&&draft.items.length>0&&<section className="commercial-catalog-section"><Eyebrow>SUA SELEÇÃO · {campaign?.name??'Campanha indisponível'}</Eyebrow><h2>Confira antes de pedir.</h2><p>A seleção ainda não reserva unidades. Trocar de campanha reinicia os itens.</p>{draft.items.map(line=>{const v=catalog.variants.find(v=>v.id===line.variantId),p=products.find(p=>p.id===v?.productId);return <div className="public-selection-line form-fields" key={line.variantId}><span>{p?.name??'Produto indisponível'} · {v?.name??'Variação indisponível'} · {line.quantity} unidades</span><label className="public-quantity">Quantidade de {p?.name??'item'}<input aria-label={`Quantidade de ${p?.name??'item'}`} type="number" min="1" max="1000000" value={line.quantity} onChange={e=>changeDraft({...draft,items:draft.items.map(i=>i===line?{...i,quantity:e.target.value}:i)})}/></label><strong>{money(Number.isFinite(Number(line.quantity))?(p?.saleCents??0)*Number(line.quantity):0)}</strong><Button onClick={()=>changeDraft({...draft,items:draft.items.filter(i=>i!==line)})}>Remover {p?.name??'item'}</Button></div>})}<div className="commercial-total"><span>Total estimado</span><strong>{money(Number.isFinite(total)?total:0)}</strong></div><Button variant="primary" onClick={()=>{setFormError('');setCheckout(true);}}>Conferir e concluir</Button></section>}
    {notice&&<p className="form-feedback success" role="status">{notice}</p>}<section id="pedidos" className="commercial-catalog-section"><Eyebrow>03 / SUA CONTA</Eyebrow>{canBuy?<CommercialOrders key={ordersVersion} mode="mine"/>:<><h2>Acompanhe seus pedidos.</h2><p>Entre com Honji para consultar suas compras. Neste momento, a compra pela conta está disponível para membros com vínculo ativo no CAECOMP. Compradores externos precisam procurar a equipe da campanha.</p><a className="button button-primary" href="/auth/login">Entrar com Honji</a></>}</section>
    </main><footer className="site-footer"><div className="footer-inner"><HonjiBrand/><div className="footer-organization"><strong>CAECOMP</strong><span>Centro Acadêmico de Engenharia de Computação</span></div><div className="footer-signature"><span>DESENVOLVIDO POR</span><a href="https://github.com/gabrielhonji">gabriel.honji</a><span>CAEHUB · {__APP_VERSION__}</span></div></div></footer>
    {product&&<Dialog title={product.name} onClose={()=>setProductId('')}><p>{product.description}</p><p>{campaign?.name} · {product.category}</p><Badge>{preorder?'Sob encomenda':'Estoque físico'}</Badge><form className="form-fields" onSubmit={e=>{e.preventDefault();add();}}><label>Variação<select aria-label="Variação" value={variantId} onChange={e=>setVariantId(e.target.value)}>{variants.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>{variant?.attributes&&<dl>{Object.entries(variant.attributes).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>}<p>{preorder?'Produzido sob encomenda após o pagamento.':`${variant?.availableQuantity??0} unidades livres`}</p><p>{money(product.saleCents)} por unidade</p><label>Quantidade<input type="number" min="1" max={preorder?1000000:Math.max(1,variant?.availableQuantity??0)} value={quantity} onChange={e=>setQuantity(e.target.value)} required/></label>{formError&&<p role="alert">{formError}</p>}<Button variant="primary" disabled={!valid||draft.items.length>=100}>Adicionar à seleção</Button></form></Dialog>}
    {checkout&&catalog&&<Dialog title="Conferir meu pedido" onClose={()=>{if(!busy)setCheckout(false);}}>{canBuy?<><CommercialOrderForm catalog={catalog} campaignId={campaignId} draft={draft} onChange={changeDraft} onSubmit={()=>void submit()} busy={busy} refresh={()=>void load()}/>{formError&&<p className="form-feedback error" role="alert">{formError}</p>}</>:<><p>Sua seleção fica guardada neste navegador durante esta sessão. Entre com sua conta Honji para continuar.</p><p>Compras pela conta exigem vínculo ativo no CAECOMP. Para compras externas, procure a equipe da campanha.</p><a className="button button-primary" href="/auth/login">Entrar com Honji</a></>}</Dialog>}
    {detail&&<Dialog title="Pedido registrado" onClose={()=>setDetail(undefined)}><CommercialOrderDetail detail={detail} busy={busy} onAction={async()=>false} refresh={()=>void refreshDetail()}/>{formError&&<p role="alert">{formError}</p>}</Dialog>}
  </div>;
}
