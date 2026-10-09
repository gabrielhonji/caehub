import { configuredGateway } from './auth.js';
import { buildApp } from './app.js';
import { configFromEnv, connect, migrate } from './database.js';
import { InstitutionalService } from './service.js';

const db = await connect(configFromEnv(process.env));
await migrate(db);
const app = buildApp(new InstitutionalService(db), configuredGateway(process.env));
await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 8080) });
const close = async () => { await app.close(); await db.close(); };
process.on('SIGTERM', close); process.on('SIGINT', close);
