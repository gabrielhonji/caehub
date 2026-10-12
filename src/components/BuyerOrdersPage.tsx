import { CommercialOrders } from './CommercialOrders';
import { Eyebrow } from './primitives';
import '../styles/commercial.css';

export function BuyerOrdersPage({orderId}:{orderId?:string}){
  return <><section className="commercial-heading buyer-page-heading"><div><Eyebrow>MINHA CONTA · COMPRAS</Eyebrow><h1>Seus pedidos,<br/><em>cada etapa.</em></h1><p>Consulte os produtos e quantidades que você comprou, o pagamento, a produção e a retirada.</p><a className="button button-secondary" href="#/comercial/comprar">Ir para a lojinha →</a></div><aside><Eyebrow>RETIRADA</Eyebrow><p>Quando a equipe liberar seu pedido, ele aparecerá como Para retirada. A entrega é confirmada pela equipe e permanece no histórico como Já retirado.</p></aside></section><CommercialOrders mode="mine" initialOrderId={orderId}/></>;
}
