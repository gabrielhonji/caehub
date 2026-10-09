import assert from 'node:assert/strict';
import test from 'node:test';
import manifest from '../../package.json' with { type: 'json' };
import { buildApp } from './app.js';

test('health exposes the shared version and release metadata', async () => {
  const app = buildApp({ db: {} } as never, { current: async () => undefined });
  const response = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true, version: manifest.version, release: manifest.release });
  await app.close();
});
