import { useEffect, useState } from 'react';
import { api } from '../services/spaces';
import { money } from '../services/commercial';
import type { SaleCatalog } from '../services/commercial-orders';
import { AccessDeniedState, Badge, Button, EmptyState, ErrorState, Eyebrow, LoadingState } from './primitives';
import { CommercialOrders } from './CommercialOrders';
import '../styles/commercial.css';

export function CommercialShop(){
  const [catalog,setCatalog]=useState<SaleCatalog>(),[selected,setSelected]=useState(''),[error,setError]=useState(''),[denied,setDenied]=useState(false);
  const load=async()=>{try{const next=await api<SaleCatalog>('/commercial/shop');setCatalog(next);setSelected(current=>next.campaigns.some(c=>c.id===current)?current:next.campaigns[0]?.id??'');setError('');setDenied(false);}catch(e){setError((e as Error).message);setDenied((e as {code?:string}).code==='forbidden');}};
  useEffect(()=>{void load();},[]);
  if(!catalog)return denied?<AccessDeniedState/>:error?<ErrorState onRetry={()=>void load()}/>:<LoadingState/>;
  const campaign=catalog.campaigns.find(c=>c.id===selected),products=catalog.products.filter(p=>catalog.links.some(l=>l.campaignId===selected&&l.productId===p.id));
  return <>
    <section className="commercial-heading"><div><Eyebrow>COMERCIAL · MINHAS COMPRAS</Eyebrow><h1>Escolha, acompanhe,<br/><em>retire.</em></h1><p>Faça seu pedido pela conta Honji e acompanhe o pagamento, a produção e a retirada em um só lugar.</p></div><aside><Eyebrow>PIX COM CONFERÊNCIA MANUAL</Eyebrow><p>Use as instruções do seu pedido. A equipe confirma o pagamento após verificar o recebimento real.</p></aside></section>
    {error&&<p className="form-feedback error" role="alert">Não foi possível atualizar o catálogo.<Button onClick={()=>void load()}>Tentar novamente</Button></p>}
    <section className="commercial-campaign-section"><div className="compact-heading"><div><Eyebrow>CAMPANHAS ATIVAS</Eyebrow><h2>As ofertas do semestre.</h2></div><Button onClick={()=>void load()}>Atualizar catálogo</Button></div>
      {!catalog.campaigns.length?<EmptyState title="Nenhuma campanha aberta para compras.">Seus pedidos anteriores continuam disponíveis abaixo.</EmptyState>:<div className="commercial-campaigns" role="group" aria-label="Selecionar campanha">{catalog.campaigns.map(c=><button className="commercial-campaign" key={c.id} aria-pressed={selected===c.id} onClick={()=>setSelected(c.id)}><span>{c.semester||'Semestre a definir'}</span><strong>{c.name}</strong><small>{c.stage==='orders'?'Vendas e encomendas':'Retirada e vendas de estoque'}</small></button>)}</div>}
      {campaign&&<p>{campaign.description|| (campaign.stage==='orders'?'Escolha produtos em estoque ou modelos sob encomenda.':'As encomendas desta campanha encerraram. Produtos com unidades físicas livres continuam disponíveis.')}</p>}
    </section>
    {campaign&&<section className="commercial-catalog-section"><div className="compact-heading"><div><Eyebrow>CATÁLOGO PARA COMPRA</Eyebrow><h2>Produtos desta campanha.</h2></div></div>{!products.length?<EmptyState title="Nenhum produto disponível para compra.">A equipe ainda está organizando o catálogo.</EmptyState>:<div className="commercial-catalog">{products.map(p=>{const variants=catalog.variants.filter(v=>v.productId===p.id),preorder=p.mode==='preorder'&&campaign.stage==='orders';return <article className="commercial-product" key={p.id}><header><Eyebrow>{p.category}</Eyebrow><Badge tone={preorder?'waiting':'neutral'}>{preorder?'Encomenda':'Estoque físico'}</Badge></header><h3>{p.name}</h3><p className="commercial-product-description">{p.description||'Escolha a variação ao registrar o pedido.'}</p><div className="commercial-product-price"><strong>{money(p.saleCents)}</strong><span>preço unitário</span></div><ul className="commercial-shop-variants">{variants.map(v=><li key={v.id}><span>{v.name}</span><strong>{preorder?'Sob encomenda':`${v.availableQuantity} livres`}</strong></li>)}</ul></article>})}</div>}</section>}
    <CommercialOrders catalog={catalog} campaignId={campaign?.id} mode="mine" onInventoryChange={load}/>
    {campaign&&<details className="commercial-shop-history"><summary>Pedidos de todas as campanhas</summary><CommercialOrders mode="mine"/></details>}
  </>;
}
