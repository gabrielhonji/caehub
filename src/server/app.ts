import {OpinionPolls} from './opinion-polls.js';
import {CommercialAnalytics} from './commercial-analytics.js';
import Fastify from 'fastify';
import manifest from '../../package.json' with { type: 'json' };
import { z } from 'zod';
import { AuthenticationFailure, HonjiGateway, loginFailurePage, type IdentityGateway } from './auth.js';
import { Forbidden, InstitutionalService, NotFound, Conflict } from './service.js';
import { KanbanService } from './kanban.js';
import { AgendaService } from './agenda.js';
import { extractTimetable } from './timetable.js';
import { TimetableService } from './timetable-service.js';
import { AvailabilityRequests } from './availability-requests.js';
import { MeetingPolls } from './meeting-polls.js';
import { Shifts, ScheduleConflict } from './shifts.js';
import { CommercialService, productInput, productFields, variantInput, movementInput } from './commercial.js';
import { optionsInput } from './commercial-catalog.js';
import { OrderService, orderInput, purchaseInput, orderAction, orderListInput, receiptInput, settingsInput } from './orders.js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const id = z.string().uuid();
const role = z.enum(['president', 'vice_president', 'counselor', 'director', 'member']);
export function buildApp(service: InstitutionalService, identity: IdentityGateway) {
  const app = Fastify({ logger: false });
  identity.register?.(app);
  app.addHook('onSend',async(_request,reply,payload)=>{reply.header('x-content-type-options','nosniff').header('referrer-policy','same-origin').header('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");return payload;});
  app.addHook('onSend',async(request,reply,payload)=>{if(request.url.startsWith('/api/')||request.url.startsWith('/auth/')||request.url.startsWith('/acesso'))reply.header('cache-control','no-store');return payload;});
  const kanban = new KanbanService(service.db, service);
  const agenda = new AgendaService(service.db, service);
  const timetables = new TimetableService(service.db, service);
  const availabilityRequests = new AvailabilityRequests(service.db,service,agenda);
  const polls = new MeetingPolls(service.db,service,agenda), shifts = new Shifts(service.db,service,agenda);
  app.addContentTypeParser('application/pdf', { parseAs: 'buffer', bodyLimit: 5 * 1024 * 1024 }, (_request, body, done) => done(null, body));
  app.setErrorHandler((error, _request, reply) => {
    if(error instanceof AuthenticationFailure){if(_request.url.startsWith('/auth/callback'))return loginFailurePage(reply,error.status,error.message);return reply.code(error.status).send({error:error.code,message:error.message});}
    if ((error as { code?: string }).code === 'FST_ERR_CTP_BODY_TOO_LARGE') return reply.code(413).send({ error: 'payload_too_large', message: 'O arquivo ou formulário excede o tamanho permitido.' });
    if (error instanceof Forbidden) return reply.code(403).send({ error: 'forbidden', message: error.message });
    if (error instanceof NotFound) return reply.code(404).send({ error: 'not_found', message: error.message });
    if (error instanceof ScheduleConflict) return reply.code(409).send({error:'schedule_conflict',message:error.message});
    if (error instanceof Conflict) return reply.code(409).send({ error: 'conflict', message: error.message });
    if (error instanceof z.ZodError) return reply.code(400).send({ error: 'invalid_request', ...(_request.url.startsWith('/api/commercial')?{message:'Confira os campos obrigatórios, preços e opções selecionadas.'}:{}), issues: error.issues });
    return reply.code(500).send({ error: 'internal_error' });
  });
  const actor = async (request: import("fastify").FastifyRequest,accountOnly=false) => { const value = await identity.current(request); if (!value) {if(identity instanceof HonjiGateway)throw new AuthenticationFailure(401,'session_required','Sua sessão expirou. Entre novamente para continuar.');throw new Forbidden('Honji identity integration is unavailable');} if (!value.projectAccess&&!(accountOnly&&value.accountAccess)) throw new Forbidden('project.access is required'); if(value.debugView&&value.debugView.mode!=='real'&&!['GET','HEAD'].includes(request.method))throw new Forbidden('debug profiles are read-only'); if(!accountOnly)await service.requireMember(value); return value; };
  const commercial=new CommercialService(service.db,service);
  const orders=new OrderService(service.db,service);
  app.get('/api/public/catalog',async(_request,reply)=>{reply.header('cache-control','no-store');return orders.publicCatalog();});
  app.get('/api/public/buyer-status',async(request,reply)=>{
    reply.header('cache-control','no-store');
    let current;
    try{current=await identity.current(request);}catch(error){if(error instanceof AuthenticationFailure&&error.status===403&&error.code==='access_denied')return {canBuy:false,sessionDenied:true};throw error;}
    if(!current||(current.debugView&&current.debugView.mode!=='real'))return {canBuy:false};
    try{await orders.buyer(current);return {canBuy:true};}catch(error){if(error instanceof Forbidden)return current.accountAccess?{canBuy:false,authenticated:true,requiresStudentEmail:true}:{canBuy:false};throw error;}
  });
  const paramId=(request:import('fastify').FastifyRequest)=>id.parse((request.params as {id:string}).id);
  app.get('/api/commercial/orders',async request=>orders.list(await actor(request),undefined,orderListInput.parse(request.query)));
  app.get('/api/commercial/shop',async request=>orders.shop(await actor(request,true)));
  app.get('/api/commercial/my-orders',async request=>orders.list(await actor(request,true),undefined,orderListInput.parse({...request.query as object,mine:'true'})));
  app.get('/api/commercial/my-orders/:id',async request=>orders.detail(await actor(request,true),paramId(request),true));
  app.post('/api/commercial/my-orders',async(request,reply)=>reply.code(201).send(await orders.buy(await actor(request,true),purchaseInput.parse(request.body))));
  app.post('/api/commercial/orders',async(request,reply)=>reply.code(201).send(await orders.create(await actor(request),orderInput.parse(request.body))));
  app.get('/api/commercial/orders/:id',async request=>orders.detail(await actor(request),paramId(request)));
  app.post('/api/commercial/orders/:id/actions',async request=>orders.act(await actor(request),paramId(request),orderAction.parse(request.body)));
  app.get('/api/commercial/settings',async request=>orders.settings(await actor(request)));
  app.put('/api/commercial/settings',async request=>orders.configure(await actor(request),settingsInput.parse(request.body)));
  app.get('/api/commercial/buyers',async request=>{await orders.manage(await actor(request));return service.db.many<import('mysql2').RowDataPacket>("SELECT p.id,p.display_name AS name FROM people p JOIN memberships m ON m.person_id=p.id WHERE m.organization_id=? AND p.honji_subject NOT LIKE 'caehub-debug-%' ORDER BY p.display_name",['1a4e0bd0-5f4a-4d10-8000-000000000001']);});
  app.post('/api/commercial/reservations/reconcile',async request=>{await orders.manage(await actor(request));await orders.reconcile();return {ok:true};});
  app.get('/api/commercial/campaigns/:id/production',async request=>orders.production(await actor(request),paramId(request)));
  app.post('/api/commercial/campaigns/:id/production/start',async request=>orders.startProduction(await actor(request),paramId(request),z.object({variantId:id}).strict().parse(request.body).variantId));
  app.post('/api/commercial/campaigns/:id/production/receipts',async(request,reply)=>reply.code(201).send(await orders.receive(await actor(request),paramId(request),receiptInput.parse(request.body))));
  app.get('/api/commercial',async request=>commercial.catalog(await actor(request)));
  app.post("/api/commercial/categories",async(request,reply)=>reply.code(201).send(await commercial.products.createCategory(await actor(request),z.object({name:z.string().trim().min(1).max(120),options:optionsInput.default([])}).strict().parse(request.body))));
  app.patch("/api/commercial/categories/:id",async request=>commercial.products.updateCategory(await actor(request),paramId(request),z.object({options:optionsInput,revision:z.number().int().positive()}).strict().parse(request.body)));
  const campaignInput=z.object({name:z.string().trim().min(1).max(160),description:z.string().max(2000).default(''),semester:z.string().regex(/^\d{4}\.[12]$/).or(z.literal('')).default(''),stage:z.enum(['orders','collection']).default('orders')}).strict();
  app.post('/api/commercial/campaigns',async(request,reply)=>reply.code(201).send(await commercial.createCampaign(await actor(request),campaignInput.parse(request.body))));
  app.patch('/api/commercial/campaigns/:id',async request=>commercial.updateCampaign(await actor(request),paramId(request),campaignInput.extend({status:z.enum(['active','archived']),version:z.number().int().positive()}).strict().parse(request.body)));
  app.delete('/api/commercial/products/:id/campaigns/:campaignId',async request=>commercial.unlink(await actor(request),paramId(request),id.parse((request.params as {campaignId:string}).campaignId)));
  app.post('/api/commercial/products',async(request,reply)=>reply.code(201).send(await commercial.products.create(await actor(request),productInput.parse(request.body))));
  app.patch('/api/commercial/products/:id',async request=>commercial.products.update(await actor(request),paramId(request),productFields.extend({status:z.enum(['active','archived']),version:z.number().int().positive()}).strict().parse(request.body)));
  app.post('/api/commercial/products/:id/variants',async(request,reply)=>reply.code(201).send(await commercial.products.addVariants(await actor(request),paramId(request),z.object({options:optionsInput,version:z.number().int().positive()}).strict().parse(request.body))));
  app.patch('/api/commercial/products/:id/variants/:variantId',async request=>{const input=variantInput.extend({status:z.enum(['active','archived'])}).strict().parse(request.body);return commercial.products.editVariant(await actor(request),paramId(request),id.parse((request.params as {variantId:string}).variantId),input);});
  app.post('/api/commercial/products/:id/campaigns',async request=>commercial.link(await actor(request),paramId(request),z.object({campaignId:id}).strict().parse(request.body).campaignId));
  app.post('/api/commercial/variants/:id/movements',async(request,reply)=>reply.code(201).send(await commercial.move(await actor(request),paramId(request),movementInput.parse(request.body))));
  app.get('/api/commercial/variants/:id/movements',async request=>commercial.history(await actor(request),paramId(request)));
  const analytics=new CommercialAnalytics(service.db,service);
  app.get('/api/commercial/analytics',async request=>analytics.report(await actor(request),z.object({campaignId:id.optional()}).parse(request.query).campaignId));
  app.put('/api/commercial/analytics/:id',async request=>analytics.configure(await actor(request),paramId(request),z.object({fixedCostCents:z.number().int().min(0).max(2147483647).nullable(),revenueGoalCents:z.number().int().min(0).max(2147483647).nullable(),costBudgetCents:z.number().int().min(0).max(2147483647).nullable(),profitGoalCents:z.number().int().min(0).max(2147483647).nullable(),revision:z.number().int().min(0)}).strict().parse(request.body)));
  app.get('/health', async (request) => ({ ok: true, version: manifest.version, release: manifest.release }));
  app.get('/api/me', async (request) => { const current = await actor(request,true); const membership = current.projectAccess?await service.membership(current):undefined;
    let commercialWorkspaceAccess=false;
    if(current.projectAccess&&membership?.status==='active'){
      try{await commercial.authorize(current);commercialWorkspaceAccess=true;}catch(e){if(!(e instanceof Forbidden))throw e;}
      if(!commercialWorkspaceAccess)commercialWorkspaceAccess=await service.canViewAll(current,membership);
      if(!commercialWorkspaceAccess)try{await analytics.access(current);commercialWorkspaceAccess=true;}catch(e){if(!(e instanceof Forbidden))throw e;}
    }
    return { commercialWorkspaceAccess, subject: current.subject, displayName: current.displayName, projectAccess: current.projectAccess, buyerAccess:current.buyerAccess===true, institutionalAccess:Boolean(current.projectAccess&&membership?.status==='active'), owner: current.owner, csrfToken:(request as any).caehubCsrf??'', membership: membership ? { id: membership.id, role: membership.role, status: membership.status } : null, integration: 'honji-bff', debugView:current.debugView }; });
  app.get('/api/organization', async (request) => { await actor(request); return service.organization(); });
  app.get('/api/organization/departments', async (request) => { await actor(request); return service.departments(); });
  app.get('/api/members', async (request) => service.listMembers(await actor(request)));
  app.post('/api/members', async (request, reply) => { const body = z.object({ honjiSubject: z.string().min(1).max(255), displayName: z.string().min(1).max(255), role: role.optional() }).parse(request.body); const out = await service.createMembership(await actor(request), body); return reply.code(201).send(out); });
  app.patch('/api/members/:id', async (request) => { const body = z.object({ role: role.optional(), status: z.enum(['active', 'suspended', 'ended']).optional() }).refine((v) => v.role || v.status).parse(request.body); return service.updateMembership(await actor(request), id.parse((request.params as { id: string }).id), body); });
  app.get('/api/departments/:id/participants', async (request) => service.departmentParticipants(await actor(request), id.parse((request.params as { id: string }).id)));
  app.post('/api/departments/:id/participants', async (request, reply) => { const body = z.object({ membershipId: id, kind: z.enum(['director', 'member']).default('member') }).parse(request.body); const out = await service.joinDepartment(await actor(request), id.parse((request.params as { id: string }).id), body.membershipId, body.kind); return reply.code(201).send(out); });
  app.delete('/api/departments/:id/participants/:membershipId', async (request, reply) => { const params = request.params as { id: string; membershipId: string }; await service.leaveDepartment(await actor(request), id.parse(params.id), id.parse(params.membershipId)); return reply.code(204).send(); });
  app.get('/api/workspaces', async (request) => service.listWorkspaces(await actor(request)));
  app.get('/api/workspaces/:id', async (request) => service.workspace(await actor(request), id.parse((request.params as { id: string }).id)));
  app.post('/api/workspaces', async (request, reply) => { const body = z.object({ name: z.string().min(1).max(160), description: z.string().max(5000).optional(), departmentId: id.optional() }).parse(request.body); const out = await service.createWorkspace(await actor(request), body); return reply.code(201).send(out); });
  app.patch('/api/workspaces/:id', async (request) => { const body = z.object({ name: z.string().min(1).max(160).optional(), description: z.string().max(5000).optional(), archive: z.boolean().optional(), addMembershipId: id.optional(), removeMembershipId: id.optional() }).refine((v) => Object.keys(v).length > 0).parse(request.body); return service.manageWorkspace(await actor(request), id.parse((request.params as { id: string }).id), body); });
  app.get('/api/workspaces/:id/boards', async (request) => kanban.listBoards(await actor(request), id.parse((request.params as { id: string }).id)));
  app.post('/api/workspaces/:id/boards', async (request, reply) => { const body=z.object({name:z.string().trim().min(1).max(160)}).parse(request.body); return reply.code(201).send(await kanban.createBoard(await actor(request),id.parse((request.params as {id:string}).id),body.name)); });
  app.get('/api/boards/:id', async (request) => kanban.board(await actor(request),id.parse((request.params as {id:string}).id)));
  app.get('/api/boards/:id/archived-cards', async (request) => kanban.archived(await actor(request),id.parse((request.params as {id:string}).id)));
  app.post('/api/boards/:id/columns', async (request,reply)=>{const body=z.object({name:z.string().trim().min(1).max(120)}).parse(request.body);return reply.code(201).send(await kanban.addColumn(await actor(request),id.parse((request.params as {id:string}).id),body.name,z.string().uuid().optional().parse(request.headers['idempotency-key'])));});
  app.patch('/api/columns/:id', async(request)=>{const body=z.object({name:z.string().trim().min(1).max(120).optional(),position:z.number().int().min(0).optional()}).refine(v=>Object.keys(v).length>0).parse(request.body);return kanban.updateColumn(await actor(request),id.parse((request.params as {id:string}).id),body);});
  app.delete('/api/columns/:id',async(request,reply)=>{const query=z.object({targetColumnId:id}).parse(request.query);await kanban.deleteColumn(await actor(request),id.parse((request.params as {id:string}).id),query.targetColumnId);return reply.code(204).send();});
  const cardInput=z.object({title:z.string().trim().min(1).max(200),description:z.string().max(10000).optional(),columnId:id.optional(),responsibleMembershipId:id.optional(),priority:z.enum(['low','normal','high']).optional(),dueAt:z.string().datetime().optional(),visibility:z.enum(['members','directors']).optional(),tags:z.array(z.string().trim().min(1).max(40)).max(12).optional()});
  app.post('/api/boards/:id/cards',async(request,reply)=>reply.code(201).send(await kanban.createCard(await actor(request),id.parse((request.params as {id:string}).id),cardInput.parse(request.body),z.string().uuid().optional().parse(request.headers['idempotency-key']))));
  app.get('/api/cards/:id',async request=>kanban.detail(await actor(request),id.parse((request.params as {id:string}).id)));
  app.patch('/api/cards/:id',async request=>{const body=z.object({title:z.string().trim().min(1).max(200).optional(),description:z.string().max(10000).nullable().optional(),priority:z.enum(['low','normal','high']).optional(),dueAt:z.string().datetime().nullable().optional(),visibility:z.enum(['members','directors']).optional(),tags:z.array(z.string().trim().min(1).max(40)).max(12).optional(),archived:z.boolean().optional()}).refine(v=>Object.keys(v).length>0).parse(request.body);return kanban.updateCard(await actor(request),id.parse((request.params as {id:string}).id),body);});
  app.post('/api/cards/:id/move',async request=>{const body=z.object({columnId:id,version:z.number().int().positive()}).parse(request.body);return kanban.moveCard(await actor(request),id.parse((request.params as {id:string}).id),body.columnId,body.version);});
  app.post('/api/cards/:id/helpers/me',async request=>kanban.volunteer(await actor(request),id.parse((request.params as {id:string}).id)));
  app.delete('/api/cards/:id/helpers/me',async(request,reply)=>{await kanban.leave(await actor(request),id.parse((request.params as {id:string}).id));return reply.code(204).send();});
  app.post('/api/cards/:id/transfers',async(request,reply)=>{const body=z.object({toMembershipId:id}).parse(request.body);return reply.code(201).send(await kanban.requestTransfer(await actor(request),id.parse((request.params as {id:string}).id),body.toMembershipId));});
  app.post('/api/transfers/:id/decision',async request=>{const body=z.object({decision:z.enum(['accepted','declined','cancelled'])}).parse(request.body);return kanban.decideTransfer(await actor(request),id.parse((request.params as {id:string}).id),body.decision);});
  app.post('/api/cards/:id/checklist',async(request,reply)=>{const body=z.object({content:z.string().trim().min(1).max(500)}).parse(request.body);return reply.code(201).send(await kanban.checklist(await actor(request),id.parse((request.params as {id:string}).id),body,z.string().uuid().optional().parse(request.headers['idempotency-key'])));});
  app.patch('/api/checklist/:id',async request=>{const body=z.object({completed:z.boolean()}).parse(request.body);return kanban.toggleChecklist(await actor(request),id.parse((request.params as {id:string}).id),body.completed);});
  app.post('/api/cards/:id/comments',async(request,reply)=>{const body=z.object({body:z.string().trim().min(1).max(5000)}).parse(request.body);return reply.code(201).send(await kanban.comment(await actor(request),id.parse((request.params as {id:string}).id),body.body,z.string().uuid().optional().parse(request.headers['idempotency-key'])));});
  app.get('/api/my-tasks',async request=>{const query=z.object({workspaceId:id.optional(),state:z.enum(['open','completed']).optional(),participation:z.enum(['created','responsible','helper']).optional()}).parse(request.query);return kanban.myTasks(await actor(request),query);});
  app.get('/api/foundation',async request=>{
    const current=await actor(request);
    const workspaces=await service.listWorkspaces(current) as Array<{id:string;departmentId?:string|null}>;
    const [tasks,boards]=await Promise.all([kanban.myTasks(current,{state:'open'}),kanban.boardsForWorkspaces(current,workspaces)]);
    return {workspaces,tasks,boards};
  });
  const availabilityInput=z.object({kind:z.enum(['weekly','date']),weekday:z.number().int().min(0).max(6).optional(),date:z.string().date().optional(),startTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),endTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),note:z.string().trim().max(255).optional()}).superRefine((value,context)=>{if(value.kind==='weekly'&&value.weekday===undefined)context.addIssue({code:'custom',message:'weekday is required for weekly blocks'});if(value.kind==='date'&&!value.date)context.addIssue({code:'custom',message:'date is required for date blocks'});});
  app.get('/api/availability/me',async request=>agenda.myAvailability(await actor(request)));
  app.post('/api/availability/import/preview', { bodyLimit: 5 * 1024 * 1024 }, async request => {
    await service.requireMember(await actor(request));
    if (!Buffer.isBuffer(request.body)) throw new Conflict('Envie o arquivo como PDF.');
    return extractTimetable(request.body);
  });
  const importInput = z.object({ term: z.string().trim().min(1).max(80), validFrom: z.string().date(), validTo: z.string().date(), confirmed: z.literal(true), rows: z.array(z.object({ weekday: z.number().int().min(0).max(6), startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) })).min(1).max(200) });
  app.post('/api/availability/import/confirm', async request => timetables.confirm(await actor(request), importInput.parse(request.body)));
  app.put('/api/availability/me/:id/exception', async request => {
    const body = z.object({ date: z.string().date(), excluded: z.boolean() }).parse(request.body);
    return timetables.exception(await actor(request), id.parse((request.params as { id: string }).id), body.date, body.excluded);
  });
  app.post('/api/availability/me',async(request,reply)=>reply.code(201).send(await agenda.createAvailability(await actor(request),availabilityInput.parse(request.body))));
  app.put('/api/availability/me/:id',async request=>agenda.updateAvailability(await actor(request),id.parse((request.params as {id:string}).id),availabilityInput.parse(request.body)));
  app.delete('/api/availability/me/:id',async(request,reply)=>{await agenda.deleteAvailability(await actor(request),id.parse((request.params as {id:string}).id));return reply.code(204).send();});
  app.get('/api/availability/collective',async request=>{const query=z.object({from:z.string().datetime(),to:z.string().datetime(),membershipIds:z.string().optional(),departmentId:id.optional(),offsetMinutes:z.coerce.number().int().min(-840).max(840).optional()}).refine(value=>new Date(value.from)<new Date(value.to),{message:'invalid interval'}).parse(request.query);return agenda.collective(await actor(request),{...query,membershipIds:query.membershipIds?.split(',').filter(Boolean).map(value=>id.parse(value))});});
  app.get('/api/availability/options',async request=>agenda.options(await actor(request)));
  app.get('/api/availability/week',async request=>{
    const query=z.object({from:z.string().datetime(),to:z.string().datetime(),membershipIds:z.string().optional(),departmentIds:z.string().optional(),slotMinutes:z.coerce.number().int().min(15).max(240).default(60),offsetMinutes:z.coerce.number().int().min(-840).max(840).optional()}).refine(value=>Date.parse(value.to)>Date.parse(value.from)&&Date.parse(value.to)-Date.parse(value.from)<=7*86400000,{message:'Selecione até uma semana.'}).parse(request.query);
    return agenda.collective(await actor(request),{...query,membershipIds:query.membershipIds?.split(',').filter(Boolean).map(value=>id.parse(value)),departmentIds:query.departmentIds?.split(',').filter(Boolean).map(value=>id.parse(value))});
  });
  app.get('/api/availability/requests',async request=>availabilityRequests.list(await actor(request)));
  app.post('/api/availability/requests',async request=>availabilityRequests.create(await actor(request),z.object({title:z.string().trim().min(1).max(200),workspaceId:id.optional(),from:z.string().datetime(),to:z.string().datetime(),deadline:z.string().datetime().optional(),participantIds:z.array(id).min(1).max(100)}).parse(request.body)));
  app.post('/api/availability/requests/:id/review',async request=>availabilityRequests.review(await actor(request),id.parse((request.params as {id:string}).id),z.object({kind:z.enum(['unchanged','updated'])}).parse(request.body).kind));
  const agendaQuery=z.object({from:z.string().datetime(),to:z.string().datetime(),scope:z.enum(['personal','general','workspace']).default('personal'),workspaceId:id.optional(),offsetMinutes:z.coerce.number().int().min(-840).max(840).optional()}).refine(value=>new Date(value.from)<new Date(value.to),{message:'invalid interval'});
  app.get('/api/agenda',async request=>agenda.calendar(await actor(request),agendaQuery.parse(request.query)));
  app.get('/api/agenda/foundation',async request=>{
    const current=await actor(request),query=agendaQuery.parse(request.query),membership=await service.requireMember(current);
    const canManage=await service.isAdmin(current,membership)||await service.isDirector(membership.id);const canReadAll=await service.canViewAll(current,membership);
    const [calendar,availability,members,departments,notifications,requests,meetingPolls,operationalShifts]=await Promise.all([agenda.calendar(current,query),agenda.myAvailability(current),canManage||canReadAll?agenda.options(current):Promise.resolve([]),service.departments(),agenda.notifications(current),availabilityRequests.list(current),polls.list(current),shifts.list(current)]);
    return {calendar,availability,members,departments,notifications,requests,polls:meetingPolls,shifts:operationalShifts,session:{membership:{id:membership.id,role:membership.role},owner:current.owner,canManage,canReadAll}};
  });
  const meetingInput=z.object({title:z.string().trim().min(1).max(200),description:z.string().max(10000).optional(),location:z.string().trim().max(255).optional(),workspaceId:id.optional(),startsAt:z.string().datetime(),endsAt:z.string().datetime(),participantIds:z.array(id).max(100).default([])});
  app.get('/api/meetings',async request=>agenda.meetingList(await actor(request),z.object({archived:z.enum(['true','false']).optional()}).parse(request.query).archived==='true'));
  app.post('/api/meetings/:id/archive',async request=>agenda.archiveMeeting(await actor(request),paramId(request),z.object({expectedRevision:z.number().int().positive()}).parse(request.body).expectedRevision));
  app.post('/api/meetings',async(request,reply)=>reply.code(201).send(await agenda.createMeeting(await actor(request),meetingInput.parse(request.body))));
  const meetingUpdate=z.object({expectedRevision:z.number().int().positive(),title:z.string().trim().min(1).max(200).optional(),description:z.string().max(10000).optional(),location:z.string().trim().max(255).optional(),workspaceId:id.optional(),startsAt:z.string().datetime().optional(),endsAt:z.string().datetime().optional(),participantIds:z.array(id).max(100).optional()}).refine(value=>Object.keys(value).some(key=>key!=='expectedRevision'));
  app.patch('/api/meetings/:id',async request=>agenda.updateMeeting(await actor(request),id.parse((request.params as {id:string}).id),meetingUpdate.parse(request.body)));
  app.post('/api/meetings/:id/response',async request=>{const body=z.object({response:z.enum(['confirmed','maybe','declined']),justification:z.string().trim().min(1).max(1000).optional()}).parse(request.body);return agenda.respond(await actor(request),id.parse((request.params as {id:string}).id),body.response,body.justification);});
  app.get('/api/agenda/notifications',async request=>agenda.notifications(await actor(request)));
  app.post('/api/agenda/notifications/:id/read',async request=>agenda.readNotification(await actor(request),id.parse((request.params as {id:string}).id)));
  const opinions=new OpinionPolls(service.db,service,agenda);
  app.get('/api/opinion-polls',async request=>opinions.list(await actor(request)));
  app.post('/api/opinion-polls',async(request,reply)=>reply.code(201).send(await opinions.create(await actor(request),z.object({title:z.string().trim().min(1).max(200),description:z.string().trim().max(10000).optional(),workspaceId:id.optional(),deadline:z.string().datetime().optional(),participantIds:z.array(id).min(1).max(100),options:z.array(z.string().trim().min(1).max(300)).min(2).max(30)}).strict().parse(request.body))));
  app.put('/api/opinion-polls/:id/vote',async request=>opinions.act(await actor(request),paramId(request),z.object({optionId:id}).strict().parse(request.body).optionId));
  app.post('/api/opinion-polls/:id/close',async request=>{z.object({confirmed:z.literal(true)}).strict().parse(request.body);return opinions.act(await actor(request),paramId(request));});
  const interval=z.object({startsAt:z.string().datetime(),endsAt:z.string().datetime()});
  app.get('/api/meeting-polls',async request=>polls.list(await actor(request)));
  app.post('/api/meeting-polls',async(request,reply)=>reply.code(201).send(await polls.create(await actor(request),z.object({title:z.string().trim().min(1).max(200),description:z.string().max(10000).optional(),location:z.string().max(255).optional(),workspaceId:id.optional(),deadline:z.string().datetime().optional(),participantIds:z.array(id).min(1).max(100),options:z.array(interval).min(2).max(30)}).parse(request.body))));
  app.put('/api/meeting-polls/:id/vote',async request=>{const body=z.object({optionIds:z.array(id).max(30),noneWorks:z.boolean().default(false),suggestion:z.object({note:z.string().trim().max(1000).optional(),startsAt:z.string().datetime().optional(),endsAt:z.string().datetime().optional()}).optional()}).parse(request.body);return polls.vote(await actor(request),id.parse((request.params as {id:string}).id),body.optionIds,body.noneWorks,body.suggestion);});
  app.post('/api/meeting-polls/:id/close',async request=>{const body=z.object({confirmed:z.literal(true),optionId:id.optional()}).parse(request.body);return polls.close(await actor(request),id.parse((request.params as {id:string}).id),body.confirmed,body.optionId);});
  const shiftInput=z.object({title:z.string().trim().min(1).max(200),description:z.string().max(10000).optional(),location:z.string().max(255).optional(),workspaceId:id,relatedMeetingId:id.nullable().optional(),startsAt:z.string().datetime(),endsAt:z.string().datetime(),minimumCapacity:z.number().int().min(0).max(1000).nullable().optional(),maximumCapacity:z.number().int().min(1).max(1000),priorityWindowHours:z.number().int().min(0).max(8760).optional()});
  app.post('/api/shifts/batch',async(request,reply)=>{const body=z.object({requestKey:id,shifts:z.array(shiftInput).min(1).max(30)}).strict().parse(request.body);return reply.code(201).send(await shifts.createMany(await actor(request),body.requestKey,body.shifts));});
  app.get('/api/shifts',async request=>shifts.list(await actor(request)));
  app.get('/api/shifts/related-meetings',async request=>shifts.relatedMeetings(await actor(request),z.object({workspaceId:id}).parse(request.query).workspaceId));
  app.post('/api/shifts',async(request,reply)=>reply.code(201).send(await shifts.create(await actor(request),shiftInput.parse(request.body))));
  app.put('/api/shifts/:id',async request=>shifts.update(await actor(request),id.parse((request.params as {id:string}).id),shiftInput.extend({expectedRevision:z.number().int().positive()}).parse(request.body)));
  app.post('/api/shifts/:id/participation',async request=>shifts.participate(await actor(request),id.parse((request.params as {id:string}).id),z.object({action:z.enum(['volunteer','assign','accept','decline','withdraw','remove']),membershipId:id.optional(),confirmConflict:z.boolean().optional(),offsetMinutes:z.number().int().min(-840).max(840).optional()}).parse(request.body)));
  app.post('/api/shifts/:id/cancel',async request=>shifts.cancel(await actor(request),id.parse((request.params as {id:string}).id)));
  app.get('/api/shifts/:id/history',async request=>shifts.history(await actor(request),id.parse((request.params as {id:string}).id)));
  app.get('/assets/:file',async(request,reply)=>{
    const file=(request.params as {file:string}).file;
    if(!/^[A-Za-z0-9._-]+$/.test(file))return reply.code(404).send();
    const path=resolve('dist/assets',file);
    const kind=file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':'image/png';
    try {
      const asset=await readFile(path);
      if(/-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(file))reply.header('cache-control','public, max-age=31536000, immutable');
      return reply.type(kind).send(asset);
    } catch(error) {
      if((error as NodeJS.ErrnoException).code==='ENOENT')return reply.code(404).send();
      throw error;
    }
  });
  app.get('/',async(_request,reply)=>reply.type('text/html').send(await readFile(resolve('dist/index.html'))));
  return app;
}
