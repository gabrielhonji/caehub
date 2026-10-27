import type { Campaign, Combo, ComboItem, Product, Variant } from './commercial';

export type SaleCatalog={campaigns:Campaign[];products:Pick<Product,'id'|'name'|'description'|'sku'|'category'|'mode'|'campaignId'|'saleCents'|'status'>[];variants:Pick<Variant,'id'|'productId'|'name'|'attributes'|'status'|'availableQuantity'>[];links:{campaignId:string;productId:string}[];combos:Combo[];comboItems:ComboItem[];reservationMinutes?:number|null};
export type PurchasedItem={id:string;productName:string;variantName:string;quantity:number;unitPriceCents:number;fulfillment:string;productionStatus:string;allocatedQuantity:number};
export type OrderSummary={id:string;campaignId:string;campaignName:string;buyerName:string;totalCents:number;status:string;paymentStatus:string;deliveryStatus:string;createdAt:string;version:number;openIssues?:number;items?:PurchasedItem[]};
export type OrderList={orders:OrderSummary[];canManage:boolean;total:number;page:number;pageSize:number;pages:number;summary:{total:number;paymentPending:number;review:number;ready:number;completed:number;refunds:number}};
export type OrderItem={id:string;variant_id:string;product_name:string;variant_name:string;quantity:number;unit_price_cents:number;fulfillment:string;allocation_status:string;allocated_quantity:number;expires_at:string|null;production_status:string};
export type Incident={id:string;status:'open'|'resolved';note:string;actor:string;resolution:string|null;resolvedBy:string|null;createdAt:string;resolvedAt:string|null};
export type OrderDetail={order:{id:string;campaign_id:string;buyer_name:string;buyer_contact?:string;status:string;payment_status:string;delivery_status:string;total_cents:number;paid_at:string|null;collected_at:string|null;version:number;campaignStage:string;campaignName:string};items:OrderItem[];events:{id:string;action:string;actor?:string;note?:string;createdAt:string}[];incidents:Incident[];paymentReceipts:{id:string;name:string;mime:string;createdAt:string;uploader?:string;hasContent:boolean;deletedAt?:string}[];availableActions:string[];pixInstructions:string;canManage:boolean};
export type Production={variants:{variantId:string;productName:string;variantName:string;paidQuantity:number;pendingQuantity:number;cancelledQuantity:number;reviewQuantity:number;deliveredQuantity:number;allocatedQuantity:number;outstandingQuantity:number;neededQuantity:number;producingQuantity:number;receivedQuantity:number;freeQuantity:number}[];receipts:{id:string;variantId:string;productName:string;variantName:string;quantity:number;expectedQuantity:number;allocatedQuantity:number;reference:string;actor:string;createdAt:string}[]};
export type OrderSettings={reservationMinutes:number|null;pixInstructions:string;revision:number};
export type OrderDraft={buyerPersonId:string;buyerName:string;buyerContact:string;items:{variantId?:string;comboId?:string;quantity:string}[]};
export const emptyOrderDraft=():OrderDraft=>({buyerPersonId:'',buyerName:'',buyerContact:'',items:[{variantId:'',quantity:'1'}]});
export {newRequestKey} from "./request-key";
export const orderLabels:Record<string,string>={pending:'Pendente',confirmed:'Confirmado',expired:'Reserva vencida',review:'Revisão administrativa',cancelled:'Cancelado',completed:'Concluído',problem:'Problema no pagamento',paid:'Pago',refund_required:'Reembolso manual pendente',refunded:'Reembolso comprovado',waiting:'Aguardando',ready:'Pronto para retirada',collected:'Retirado',none:'Sem alocação',provisional:'Reserva provisória',committed:'Alocado',released:'Liberado',consumed:'Entregue',in_production:'Em produção',received:'Recebido',not_needed:'Estoque físico'};
export const actionLabels:Record<string,string>={pay:'Confirmar Pix recebido',payment_problem:'Registrar problema no Pix',allocate:'Regularizar alocação e usar sobras',ready:'Marcar pronto para retirada',collect:'Registrar retirada',cancel:'Cancelar pedido',refund:'Registrar reembolso comprovado',exception:'Abrir pendência administrativa',resolve_exception:'Resolver pendência'};
export const orderTime=(v:string)=>new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
export function commercialOrderFailure(error:unknown){
  if(error instanceof TypeError||(error as {code?:string})?.code==='internal_error')return 'Não foi possível concluir a operação. Tente novamente.';
  return (error as Error).message;
}
export function buyerOrderLabel(o:Pick<OrderSummary,'status'|'paymentStatus'|'deliveryStatus'>){
  if(o.deliveryStatus==='collected'||o.status==='completed')return 'Já retirado';
  if(o.status==='cancelled')return 'Cancelado';
  if(o.status==='expired')return 'Reserva vencida';
  if(o.status==='review')return 'Aguardando regularização';
  if(o.deliveryStatus==='ready')return 'Para retirada';
  if(o.paymentStatus==='pending')return 'Aguardando pagamento';
  if(o.paymentStatus==='problem')return 'Pagamento com pendência';
  return 'Preparando seu pedido';
}
export function orderEventLabel(action:string){const names:Record<string,string>={'order.created':'Pedido registrado','reservation.expired':'Reserva vencida','payment.confirmed':'Pix conferido','payment.confirmed_late':'Pix conferido após vencimento — revisar alocação','production.started':'Produção iniciada','production.received':'Mercadoria recebida','administrative.exception':'Pendência administrativa aberta','administrative.resolved':'Pendência administrativa resolvida'};return names[action]??actionLabels[action.replace('order.','')]??'Operação registrada';}
export function nextOrderStep(detail:OrderDetail){
  const o=detail.order;
  if(o.status==='completed')return 'Retirada concluída. O histórico permanece disponível.';
  if(o.status==='cancelled')return o.payment_status==='refund_required'?'Pedido cancelado. A equipe precisa concluir e registrar o reembolso manual.':'Pedido cancelado. Consulte os registros abaixo.';
  if(o.status==='review')return 'Pagamento conferido, mas a reserva venceu. A equipe precisa verificar as unidades antes de confirmar a compra.';
  if(o.status==='expired')return 'A reserva venceu e as unidades foram liberadas. Consulte a equipe antes de realizar o pagamento.';
  if(o.payment_status==='problem')return 'A conferência do Pix encontrou uma pendência. Consulte a equipe responsável.';
  if(o.payment_status!=='paid')return 'Aguardando recebimento e conferência manual do Pix.';
  if(o.delivery_status==='ready')return 'Seu pedido está pronto. Combine a retirada com a equipe da campanha.';
  if(detail.items.some(i=>i.allocated_quantity<i.quantity))return detail.items.some(i=>i.production_status==='in_production')?'Produção em andamento. O pedido ficará disponível após receber todos os itens.':'Pagamento confirmado. A equipe está organizando a produção ou a alocação dos itens.';
  return o.campaignStage==='collection'?'Todos os itens estão disponíveis. A equipe precisa concluir a separação para liberar a retirada.':'Todos os itens estão disponíveis. A retirada será organizada na segunda etapa da campanha.';
}
