import {useRefresh} from '../hooks/useRefresh';
import {skipToContent} from '../services/navigation';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Brand, HonjiBrand } from './Brand';
import { ThemeToggle } from './ThemeToggle';
import { BuyerEmailVerification } from './BuyerEmailVerification';
import { Badge, Button, Dialog, EmptyState, ErrorState, Eyebrow, LoadingState } from './primitives';
import { CommercialOrderForm } from './CommercialOrderForm';
import { CommercialOrderDetail } from './CommercialOrderDetail';
import { CommercialOrders } from './CommercialOrders';
import { api, type SessionInfo } from '../services/spaces';
import { money } from '../services/commercial';
import { emptyOrderDraft, newRequestKey, commercialOrderFailure, type OrderDetail, type OrderDraft, type SaleCatalog } from '../services/commercial-orders';
import { readTheme, saveTheme } from '../services/theme';
import '../styles/commercial.css';
import '../styles/public-portal.css';

const selectionKey='caehub-public-selection';
type Selection={campaignId:string;items:OrderDraft['items'];requestKey:string};
function restore():Selection|undefined{
  try{
    const value=JSON.parse(sessionStorage.getItem(selectionKey)??'null');
    if(value&&typeof value.campaignId==='string'&&typeof value.requestKey==='string'&&Array.isArray(value.items)&&value.items.length<=100&&value.items.every((item:unknown)=>item&&typeof item==='object'&&'variantId' in item&&typeof item.variantId==='string'&&'quantity' in item&&typeof item.quantity==='string'))return value;
  }catch{/* The selection remains usable in memory. */}
}

export function PublicPortal({embedded=false,institutionalDenied=false}:{embedded?:boolean;institutionalDenied?:boolean}){
  const [saved]=useState(restore);
  const [catalog,setCatalog]=useState<SaleCatalog>(),[error,setError]=useState(false),[canBuy,setCanBuy]=useState(false),[checkingAccount,setCheckingAccount]=useState(true);
  const [needsStudentEmail,setNeedsStudentEmail]=useState(false);
  const [sessionDenied,setSessionDenied]=useState(false),[accountFailed,setAccountFailed]=useState(false);
  const [account,setAccount]=useState<SessionInfo>(),[signingOut,setSigningOut]=useState(false);
  const verification=location.hash.startsWith('#verificar-email');
  const ownOrderId=location.hash.startsWith('#/meus-pedidos/')?location.hash.split('/')[2]:undefined;
  const checkAccount=async()=>{setCheckingAccount(true);setAccountFailed(false);try{const value=await api<{canBuy:boolean;requiresStudentEmail?:boolean;sessionDenied?:boolean}>('/public/buyer-status');setCanBuy(value.canBuy);setNeedsStudentEmail(value.requiresStudentEmail===true);setSessionDenied(value.sessionDenied===true);if(value.canBuy||value.requiresStudentEmail)setAccount(await api<SessionInfo>('/me'));}catch{setCanBuy(false);setAccountFailed(true);}finally{setCheckingAccount(false);}};
  async function logout(){if(!account||signingOut)return;setSigningOut(true);try{const response=await fetch('/auth/logout',{method:'POST',headers:{'x-csrf-token':account.csrfToken??''}});const result=await response.json();if(!response.ok)throw new Error();location.assign(result.redirect);}catch{setNotice('Não foi possível sair agora. Tente novamente.');setSigningOut(false);}}
  const [campaignId,setCampaignId]=useState(saved?.campaignId??''),[draft,setDraft]=useState<OrderDraft>(()=>({...emptyOrderDraft(),items:saved?.items??[]}));
  const [requestKey,setRequestKey]=useState(saved?.requestKey??newRequestKey()),[productId,setProductId]=useState(''),[variantId,setVariantId]=useState(''),[quantity,setQuantity]=useState('1');
  const [checkout,setCheckout]=useState(false),[busy,setBusy]=useState(false),[formError,setFormError]=useState(''),[detail,setDetail]=useState<OrderDetail>();
  const submitting=useRef(false);
  const [ordersVersion,setOrdersVersion]=useState(0),[notice,setNotice]=useState(''),[pendingCampaign,setPendingCampaign]=useState('');
  const [theme,setTheme]=useState(()=>readTheme()??(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
  const load=async()=>{
    try{const next=await api<SaleCatalog>('/public/catalog');setCatalog(next);setCampaignId(current=>current||next.campaigns[0]?.id||'');setError(false);}
    catch{setError(true);}
  };
  useEffect(()=>{
    void load();
    void checkAccount();
  },[]);
  useEffect(()=>{if(!embedded){document.documentElement.dataset.theme=theme;saveTheme(theme);}},[theme,embedded]);
  useEffect(()=>{
    try{if(draft.items.length)sessionStorage.setItem(selectionKey,JSON.stringify({campaignId,items:draft.items,requestKey}));else sessionStorage.removeItem(selectionKey);}
    catch{/* No personal information is stored. */}
  },[campaignId,draft.items,requestKey]);
  const campaign=catalog?.campaigns.find(item=>item.id===campaignId);
  const collection=campaign?.stage==='collection';
  const products=catalog?.products.filter(item=>catalog.links.some(link=>link.campaignId===campaignId&&link.productId===item.id)&&(!collection||item.mode==='physical'))??[];
  const product=products.find(item=>item.id===productId);
  const variants=catalog?.variants.filter(item=>item.productId===product?.id)??[],variant=variants.find(item=>item.id===variantId);
  const preorder=product?.mode==='preorder'&&campaign?.stage==='orders';
  const valid=variant&&Number.isInteger(Number(quantity))&&Number(quantity)>0&&Number(quantity)<=1000000&&(preorder||Number(quantity)<=variant.availableQuantity);
  const changeCampaign=(id:string)=>{
    setCampaignId(id);setProductId('');setDraft({...emptyOrderDraft(),items:[]});setRequestKey(newRequestKey());setFormError('');setPendingCampaign('');
  };
  const chooseCampaign=(id:string)=>{if(id===campaignId)return;if(draft.items.length)setPendingCampaign(id);else changeCampaign(id);};
  const changeDraft=(next:OrderDraft)=>{setDraft(next);setRequestKey(newRequestKey());};
  const sectionLink=(event:MouseEvent<HTMLAnchorElement>,id:string)=>{if(embedded){event.preventDefault();document.getElementById(id)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}};
  const add=()=>{
    if(!valid)return;
    const line=draft.items.find(item=>item.variantId===variantId),nextQuantity=(line?Number(line.quantity):0)+Number(quantity);
    if(!preorder&&nextQuantity>variant.availableQuantity){setFormError('A quantidade supera o estoque disponível. Reduza os itens.');return;}
    changeDraft({...draft,items:line?draft.items.map(item=>item===line?{...item,quantity:String(nextQuantity)}:item):[...draft.items,{variantId,quantity}]});
    setProductId('');setFormError('');setNotice('Item adicionado à sua seleção. Confira abaixo antes de concluir.');
  };
  const selected=draft.items.map(line=>{
    const variant=catalog?.variants.find(item=>item.id===line.variantId),product=products.find(item=>item.id===variant?.productId),count=Number(line.quantity);
    const preorder=product?.mode==='preorder'&&campaign?.stage==='orders';
    return {line,variant,product,count,preorder,valid:Boolean(product&&variant&&Number.isInteger(count)&&count>0&&count<=1000000&&(preorder||count<=variant.availableQuantity))};
  });
  const total=selected.reduce((sum,item)=>sum+(item.product?.saleCents??0)*(Number.isFinite(item.count)?item.count:0),0);
  const refreshDetail=async()=>{
    if(!detail||busy)return;setBusy(true);setFormError('');
    try{setDetail(await api<OrderDetail>(`/commercial/my-orders/${detail.order.id}`));}
    catch{setFormError('Não foi possível atualizar o pedido. Tente novamente.');}
    finally{setBusy(false);}
  };
  const submit=async()=>{
    if(submitting.current||!catalog)return;submitting.current=true;setBusy(true);setFormError('');let registered=false;
    try{
      const items=selected.map(item=>{
        if(!item.valid||!item.product)throw new Error('Confira os itens indisponíveis e as quantidades antes de concluir.');
        return {variantId:item.line.variantId,quantity:item.count,expectedPriceCents:item.product.saleCents};
      });
      const result=await api<{id:string}>('/commercial/my-orders',{method:'POST',body:JSON.stringify({campaignId,requestKey,items})});
      registered=true;setNotice('Pedido registrado. Acompanhe o pagamento e a retirada em Meus pedidos.');
      setDraft({...emptyOrderDraft(),items:[]});setRequestKey(newRequestKey());setCheckout(false);setOrdersVersion(value=>value+1);
      setDetail(await api<OrderDetail>(`/commercial/my-orders/${result.id}`));await load();
    }catch(error){
      if(registered)setNotice('O pedido foi registrado. Atualize Meus pedidos para consultar os detalhes e o Pix.');
      else setFormError(commercialOrderFailure(error));
    }finally{submitting.current=false;setBusy(false);}
  };
  useRefresh(load);
  const accountProblem=accountFailed?<><ErrorState onRetry={()=>void checkAccount()}/><a className="button button-secondary" href="/acesso">Gerenciar minha sessão</a></>:sessionDenied?<div className="buyer-login-note"><p>Sua conta não está habilitada para comprar. O catálogo público continua disponível.</p><a className="button button-secondary" href="/acesso?status=denied">Gerenciar minha sessão</a></div>:undefined;
  const orders=<section id="pedidos" className="buyer-account-section">
    <div className="compact-heading"><div><Eyebrow>MINHA CONTA · {campaign?.name??'TODAS AS CAMPANHAS'}</Eyebrow><h2>{collection?'Seus pedidos e retiradas.':'Acompanhe suas compras.'}</h2></div>{canBuy&&<a className="button button-secondary" href="/#/meus-pedidos">Todos os meus pedidos →</a>}</div>
    {checkingAccount?<LoadingState/>:accountProblem??(canBuy?<CommercialOrders key={`${ordersVersion}-${campaignId}`} mode="mine" campaignId={ownOrderId?undefined:campaign?.id} initialOrderId={ownOrderId}/>:needsStudentEmail?<BuyerEmailVerification onVerified={()=>void checkAccount()}/>:<div className="buyer-login-note"><p>Entre com Honji para consultar suas encomendas e as quantidades do seu pedido. Nesta etapa, a equipe informa quando estão prontas para retirada.</p><a className="button button-primary" href="/auth/login?provider=google">Entrar ou criar conta com Google</a><a className="button button-secondary" href="/auth/login">Entrar com Honji</a><small>Compradores externos devem confirmar um e-mail @alunos.utfpr.edu.br. Confira também a caixa de spam.</small></div>)}
  </section>;
  const ownOrdersRoute=location.hash.startsWith('#/meus-pedidos');
  const content=ownOrdersRoute&&!embedded?<><section className="commercial-heading buyer-page-heading"><div><Eyebrow>MINHA CONTA</Eyebrow><h1>Meus pedidos.</h1><p>Produtos, pagamento e retirada de cada compra.</p><a className="button button-secondary" href="#/comercial/comprar">← Voltar à lojinha</a></div></section>{orders}</>:<>
    {institutionalDenied&&<p className="form-feedback" role="status">Sua conta pode usar a lojinha. O acesso institucional depende de concessão por um administrador.</p>}

    {verification&&<BuyerEmailVerification onVerified={()=>void checkAccount()}/>}
    <section className={`commercial-heading public-intro ${embedded?'buyer-page-heading':''}`}><div>
      <Eyebrow>{embedded?'COMERCIAL · MINHAS COMPRAS':'01 / HONJI + CAECOMP'}</Eyebrow>
      <h1>{embedded?<>Escolha, acompanhe,<br/><em>retire.</em></>:<>Feito para reunir.<br/><em>Também para levar.</em></>}</h1>
      <p>{embedded?'Escolha a campanha e os produtos. Acompanhe pagamento, produção e retirada em Meus pedidos.':'O CAEHUB reúne as campanhas e o trabalho do CAECOMP. Desenvolvido por Honji em parceria com o Centro Acadêmico de Engenharia de Computação.'}</p>
      <div className="card-actions"><a className="button button-primary" href={embedded?'#/comercial/comprar':'#campanhas'} onClick={event=>sectionLink(event,'campanhas')}>Conhecer a lojinha ↓</a><a className="button button-secondary" href={canBuy?'/#/meus-pedidos':'/auth/login'}>{canBuy?'Meus pedidos →':'Entrar com Honji'}</a></div>
    </div><aside><Eyebrow>DO PEDIDO À RETIRADA</Eyebrow><h2>Uma campanha.<br/>Duas etapas.</h2><p>Encomende durante as vendas. Na etapa de retirada, consulte apenas os seus itens e quantidades. Produtos físicos continuam na lojinha.</p><p>O Pix é conferido manualmente pela equipe.</p></aside></section>
    {!embedded&&account&&!account.institutionalAccess&&<section className="buyer-login-note member-account-entry" aria-label="Conta de membro do CAECOMP"><div><Eyebrow>JÁ É MEMBRO DO CAECOMP?</Eyebrow><h2>Ative seu acesso de membro.</h2><p>Se você já integra o CAECOMP, solicite o acesso institucional da sua conta Honji. A equipe confirma o vínculo e o departamento.</p></div><a className="button button-primary" href="https://gabriel.honji.com.br/#solicitar-acesso?project=CAECOMP">Solicitar conta CAEHUB</a><small>Este pedido é exclusivo para membros existentes do CAECOMP. Não é uma inscrição para entrar no centro acadêmico.</small></section>}
    {notice&&<p className="form-feedback success" role="status">{notice}</p>}
    <section id="campanhas" className="commercial-campaign-section">
      <div className="compact-heading"><div><Eyebrow>02 / CAMPANHAS</Eyebrow><h2>As campanhas do CAECOMP.</h2></div><Button onClick={()=>void load()}>Atualizar catálogo</Button></div>
      {!catalog?(error?<ErrorState onRetry={()=>void load()}/>:<LoadingState/>):<>
        {error&&<p role="alert">Não foi possível atualizar. Confira novamente antes de comprar.</p>}
        {!catalog.campaigns.length?<EmptyState title="Novas campanhas vêm por aí.">Seus pedidos anteriores continuam disponíveis na sua conta.</EmptyState>:<>
          <div className="commercial-campaigns" role="group" aria-label="Selecionar campanha">{catalog.campaigns.map(item=><button key={item.id} className="commercial-campaign" aria-pressed={item.id===campaignId} onClick={()=>chooseCampaign(item.id)}><span>{item.semester||'Semestre a definir'}</span><strong>{item.name}</strong><small>{item.stage==='orders'?'Vendas e encomendas':'Retirada e estoque'}</small></button>)}</div>
          {campaign?<div className="buyer-campaign-context"><Badge tone="active">{collection?'02 · Retirada':'01 · Vendas e encomendas'}</Badge>{campaign.description&&<p>{campaign.description}</p>}<p>{collection?'As encomendas encerraram. Consulte a página Meus pedidos. A lojinha oferece somente produtos físicos.':'Escolha os produtos físicos ou faça sua encomenda dos modelos desta campanha.'}</p></div>:<p role="alert">A campanha selecionada não está mais aberta. Escolha outra e confira seus itens.</p>}
        </>}
      </>}
    </section>

    {campaign&&catalog&&<section className="commercial-catalog-section">
      <div className="compact-heading"><div><Eyebrow>LOJINHA · {campaign.name}</Eyebrow><h2>{collection?'Produtos físicos para comprar.':'Escolha seus produtos.'}</h2></div>{draft.items.length>0&&<a className="button button-secondary" href={embedded?'#/comercial/comprar':'#selecao'} onClick={event=>sectionLink(event,'selecao')}>Sua seleção · {draft.items.length}</a>}</div>
      {!products.length?<EmptyState title={collection?'Nenhum produto físico disponível.':'O catálogo está sendo preparado.'}>{collection?'As encomendas feitas anteriormente aparecem somente nos seus pedidos.':'Os produtos publicados aparecerão nesta campanha.'}</EmptyState>:<div className="commercial-catalog">{products.map(item=>{
        const available=catalog.variants.filter(variant=>variant.productId===item.id).some(variant=>variant.availableQuantity>0),preorder=item.mode==='preorder'&&!collection;
        return <article className="commercial-product" key={item.id}><div className="public-product-placeholder" aria-label="Produto sem imagem cadastrada"><span>{item.category}</span></div><header><Eyebrow>{item.category}</Eyebrow><Badge tone={preorder?'waiting':'neutral'}>{preorder?'Sob encomenda':available?'Estoque físico':'Indisponível'}</Badge></header><h3>{item.name}</h3><p className="commercial-product-description">{item.description||'Consulte as variações disponíveis.'}</p><div className="commercial-product-price"><strong>{money(item.saleCents)}</strong><span>por unidade</span></div><Button onClick={()=>{setProductId(item.id);setVariantId((catalog.variants.find(variant=>variant.productId===item.id&&(item.mode==='preorder'&&!collection||variant.availableQuantity>0))??catalog.variants.find(variant=>variant.productId===item.id))?.id??'');setQuantity('1');setFormError('');}}>Ver produto</Button></article>;
      })}</div>}
    </section>}
    {catalog&&draft.items.length>0&&<section id="selecao" className="commercial-catalog-section buyer-selection">
      <Eyebrow>SUA SELEÇÃO · {campaign?.name??'Campanha indisponível'}</Eyebrow><h2>Confira antes de pedir.</h2><p>Os itens ainda não estão reservados. O preço e a disponibilidade serão conferidos ao concluir.</p>
      {selected.map(item=><div className="public-selection-line form-fields" key={item.line.variantId}>
        <div className="public-selection-product"><strong>{item.product?.name??'Produto indisponível'}</strong><span>{item.variant?.name??'Variação indisponível'} · {item.preorder?'Sob encomenda':'Produto físico'}</span>{!item.valid&&<small role="alert">Remova o item indisponível ou corrija a quantidade.</small>}</div>
        <label className="public-quantity">Quantidade<input aria-label={`Quantidade de ${item.product?.name??'item'}`} type="number" min="1" max="1000000" value={item.line.quantity} onChange={event=>changeDraft({...draft,items:draft.items.map(line=>line===item.line?{...line,quantity:event.target.value}:line)})}/></label>
        <strong>{money((item.product?.saleCents??0)*(Number.isFinite(item.count)?item.count:0))}</strong><Button aria-label={`Remover ${item.product?.name??'item'}`} onClick={()=>changeDraft({...draft,items:draft.items.filter(line=>line!==item.line)})}>Remover</Button>
      </div>)}
      <div className="buyer-selection-footer"><div className="commercial-total"><span>Total estimado</span><strong>{money(total)}</strong></div><Button variant="primary" disabled={!selected.every(item=>item.valid)||!campaign} onClick={()=>{setFormError('');setCheckout(true);}}>Conferir e concluir</Button></div>
    </section>}

    {product&&<Dialog title={product.name} onClose={()=>setProductId('')}><Eyebrow>{campaign?.name} · {product.category}</Eyebrow><p>{product.description}</p><Badge>{preorder?'Sob encomenda':'Estoque físico'}</Badge><form className="form-fields buyer-product-form" onSubmit={event=>{event.preventDefault();add();}}>
      <fieldset className="product-variant-options"><legend>Escolha a variação</legend>{variants.map(item=><label key={item.id} data-selected={item.id===variantId}><input type="radio" name="variant" value={item.id} checked={item.id===variantId} onChange={()=>setVariantId(item.id)} disabled={!preorder&&item.availableQuantity<=0}/><span><strong>{item.name}</strong><small>{preorder?'Sob encomenda':item.availableQuantity>0?`${item.availableQuantity} disponíveis`:'Esgotado'}</small></span></label>)}</fieldset>
      {variant?.attributes&&<dl className="buyer-attributes">{Object.entries(variant.attributes).map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>}
      <p>{preorder?'Produzido sob encomenda após o pagamento.':`${variant?.availableQuantity??0} unidades disponíveis`}</p><p><strong>{money(product.saleCents)}</strong> por unidade</p>
      <label>Quantidade<input type="number" min="1" max={preorder?1000000:Math.max(1,variant?.availableQuantity??0)} value={quantity} onChange={event=>setQuantity(event.target.value)} required/></label>
      {formError&&<p role="alert">{formError}</p>}<Button variant="primary" disabled={!valid||draft.items.length>=100}>Adicionar à seleção</Button>
    </form></Dialog>}
    {checkout&&catalog&&<Dialog size="wide" title="Conferir meu pedido" onClose={()=>{if(!busy)setCheckout(false);}}>
      {accountProblem?accountProblem:canBuy?<><CommercialOrderForm catalog={catalog} campaignId={campaignId} draft={draft} onChange={changeDraft} onSubmit={()=>void submit()} busy={busy} refresh={()=>void load()}/>{formError&&<p className="form-feedback error" role="alert">{formError}</p>}</>:needsStudentEmail?<BuyerEmailVerification onVerified={()=>void checkAccount()}/>:<><p>Sua seleção fica guardada neste navegador durante esta sessão. Entre com sua conta Honji para continuar.</p><p>Compradores externos precisam confirmar um e-mail @alunos.utfpr.edu.br. Confira também a caixa de spam.</p><a className="button button-primary" href="/auth/login?provider=google">Entrar ou criar conta com Google</a><a className="button button-secondary" href="/auth/login">Entrar com Honji</a></>}
    </Dialog>}
    {detail&&<Dialog title="Pedido registrado" onClose={()=>setDetail(undefined)}><CommercialOrderDetail detail={detail} busy={busy} onAction={async()=>false} refresh={()=>void refreshDetail()}/>{formError&&<p role="alert">{formError}</p>}</Dialog>}
    {pendingCampaign&&<Dialog title="Trocar de campanha?" onClose={()=>setPendingCampaign('')}><p>Os itens selecionados pertencem a {campaign?.name??'outra campanha'}. Ao trocar, essa seleção será removida. Seus pedidos já registrados permanecem na sua conta.</p><div className="card-actions"><Button onClick={()=>setPendingCampaign('')}>Manter seleção</Button><Button variant="primary" onClick={()=>changeCampaign(pendingCampaign)}>Trocar campanha</Button></div></Dialog>}
  </>;
  if(embedded)return content;
  return <div className="app-shell public-portal"><a className="skip-link" href="#content" onClick={skipToContent}>Pular para o conteúdo</a>
    <header className="site-header"><div className="header-inner"><div className="navbar-brands"><HonjiBrand/><span className="navbar-divider" aria-hidden="true"/><Brand href="/"/></div><nav aria-label="Portal público"><a href="#campanhas">Lojinha</a><a href="/#/meus-pedidos">Meus pedidos</a><a href="/#/">Área interna</a></nav><div className="header-actions">{account&&<Button disabled={signingOut} onClick={()=>void logout()}>{signingOut?"Saindo…":"Sair do CAEHUB"}</Button>}<ThemeToggle theme={theme} onTheme={()=>setTheme(theme==='light'?'dark':'light')}/></div></div></header>
    <main tabIndex={-1} id="content" className="content">{content}</main>
    <footer className="site-footer"><div className="footer-inner"><HonjiBrand/><div className="footer-organization"><strong>CAECOMP</strong><span>Centro Acadêmico de Engenharia de Computação</span></div><div className="footer-signature"><span>DESENVOLVIDO POR</span><a href="https://github.com/gabrielhonji">gabriel.honji</a><span>CAEHUB · {__APP_VERSION__}</span></div></div></footer>
  </div>;
}
