import type {OrderDetail,OrderDraft,SaleCatalog} from '../services/commercial-orders';

export type RepeatPlan={items:OrderDraft['items'];changes:Array<{label:string;reason:string}>;blocker?:string};
export function planRepeatOrder(detail:OrderDetail,campaignId:string,catalog:SaleCatalog):RepeatPlan{
 const plan:RepeatPlan={items:[],changes:[]};
 if(detail.order.status!=='expired')return {...plan,blocker:'Este pedido não está com a reserva vencida. Consulte a situação atual antes de continuar.'};
 const campaign=catalog.campaigns.find(c=>c.id===campaignId&&c.status==='active');
 if(!campaign)return {...plan,blocker:'A campanha deste pedido não está mais aberta. Consulte as campanhas disponíveis na lojinha.'};
 for(const item of detail.items){
  const label=item.product_name+' · '+item.variant_name;
  if(item.fulfillment==='preorder'&&campaign.stage!=='orders'){plan.changes.push({label,reason:'Encomendas encerradas para este produto.'});continue;}
  const variant=catalog.variants.find(v=>v.id===item.variant_id&&v.status==='active');
  const product=variant&&catalog.products.find(p=>p.id===variant.productId&&p.status==='active'&&p.saleCents!=null);
  if(!variant||!product||!catalog.links.some(l=>l.productId===product.id&&l.campaignId===campaignId)){plan.changes.push({label,reason:'Produto ou variação indisponível nesta campanha.'});continue;}
  if(product.mode==='preorder'&&(campaign.stage!=='orders'||product.campaignId!==campaignId)){plan.changes.push({label,reason:'Encomendas encerradas para este produto.'});continue;}
  const quantity=product.mode==='preorder'?item.quantity:Math.min(item.quantity,Math.max(0,Math.floor(variant.availableQuantity)));
  if(!quantity){plan.changes.push({label,reason:'Sem estoque disponível.'});continue;}
  plan.items.push({variantId:variant.id,quantity:String(quantity)});
  if(quantity<item.quantity)plan.changes.push({label,reason:`Somente ${quantity} de ${item.quantity} unidades disponíveis.`});
  if(Number(product.saleCents)!==Number(item.unit_price_cents))plan.changes.push({label,reason:'O preço mudou. O novo valor será apresentado na conferência.'});
 }
 return plan;
}
