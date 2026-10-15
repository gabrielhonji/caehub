import { CommercialOrders } from './CommercialOrders';
import { Eyebrow } from './primitives';
import '../styles/commercial.css';

export function BuyerOrdersPage({orderId}:{orderId?:string}){
  return <><section className="commercial-heading buyer-page-heading"><div><Eyebrow>MINHA CONTA · COMPRAS</Eyebrow><h1>Meus pedidos.</h1><p>Consulte os produtos e quantidades que você comprou, o pagamento, a produção e a retirada.</p><a className="button button-secondary" href="#/comercial/comprar">Ir para a lojinha →</a></div></section><CommercialOrders mode="mine" initialOrderId={orderId}/></>;
}
