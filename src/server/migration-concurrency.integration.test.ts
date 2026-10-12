import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { configFromEnv, connect, migrate } from './database.js';

test('concurrent startup migrations serialize DDL on separate sessions and release the schema lock',async()=>{
  const config=configFromEnv(process.env);config.database=`${config.database}_schema_${randomUUID().slice(0,8)}`;
  const first=await connect(config),second=await connect(config);
  try{
    await Promise.all([migrate(first),migrate(second)]);
    const [columns,settings]=await Promise.all([first.one<any>("SHOW COLUMNS FROM commercial_orders LIKE 'version'"),second.one<any>("SHOW COLUMNS FROM commercial_operations LIKE 'revision'")]);
    assert.ok(columns);assert.ok(settings);
    const lock=await second.one<any>("SELECT IS_FREE_LOCK(CONCAT('caehub:migrate:',LEFT(SHA2(DATABASE(),256),48))) AS free");assert.equal(Number(lock.free),1);
    await migrate(second);
    assert.equal(Number((await first.one<any>('SELECT COUNT(*) AS count FROM commercial_operations')).count),1);
  }finally{await first.close();await second.close();}
});
