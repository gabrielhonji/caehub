import { configuredGateway } from './auth.js';
import { buildApp } from './app.js';
import { configFromEnv, connect, migrate } from './database.js';
import { InstitutionalService } from './service.js';
import { OrderService } from './orders.js';

const db = await connect(configFromEnv(process.env));
await migrate(db);
const app = buildApp(new InstitutionalService(db), configuredGateway(process.env,db));
const orders=new OrderService(db,new InstitutionalService(db));
await orders.reconcile();
let reconciling=false;
const reconciliation=setInterval(async()=>{if(reconciling)return;reconciling=true;try{await orders.reconcile();}catch{console.error('Reservation reconciliation failed; availability still excludes expired holds.');}finally{reconciling=false;}},60000);
reconciliation.unref();
await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 8080) });
const close = async () => { clearInterval(reconciliation);await app.close(); await db.close(); };
process.on('SIGTERM', close); process.on('SIGINT', close);
