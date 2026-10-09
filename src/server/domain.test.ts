import test from 'node:test';
import assert from 'node:assert/strict';
import { DevelopmentIdentityGateway, configuredGateway } from './auth.js';
import { isInstitutionAdmin, mayManageDepartment } from './domain.js';

test('only the central Owner or equivalent institutional roles administer the organization', () => {
  const member = { id: 'm', role: 'member' as const, status: 'active' as const };
  const president = { ...member, role: 'president' as const };
  assert.equal(isInstitutionAdmin({ subject: 'x', displayName: 'X', projectAccess: true, owner: false }, member), false);
  assert.equal(isInstitutionAdmin({ subject: 'x', displayName: 'X', projectAccess: true, owner: false }, president), true);
  assert.equal(isInstitutionAdmin({ subject: 'x', displayName: 'X', projectAccess: true, owner: true }, member), true);
});
test('director authority remains contextual to the managed department', () => {
  const director = { id: 'm', role: 'director' as const, status: 'active' as const };
  const actor = { subject: 'x', displayName: 'X', projectAccess: true, owner: false };
  assert.equal(mayManageDepartment(actor, director, true), true);
  assert.equal(mayManageDepartment(actor, director, false), false);
});
test('development identity is process configured and unavailable in production', async () => {
  const dev = new DevelopmentIdentityGateway({ subject: 'dev', displayName: 'Dev', projectAccess: true, owner: false });
  assert.equal((await dev.current())?.subject, 'dev');
  assert.equal(await configuredGateway({ NODE_ENV: 'production', CAEHUB_DEV_ACTOR_ID: 'dev' }).current(), undefined);
});
