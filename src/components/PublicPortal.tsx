import {UnifiedReportEntry} from './UnifiedProblemReports';
import {useRefresh} from '../hooks/useRefresh';
import {skipToContent} from '../services/navigation';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Brand, HonjiBrand } from './Brand';
import { ThemeToggle } from './ThemeToggle';
import { AgendaNotifications } from './AgendaNotifications';
import {AppFooter} from './AppFooter';
import { BuyerEmailVerification } from './BuyerEmailVerification';
import { Badge, Button, Dialog, EmptyState, ErrorState, Eyebrow, LoadingState } from './primitives';
import { CommercialOrderForm } from './CommercialOrderForm';
import { CommercialOrderDetail } from './CommercialOrderDetail';
import { CommercialOrders } from './CommercialOrders';
import { RefreshButton } from './RefreshButton';
import { api, type SessionInfo } from '../services/spaces';
import { money } from '../services/commercial';
import { emptyOrderDraft, newRequestKey, commercialOrderFailure, type OrderDetail, type OrderDraft, type SaleCatalog } from '../services/commercial-orders';
import {useSharedTheme} from '../hooks/useSharedTheme';
import '../styles/commercial.css';
import '../styles/public-portal.css';

const selectionKey='caehub-public-selection';
type Selection={campaignId:string;items:OrderDraft['items'];requestKey:string};
function LoginChoices({rememberDevice,setRememberDevice,googleLogin,honjiLogin}:{rememberDevice:boolean;setRememberDevice:(value:boolean)=>void;googleLogin:string;honjiLogin:string}){
  const prepareGoogle=()=>{document.cookie=`honji_remember=${rememberDevice?'1':''}; Domain=.honji.com.br; Path=/; Max-Age=${rememberDevice?2592000:0}; SameSite=Lax; Secure`;};
  return <div className="login-choices"><label className="remember-device"><input type="checkbox" checked={rememberDevice} onChange={event=>setRememberDevice(event.target.checked)}/>Manter este dispositivo por 30 dias</label><a className="button button-primary" href={googleLogin} onClick={prepareGoogle}>Entrar ou criar conta com Google</a><a className="button button-secondary" href={honjiLogin}>Entrar com Honji</a><small>A opção mantém apenas o SSO central; a sessão local continua limitada a 8 h sem atividade e 12 h no total.</small></div>;
}
function storageKey(owner?:string){return owner?`${selectionKey}:${owner}`:selectionKey;}
function restore(owner?:string):Selection|undefined{
  try{
    const value=JSON.parse(localStorage.getItem(storageKey(owner))??'null');
    if(value&&typeof value.campaignId==='string'&&typeof value.requestKey==='string'&&Array.isArray(value.items)&&value.items.length<=100&&value.items.every((item:unknown)=>item&&typeof item==='object'&&'variantId' in item&&typeof item.variantId==='string'&&'quantity' in item&&typeof item.quantity==='string'))return value;
  }catch{/* The selection remains usable in memory. */}
}

export function PublicPortal({embedded=false}:{embedded?:boolean;institutionalDenied?:boolean}){
  const [saved]=useState(()=>restore());
  const returnTo=encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
  const honjiLogin=`/auth/login?returnTo=${returnTo}`;
  const googleLogin=`/auth/login?provider=google&returnTo=${returnTo}`;
  const [rememberDevice,setRememberDevice]=useState(false);
  const [catalog,setCatalog]=useState<SaleCatalog>(),[error,setError]=useState(false),[canBuy,setCanBuy]=useState(false),[checkingAccount,setCheckingAccount]=useState(true);
  const [needsStudentEmail,setNeedsStudentEmail]=useState(false);
  const [sessionDenied,setSessionDenied]=useState(false),[accountFailed,setAccountFailed]=useState(false);
  const [account,setAccount]=useState<SessionInfo>(),[signingOut,setSigningOut]=useState(false),[profileOpen,setProfileOpen]=useState(false);
  const verification=location.hash.startsWith('#verificar-email');
  const ownOrderId=location.hash.startsWith('#/meus-pedidos/')?location.hash.split('/')[2]:undefined;
  const checkAccount=async()=>{setCheckingAccount(true);setAccountFailed(false);try{const value=await api<{canBuy:boolean;requiresStudentEmail?:boolean;sessionDenied?:boolean}>('/public/buyer-status');setCanBuy(value.canBuy);setNeedsStudentEmail(value.requiresStudentEmail===true);setSessionDenied(value.sessionDenied===true);if(value.canBuy||value.requiresStudentEmail)setAccount(await api<SessionInfo>('/me'));}catch{setCanBuy(false);setAccountFailed(true);}finally{setCheckingAccount(false);}};
  async function logout(){if(!account||signingOut)return;setSigningOut(true);try{const response=await fetch('/auth/logout',{method:'POST',headers:{'x-csrf-token':account.csrfToken??'','content-type':'application/json'},body:JSON.stringify({mode:'provider'})});const result=await response.json();if(!response.ok)throw new Error();location.assign(result.redirect);}catch{setNotice('Não foi possível sair agora. Tente novamente.');setSigningOut(false);}}
  const [campaignId,setCampaignId]=useState(saved?.campaignId??''),[draft,setDraft]=useState<OrderDraft>(()=>({...emptyOrderDraft(),items:saved?.items??[]}));
  const [requestKey,setRequestKey]=useState(saved?.requestKey??newRequestKey()),[productId,setProductId]=useState(''),[variantId,setVariantId]=useState(''),[quantity,setQuantity]=useState('1');
  const [selectionOwner,setSelectionOwner]=useState('');
  const [checkout,setCheckout]=useState(Boolean(saved?.items.length)),[busy,setBusy]=useState(false),[formError,setFormError]=useState(''),[detail,setDetail]=useState<OrderDetail>();
  const submitting=useRef(false);
  const [ordersVersion,setOrdersVersion]=useState(0),[notice,setNotice]=useState(''),[pendingCampaign,setPendingCampaign]=useState('');
  const [theme,setTheme]=useSharedTheme();
  const load=async()=>{
    try{const next=await api<SaleCatalog>('/public/catalog');setCatalog(next);setCampaignId(current=>current||next.campaigns[0]?.id||'');setError(false);return true;}
    catch{setError(true);return false;}
  };
  useEffect(()=>{
    void load();
    void checkAccount();
  },[]);
  useEffect(()=>{
    if(!account?.subject)return;const owned=restore(account.subject),anonymous=restore();const next=owned??anonymous;if(next){setCampaignId(next.campaignId);setDraft({...emptyOrderDraft(),items:next.items});setRequestKey(next.requestKey);}try{localStorage.removeItem(selectionKey);}catch{/* Storage is optional. */}setSelectionOwner(account.subject);
  },[account?.subject]);
  useEffect(()=>{
    try{const key=storageKey(selectionOwner||undefined);if(draft.items.length)localStorage.setItem(key,JSON.stringify({campaignId,items:draft.items,requestKey}));else localStorage.removeItem(key);}
    catch{/* No personal information is stored. */}
  },[campaignId,draft.items,requestKey,selectionOwner]);
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
  useRefresh(load,'catalog');
  const accountProblem=accountFailed?<><ErrorState onRetry={()=>void checkAccount()}/><a className="button button-secondary" href="/acesso">Gerenciar minha sessão</a></>:sessionDenied?<div className="buyer-login-note"><p>Sua conta não está habilitada para comprar. O catálogo público continua disponível.</p><a className="button button-secondary" href="/acesso?status=denied">Gerenciar minha sessão</a></div>:undefined;
  const orders=<section id="pedidos" className="buyer-account-section">
    <div className="compact-heading"><div><Eyebrow>MINHA CONTA · {campaign?.name??'TODAS AS CAMPANHAS'}</Eyebrow><h2>Seus pedidos e retiradas.</h2></div>{canBuy&&!location.hash.startsWith('#/meus-pedidos')&&<a className="button button-secondary" href="/#/meus-pedidos">Todos os meus pedidos →</a>}</div>
    {checkingAccount?<LoadingState/>:accountProblem??(canBuy?<CommercialOrders key={`${ordersVersion}-${campaignId}`} mode="mine" campaignId={ownOrderId?undefined:campaign?.id} initialOrderId={ownOrderId}/>:needsStudentEmail?<BuyerEmailVerification onVerified={()=>void checkAccount()}/>:<div className="buyer-login-note"><p>Entre com Honji para consultar suas encomendas e as quantidades do seu pedido. Nesta etapa, a equipe informa quando estão prontas para retirada.</p><LoginChoices rememberDevice={rememberDevice} setRememberDevice={setRememberDevice} googleLogin={googleLogin} honjiLogin={honjiLogin}/><small>Compradores externos devem confirmar um e-mail @alunos.utfpr.edu.br.</small></div>)}
  </section>;
  const ownOrdersRoute=location.hash.startsWith('#/meus-pedidos');
  const content=ownOrdersRoute&&!embedded?<><section className="commercial-heading buyer-page-heading"><div><Eyebrow>MINHA CONTA</Eyebrow><h1>Meus pedidos.</h1><p>Produtos, pagamento e retirada de cada compra.</p><a className="button button-secondary" href="#/comercial/comprar">← Voltar à lojinha</a></div></section>{orders}</>:<>
    {verification&&<BuyerEmailVerification onVerified={()=>void checkAccount()}/>}
    <section className={`commercial-heading public-intro ${embedded?'buyer-page-heading':''}`}><div>
      <Eyebrow>{embedded?'COMERCIAL · MINHAS COMPRAS':'01 / HONJI + CAECOMP'}</Eyebrow>
      <h1>{embedded?<>Escolha, acompanhe,<br/><em>retire.</em></>:<>Feito para reunir.<br/><em>Também para levar.</em></>}</h1>
      <p>{embedded?'Escolha a campanha e os produtos. Acompanhe pagamento, produção e retirada em Meus pedidos.':'O CAEHUB reúne as campanhas e o trabalho do CAECOMP. Desenvolvido por Honji em parceria com o Centro Acadêmico de Engenharia de Computação.'}</p>
      <div className="card-actions"><a className="button button-primary" href={embedded?'#/comercial/comprar':'#campanhas'} onClick={event=>sectionLink(event,'campanhas')}>Conhecer a lojinha ↓</a><a className="button button-secondary" href={canBuy?'/#/meus-pedidos':honjiLogin}>{canBuy?'Meus pedidos →':'Entrar com Honji'}</a></div>
    </div><aside><Eyebrow>DO PEDIDO À RETIRADA</Eyebrow><h2>Uma campanha.<br/>Duas etapas.</h2><p>Encomende durante as vendas. Na etapa de retirada, consulte apenas os seus itens e quantidades. Produtos físicos continuam na lojinha.</p><p>O Pix é conferido manualmente pela equipe.</p></aside></section>
    {!embedded&&account&&!account.institutionalAccess&&<section className="buyer-login-note member-account-entry" aria-label="Conta de membro do CAECOMP"><div><Eyebrow>JÁ É MEMBRO DO CAECOMP?</Eyebrow><h2>Ative seu acesso de membro.</h2><p>Se você já integra o CAECOMP, solicite o acesso institucional da sua conta Honji. A equipe confirma o vínculo e o departamento.</p></div><a className="button button-primary" href="https://gabriel.honji.com.br/#solicitar-acesso?project=CAECOMP">Solicitar conta CAEHUB</a><small>Este pedido é exclusivo para membros existentes do CAECOMP. Não é uma inscrição para entrar no centro acadêmico.</small></section>}
    {notice&&<p className="form-feedback success" role="status">{notice}</p>}
    <section id="campanhas" className="commercial-campaign-section">
      <div className="compact-heading"><div><Eyebrow>02 / CAMPANHAS</Eyebrow><h2>As campanhas do CAECOMP.</h2></div><RefreshButton label="Atualizar catálogo" onRefresh={load}/></div>
      {!catalog?(error?<ErrorState onRetry={()=>void load()}/>:<LoadingState/>):<>
        {error&&<p role="alert">Não foi possível atualizar. Confira novamente antes de comprar.</p>}
        {!catalog.campaigns.length?<EmptyState title="Novas campanhas vêm por aí.">Seus pedidos anteriores continuam disponíveis na sua conta.</EmptyState>:<>
          <div className="public-campaign-picker"><label>Campanha do semestre<select value={campaignId} onChange={event=>chooseCampaign(event.target.value)}>{catalog.campaigns.map(item=><option key={item.id} value={item.id}>{item.semester||'Semestre a definir'} · {item.name}</option>)}</select></label></div>
          {campaign?<div className="buyer-campaign-context compact-campaign-context"><Badge tone="active">{collection?'02 · Retirada e estoque':'01 · Vendas e encomendas'}</Badge><p><strong>{campaign.name}</strong>{campaign.description?` · ${campaign.description}`:''}</p><small>{collection?'Encomendas encerradas; pedidos seguem em Meus pedidos e a lojinha mostra estoque físico.':'Produtos físicos e modelos sob encomenda desta campanha.'}</small></div>:<p role="alert">A campanha selecionada não está mais aberta. Escolha outra e confira seus itens.</p>}
        </>}
      </>}
    </section>

    {campaign&&catalog&&<section className="commercial-catalog-section">
      <div className="compact-heading"><div><Eyebrow>LOJINHA · {campaign.name}</Eyebrow><h2>{collection?'Produtos físicos para comprar.':'Escolha seus produtos.'}</h2></div>{draft.items.length>0&&<a className="button button-secondary" href={embedded?'#/comercial/comprar':'#selecao'} onClick={event=>sectionLink(event,'selecao')}>Sua seleção · {draft.items.length}</a>}</div>
      {!products.length?<EmptyState title={collection?'Nenhum produto físico disponível.':'O catálogo está sendo preparado.'}>{collection?'As encomendas feitas anteriormente aparecem somente nos seus pedidos.':'Os produtos publicados aparecerão nesta campanha.'}</EmptyState>:<div className="commercial-catalog">{products.map(item=>{
        const available=catalog.variants.filter(variant=>variant.productId===item.id).some(variant=>variant.availableQuantity>0),preorder=item.mode==='preorder'&&!collection;
        const itemVariants=catalog.variants.filter(variant=>variant.productId===item.id&&variant.status==='active');
        return <article className="commercial-product" key={item.id}><div className="public-product-placeholder" aria-label="Produto sem imagem cadastrada"><span>{item.category}</span></div><header><Eyebrow>{item.category}</Eyebrow><Badge tone={preorder?'waiting':available?'active':'neutral'}>{preorder?'Sob encomenda':available?'Estoque físico':'Indisponível'}</Badge></header><h3>{item.name}</h3><p className="commercial-product-description">{item.description||'Consulte as variações disponíveis.'}</p><p className="product-variant-summary">{itemVariants.slice(0,3).map(value=>value.name).join(' · ')}{itemVariants.length>3?` +${itemVariants.length-3}`:''}</p><div className="commercial-product-price"><strong>{money(item.saleCents)}</strong><span>por unidade</span></div><Button disabled={!preorder&&!available} onClick={()=>{setProductId(item.id);setVariantId((catalog.variants.find(variant=>variant.productId===item.id&&(item.mode==='preorder'&&!collection||variant.availableQuantity>0))??catalog.variants.find(variant=>variant.productId===item.id))?.id??'');setQuantity('1');setFormError('');}}>{available||preorder?'Ver produto':'Sem estoque'}</Button></article>;
      })}</div>}
    </section>}
    {catalog&&draft.items.length>0&&<section id="selecao" className="commercial-catalog-section buyer-selection">
      <Eyebrow>SUA SELEÇÃO · {campaign?.name??'Campanha indisponível'}</Eyebrow><h2>Confira antes de pedir.</h2><p>Os itens ainda não estão reservados. O preço e a disponibilidade serão conferidos ao concluir.</p>
      {selected.map(item=><div className="public-selection-line form-fields" key={item.line.variantId}>
        <div className="public-selection-product"><strong>{item.product?.name??'Produto indisponível'}</strong><span>{item.variant?.name??'Variação indisponível'} · {item.preorder?'Sob encomenda':'Produto físico'}</span>{!item.valid&&<small role="alert">Remova o item indisponível ou corrija a quantidade.</small>}</div>
        <QuantityStepper label={`Quantidade de ${item.product?.name??'item'}`} value={item.count} max={item.preorder?1000000:item.variant?.availableQuantity??1} onChange={value=>changeDraft({...draft,items:draft.items.map(line=>line===item.line?{...line,quantity:String(value)}:line)})}/>
        <strong>{money((item.product?.saleCents??0)*(Number.isFinite(item.count)?item.count:0))}</strong><Button className="selection-remove" variant="danger" aria-label={`Remover ${item.product?.name??'item'} da seleção`} title="Remover da seleção" onClick={()=>changeDraft({...draft,items:draft.items.filter(line=>line!==item.line)})}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16m-10 4v6m4-6v6M9 7l1-3h4l1 3m3 0-1 14H7L6 7"/></svg><span className="sr-only">Remover</span></Button>
      </div>)}
      <div className="buyer-selection-footer"><div className="commercial-total"><span>Total estimado</span><strong>{money(total)}</strong></div><Button variant="primary" disabled={!selected.every(item=>item.valid)||!campaign} onClick={()=>{setFormError('');setCheckout(true);}}>Conferir e concluir</Button></div>
    </section>}

    {product&&<Dialog title={product.name} headerActions={<Badge tone={preorder?'waiting':'active'}>{preorder?'Sob encomenda':'Estoque físico'}</Badge>} onClose={()=>setProductId('')}><Eyebrow>{campaign?.name} · {product.category}</Eyebrow><p>{product.description}</p><form className="form-fields buyer-product-form" onSubmit={event=>{event.preventDefault();add();}}>
      <VariantPicker variants={variants} value={variantId} preorder={Boolean(preorder)} onChange={setVariantId}/>
      {variant?.attributes&&<dl className="buyer-attributes">{Object.entries(variant.attributes).map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>}
      <p>{preorder?'Produzido sob encomenda após o pagamento.':`${variant?.availableQuantity??0} unidades disponíveis`}</p><p><strong>{money(product.saleCents)}</strong> por unidade</p>
      {formError&&<p role="alert">{formError}</p>}<div className="buyer-product-actions"><Button variant="primary" disabled={!valid||draft.items.length>=100}>Adicionar ao carrinho</Button><QuantityStepper label="Quantidade" value={Number(quantity)} max={preorder?1000000:Math.max(1,variant?.availableQuantity??0)} onChange={value=>setQuantity(String(value))}/></div>
    </form></Dialog>}
    {checkout&&catalog&&<Dialog size="wide" title="Conferir meu pedido" onClose={()=>{if(!busy)setCheckout(false);}}>
      {accountProblem?accountProblem:canBuy?<><CommercialOrderForm catalog={catalog} campaignId={campaignId} draft={draft} onChange={changeDraft} onSubmit={()=>void submit()} busy={busy} refresh={()=>void load()}/>{formError&&<p className="form-feedback error" role="alert">{formError}</p>}</>:needsStudentEmail?<BuyerEmailVerification onVerified={()=>void checkAccount()}/>:<><p>Sua seleção fica guardada neste navegador durante esta sessão. Depois do login, você volta a esta conferência com os mesmos itens.</p><p>Compradores externos precisam confirmar um e-mail @alunos.utfpr.edu.br. Confira também a caixa de spam.</p><LoginChoices rememberDevice={rememberDevice} setRememberDevice={setRememberDevice} googleLogin={googleLogin} honjiLogin={honjiLogin}/></>}
    </Dialog>}
    {detail&&<Dialog title="Pedido registrado" onClose={()=>setDetail(undefined)}><CommercialOrderDetail detail={detail} busy={busy} onAction={async()=>false} refresh={()=>void refreshDetail()}/>{formError&&<p role="alert">{formError}</p>}</Dialog>}
    {pendingCampaign&&<Dialog title="Trocar de campanha?" onClose={()=>setPendingCampaign('')}><p>Os itens selecionados pertencem a {campaign?.name??'outra campanha'}. Ao trocar, essa seleção será removida. Seus pedidos já registrados permanecem na sua conta.</p><div className="card-actions"><Button onClick={()=>setPendingCampaign('')}>Manter seleção</Button><Button variant="primary" onClick={()=>changeCampaign(pendingCampaign)}>Trocar campanha</Button></div></Dialog>}
  </>;
  if(location.hash==='#relatar-problema')return <div className="entry-state"><UnifiedReportEntry/></div>;
  if(embedded)return content;
  return <div className="app-shell public-portal"><a className="skip-link" href="#content" onClick={skipToContent}>Pular para o conteúdo</a>
    <header className="site-header"><div className="header-inner"><div className="navbar-brands"><HonjiBrand/><span className="navbar-divider" aria-hidden="true"/><Brand href="/"/></div><nav aria-label="Portal público"><a href="#campanhas">Lojinha</a><a href="/#/meus-pedidos">Meus pedidos</a>{account?.institutionalAccess&&<a className="public-internal-entry" href="/#/">Área interna do CAECOMP →</a>}</nav><div className="header-actions"><ThemeToggle theme={theme} onTheme={()=>setTheme(theme==='light'?'dark':'light')}/>{account&&<AgendaNotifications/>}{account&&<div className="account-control" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setProfileOpen(false);}}><button className="account-avatar" type="button" aria-label="Abrir opções da conta" aria-expanded={profileOpen} onClick={()=>setProfileOpen(value=>!value)}>{account.displayName.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase()}</button>{profileOpen&&<div className="account-panel"><a className="account-name" href="https://gabriel.honji.com.br/#perfil"><strong title={account.displayName}>{account.displayName}</strong><span>Editar perfil</span></a><a href="https://gabriel.honji.com.br/#acesso">Minha conta</a><button type="button" disabled={signingOut} onClick={()=>void logout()}>{signingOut?'Desconectando…':'Desconectar'}</button></div>}</div>}</div></div></header>
    <main tabIndex={-1} id="content" className="content">{content}</main>
    <AppFooter reportAction={<a className="button" href="#relatar-problema">Relatar problema</a>}/>
  </div>;
}

function QuantityStepper({label,value,max,onChange}:{label:string;value:number;max:number;onChange:(value:number)=>void}){const safe=Number.isFinite(value)?Math.min(max,Math.max(1,value)):1;return <label className="quantity-stepper"><span>{label}</span><div><Button type="button" disabled={safe<=1} aria-label={`Diminuir ${label.toLowerCase()}`} onClick={()=>onChange(safe-1)}>−</Button><input aria-label={label} type="number" inputMode="numeric" min={1} max={max} value={safe} onChange={event=>onChange(Math.min(max,Math.max(1,Number(event.target.value)||1)))}/><Button type="button" disabled={safe>=max} aria-label={`Aumentar ${label.toLowerCase()}`} onClick={()=>onChange(safe+1)}>+</Button></div></label>}

function VariantPicker({variants,value,preorder,onChange}:{variants:SaleCatalog['variants'];value:string;preorder:boolean;onChange:(id:string)=>void}){
  const active=variants.filter(item=>item.status==='active'),selected=active.find(item=>item.id===value);
  const dimensions=[...new Set(active.flatMap(item=>Object.keys(item.attributes??{})))];
  const eligible=(item:SaleCatalog['variants'][number])=>preorder||item.availableQuantity>0;
  if(active.length===1){const item=active[0];return <p className="single-variant"><strong>{item.name}</strong><span>{preorder?'Sob encomenda':item.availableQuantity>0?`${item.availableQuantity} disponíveis`:'Esgotado'}</span></p>;}
  if(dimensions.length<2)return <fieldset className="product-variant-options"><legend>Escolha a variação</legend>{active.map(item=><label key={item.id} data-selected={item.id===value}><input type="radio" name="variant" value={item.id} checked={item.id===value} onChange={()=>onChange(item.id)} disabled={!eligible(item)}/><span><strong>{item.name}</strong><small>{preorder?'Sob encomenda':item.availableQuantity>0?`${item.availableQuantity} disponíveis`:'Esgotado'}</small></span></label>)}</fieldset>;
  return <div className="variant-dimensions">{dimensions.map(dimension=><fieldset className="product-variant-options" key={dimension}><legend>{dimension}</legend>{[...new Set(active.map(item=>item.attributes?.[dimension]).filter((item):item is string=>Boolean(item)))].map(option=>{const exact=active.find(item=>eligible(item)&&item.attributes?.[dimension]===option&&dimensions.every(other=>other===dimension||!selected?.attributes?.[other]||item.attributes?.[other]===selected.attributes[other]));const candidate=exact??active.find(item=>eligible(item)&&item.attributes?.[dimension]===option);return <Button type="button" key={option} disabled={!candidate} aria-pressed={selected?.attributes?.[dimension]===option} onClick={()=>candidate&&onChange(candidate.id)}>{option}</Button>;})}</fieldset>)}</div>;
}
