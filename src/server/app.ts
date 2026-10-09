import Fastify from 'fastify';
import { z } from 'zod';
import type { IdentityGateway } from './auth.js';
import { Forbidden, InstitutionalService, NotFound, Conflict } from './service.js';

const id = z.string().uuid();
const role = z.enum(['president', 'vice_president', 'counselor', 'director', 'member']);
export function buildApp(service: InstitutionalService, identity: IdentityGateway) {
  const app = Fastify({ logger: false });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof Forbidden) return reply.code(403).send({ error: 'forbidden', message: error.message });
    if (error instanceof NotFound) return reply.code(404).send({ error: 'not_found', message: error.message });
    if (error instanceof Conflict) return reply.code(409).send({ error: 'conflict', message: error.message });
    if (error instanceof z.ZodError) return reply.code(400).send({ error: 'invalid_request', issues: error.issues });
    return reply.code(500).send({ error: 'internal_error' });
  });
  const actor = async () => { const value = await identity.current(); if (!value) throw new Forbidden('Honji identity integration is unavailable'); if (!value.projectAccess) throw new Forbidden('project.access is required'); return value; };
  app.get('/health', async () => ({ ok: true }));
  app.get('/api/me', async () => { const current = await actor(); const membership = await service.membership(current); return { subject: current.subject, displayName: current.displayName, projectAccess: current.projectAccess, owner: current.owner, membership: membership ? { id: membership.id, role: membership.role, status: membership.status } : null, integration: 'honji-bff-pending' }; });
  app.get('/api/organization', async () => { await actor(); return service.organization(); });
  app.get('/api/organization/departments', async () => { await actor(); return service.departments(); });
  app.get('/api/members', async () => service.listMembers(await actor()));
  app.post('/api/members', async (request, reply) => { const body = z.object({ honjiSubject: z.string().min(1).max(255), displayName: z.string().min(1).max(255), role: role.optional() }).parse(request.body); const out = await service.createMembership(await actor(), body); return reply.code(201).send(out); });
  app.patch('/api/members/:id', async (request) => { const body = z.object({ role: role.optional(), status: z.enum(['active', 'suspended', 'ended']).optional() }).refine((v) => v.role || v.status).parse(request.body); return service.updateMembership(await actor(), id.parse((request.params as { id: string }).id), body); });
  app.get('/api/departments/:id/participants', async (request) => service.departmentParticipants(await actor(), id.parse((request.params as { id: string }).id)));
  app.post('/api/departments/:id/participants', async (request, reply) => { const body = z.object({ membershipId: id, kind: z.enum(['director', 'member']).default('member') }).parse(request.body); const out = await service.joinDepartment(await actor(), id.parse((request.params as { id: string }).id), body.membershipId, body.kind); return reply.code(201).send(out); });
  app.delete('/api/departments/:id/participants/:membershipId', async (request, reply) => { const params = request.params as { id: string; membershipId: string }; await service.leaveDepartment(await actor(), id.parse(params.id), id.parse(params.membershipId)); return reply.code(204).send(); });
  app.get('/api/workspaces', async () => service.listWorkspaces(await actor()));
  app.get('/api/workspaces/:id', async (request) => service.workspace(await actor(), id.parse((request.params as { id: string }).id)));
  app.post('/api/workspaces', async (request, reply) => { const body = z.object({ name: z.string().min(1).max(160), description: z.string().max(5000).optional(), departmentId: id.optional() }).parse(request.body); const out = await service.createWorkspace(await actor(), body); return reply.code(201).send(out); });
  app.patch('/api/workspaces/:id', async (request) => { const body = z.object({ name: z.string().min(1).max(160).optional(), description: z.string().max(5000).optional(), archive: z.boolean().optional(), addMembershipId: id.optional(), removeMembershipId: id.optional() }).refine((v) => Object.keys(v).length > 0).parse(request.body); return service.manageWorkspace(await actor(), id.parse((request.params as { id: string }).id), body); });
  return app;
}
