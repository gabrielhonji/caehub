import { configFromEnv, connect, migrate } from './database.js';
const db = await connect(configFromEnv(process.env));
await migrate(db); await db.close();
