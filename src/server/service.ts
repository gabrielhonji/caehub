import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { CAECOMP_ORGANIZATION_ID, type Database } from './database.js';
import { isInstitutionAdmin, type Actor, type Membership } from './domain.js';

type MembershipRow = RowDataPacket & Membership & { person_id: string; honji_subject: string; display_name: string };
export class Forbidden extends Error {}
export class NotFound extends Error {}
export class Conflict extends Error {}

export class InstitutionalService {
  constructor(readonly db: Database) {}
  async membership(actor: Actor): Promise<MembershipRow | undefined> {
    return this.db.one<MembershipRow>(`SELECT m.id,m.role,m.status,m.person_id,p.honji_subject,p.display_name FROM memberships m JOIN people p ON p.id=m.person_id WHERE m.organization_id=? AND p.honji_subject=?`, [CAECOMP_ORGANIZATION_ID, actor.subject]);
  }
  async requireMember(actor: Actor): Promise<MembershipRow> {
    if (!actor.projectAccess) throw new Forbidden('project.access is required');
    let value = await this.membership(actor);
    // The central Owner is authoritative without a locally editable Owner role.
    // A local member record only supplies referential integrity and audit context.
    if (!value && actor.owner) {
      const person = await this.db.one<RowDataPacket>('SELECT id FROM people WHERE honji_subject=?', [actor.subject]);
      const personId = person?.id ?? randomUUID();
      if (!person) await this.db.run('INSERT INTO people (id,honji_subject,display_name) VALUES (?,?,?)', [personId, actor.subject, actor.displayName]);
      const membershipId = randomUUID();
      await this.db.run('INSERT INTO memberships (id,organization_id,person_id,role,status) VALUES (?,?,?,?,\'active\')', [membershipId, CAECOMP_ORGANIZATION_ID, personId, 'member']);
      value = await this.membership(actor);
    }
    if (!value || value.status !== 'active') throw new Forbidden('active institutional membership is required');
    return value;
  }
  async isAdmin(actor: Actor, membership: Membership): Promise<boolean> { return isInstitutionAdmin(actor, membership); }
  async canViewAll(actor: Actor, membership: Membership): Promise<boolean> { return await this.isAdmin(actor, membership) || (membership.status === 'active' && membership.role === 'counselor'); }
  async isDirector(membershipId: string): Promise<boolean> { return Boolean(await this.db.one<RowDataPacket>("SELECT dm.id FROM department_memberships dm JOIN memberships m ON m.id=dm.membership_id WHERE dm.membership_id=? AND dm.kind='director' AND dm.ended_at IS NULL AND m.status='active'", [membershipId])); }
  async workspaceParticipants(workspaceId: string) {
    return this.db.many<RowDataPacket>(`SELECT DISTINCT m.id AS membershipId,p.display_name AS displayName,p.honji_subject AS honjiSubject,CASE WHEN EXISTS(SELECT 1 FROM department_memberships direction WHERE direction.department_id=w.department_id AND direction.membership_id=m.id AND direction.kind='director' AND direction.ended_at IS NULL) THEN 'director' WHEN w.department_id IS NOT NULL THEN 'member' ELSE 'participant' END AS kind FROM memberships m JOIN people p ON p.id=m.person_id JOIN workspaces w ON w.organization_id=m.organization_id WHERE w.id=? AND m.status='active' AND p.honji_subject NOT LIKE 'caehub-debug-%' AND (EXISTS(SELECT 1 FROM workspace_participants wp WHERE wp.workspace_id=w.id AND wp.membership_id=m.id) OR EXISTS(SELECT 1 FROM department_memberships dm WHERE dm.department_id=w.department_id AND dm.membership_id=m.id AND dm.ended_at IS NULL)) ORDER BY p.display_name`, [workspaceId]);
  }
  private assertLocalHierarchy(actor: Actor) { if (actor.centralHierarchy) throw new Forbidden('Gerencie cargos e vínculos no painel Honji.'); }
  async managesDepartment(membershipId: string, departmentId: string): Promise<boolean> {
    return Boolean(await this.db.one<RowDataPacket>('SELECT id FROM department_memberships WHERE department_id=? AND membership_id=? AND kind=\'director\' AND ended_at IS NULL', [departmentId, membershipId]));
  }
  async audit(actor: Actor, action: string, resourceType: string, resourceId: string, metadata: object = {}): Promise<void> {
    await this.db.run('INSERT INTO institutional_audit_events (id,organization_id,actor_subject,action,resource_type,resource_id,metadata) VALUES (?,?,?,?,?,?,?)', [randomUUID(), CAECOMP_ORGANIZATION_ID, actor.subject, action, resourceType, resourceId, JSON.stringify(metadata)]);
  }
  async organization() { return this.db.one<RowDataPacket>('SELECT id,slug,name,created_at AS createdAt,updated_at AS updatedAt FROM organizations WHERE id=?', [CAECOMP_ORGANIZATION_ID]); }
  async departments() { return this.db.many<RowDataPacket>('SELECT id,name,created_at AS createdAt FROM departments WHERE organization_id=? ORDER BY name', [CAECOMP_ORGANIZATION_ID]); }
  async listMembers(actor: Actor) {
    const actorMembership = await this.requireMember(actor);
    const admin = await this.canViewAll(actor, actorMembership);
    const where = admin ? '' : 'AND EXISTS (SELECT 1 FROM department_memberships dm WHERE dm.membership_id=m.id AND dm.department_id IN (SELECT department_id FROM department_memberships mine WHERE mine.membership_id=? AND mine.kind=\'director\' AND mine.ended_at IS NULL) AND dm.ended_at IS NULL)';
    const values = admin ? [CAECOMP_ORGANIZATION_ID] : [CAECOMP_ORGANIZATION_ID, actorMembership.id];
    return this.db.many<RowDataPacket>(`SELECT m.id,m.role,m.status,m.started_at AS startedAt,m.ended_at AS endedAt,p.honji_subject AS honjiSubject,p.display_name AS displayName FROM memberships m JOIN people p ON p.id=m.person_id WHERE m.organization_id=? AND p.honji_subject NOT LIKE 'caehub-debug-%' ${where} ORDER BY p.display_name`, values);
  }
  async createMembership(actor: Actor, input: { honjiSubject: string; displayName: string; role?: string }) {
    this.assertLocalHierarchy(actor);
    const manager = await this.requireMember(actor); if (!await this.isAdmin(actor, manager)) throw new Forbidden('institutional administrator required');
    if (input.role === 'owner') throw new Forbidden('Owner is exclusively central');
    const existing = await this.db.one<RowDataPacket>('SELECT id FROM people WHERE honji_subject=?', [input.honjiSubject]);
    const personId = existing?.id ?? randomUUID();
    if (existing) await this.db.run('UPDATE people SET display_name=? WHERE id=?', [input.displayName, personId]); else await this.db.run('INSERT INTO people (id,honji_subject,display_name) VALUES (?,?,?)', [personId, input.honjiSubject, input.displayName]);
    const id = randomUUID();
    try { await this.db.run('INSERT INTO memberships (id,organization_id,person_id,role,status) VALUES (?,?,?,?,\'active\')', [id, CAECOMP_ORGANIZATION_ID, personId, input.role ?? 'member']); } catch { throw new Conflict('person already has an institutional membership'); }
    await this.audit(actor, 'membership.created', 'membership', id, { target: input.honjiSubject }); return { id };
  }
  async updateMembership(actor: Actor, id: string, input: { role?: string; status?: string }) {
    this.assertLocalHierarchy(actor);
    const manager = await this.requireMember(actor); if (!await this.isAdmin(actor, manager)) throw new Forbidden('institutional administrator required');
    if (input.role === 'owner') throw new Forbidden('Owner is exclusively central');
    const target = await this.db.one<RowDataPacket>('SELECT id FROM memberships WHERE id=? AND organization_id=?', [id, CAECOMP_ORGANIZATION_ID]); if (!target) throw new NotFound('membership');
    if (input.role) await this.db.run('UPDATE memberships SET role=? WHERE id=?', [input.role, id]);
    if (input.status) await this.db.run('UPDATE memberships SET status=?, ended_at=IF(?=\'ended\',NOW(),NULL) WHERE id=?', [input.status, input.status, id]);
    await this.audit(actor, 'membership.updated', 'membership', id, input); return { id };
  }
  async joinDepartment(actor: Actor, departmentId: string, membershipId: string, kind: 'director' | 'member') {
    this.assertLocalHierarchy(actor);
    const manager = await this.requireMember(actor); const allowed = await this.isAdmin(actor, manager) || (kind === 'member' && await this.managesDepartment(manager.id, departmentId)); if (!allowed) throw new Forbidden('department manager required');
    if (kind === 'director' && !await this.isAdmin(actor, manager)) throw new Forbidden('only institutional administrators appoint directors');
    const target = await this.db.one<RowDataPacket>('SELECT id FROM memberships WHERE id=? AND organization_id=? AND status=\'active\'', [membershipId, CAECOMP_ORGANIZATION_ID]); if (!target) throw new NotFound('active membership');
    const duplicate = await this.db.one<RowDataPacket>('SELECT id FROM department_memberships WHERE department_id=? AND membership_id=? AND ended_at IS NULL', [departmentId, membershipId]); if (duplicate) throw new Conflict('active department membership already exists');
    const id = randomUUID(); await this.db.run('INSERT INTO department_memberships (id,department_id,membership_id,kind) VALUES (?,?,?,?)', [id, departmentId, membershipId, kind]); await this.audit(actor, 'department_member.added', 'department_membership', id); return { id };
  }
  async departmentParticipants(actor: Actor, departmentId: string) { const member = await this.requireMember(actor); const participates = Boolean(await this.db.one<RowDataPacket>('SELECT id FROM department_memberships WHERE department_id=? AND membership_id=? AND ended_at IS NULL', [departmentId, member.id])); if (!await this.canViewAll(actor, member) && !await this.managesDepartment(member.id, departmentId) && !participates) throw new Forbidden('department access required'); return this.db.many<RowDataPacket>(`SELECT dm.id,dm.kind,m.id AS membershipId,p.display_name AS displayName,p.honji_subject AS honjiSubject FROM department_memberships dm JOIN memberships m ON m.id=dm.membership_id JOIN people p ON p.id=m.person_id WHERE dm.department_id=? AND dm.ended_at IS NULL AND m.status='active' AND p.honji_subject NOT LIKE 'caehub-debug-%' ORDER BY p.display_name`, [departmentId]); }
  async leaveDepartment(actor: Actor, departmentId: string, membershipId: string) { this.assertLocalHierarchy(actor); const manager = await this.requireMember(actor); const admin=await this.isAdmin(actor,manager); const allowed = admin || await this.managesDepartment(manager.id, departmentId); if (!allowed) throw new Forbidden('department manager required'); const relation = await this.db.one<RowDataPacket>('SELECT id,kind FROM department_memberships WHERE department_id=? AND membership_id=? AND ended_at IS NULL', [departmentId, membershipId]); if (!relation) throw new NotFound('department membership'); if(relation.kind==='director'&&!admin)throw new Forbidden('only institutional administrators remove directors'); await this.db.run('UPDATE department_memberships SET ended_at=NOW() WHERE id=?', [relation.id]); await this.audit(actor, 'department_member.ended', 'department_membership', relation.id); }
  async listWorkspaces(actor: Actor) {
    const member = await this.requireMember(actor); const admin = await this.canViewAll(actor, member);
    const values = admin ? [CAECOMP_ORGANIZATION_ID] : [CAECOMP_ORGANIZATION_ID, member.id, member.id];
    return this.db.many<RowDataPacket>(`SELECT DISTINCT w.id,w.name,w.description,w.status,w.department_id AS departmentId,d.name AS department,w.created_at AS createdAt,w.updated_at AS updatedAt,(SELECT COUNT(DISTINCT pm.id) FROM memberships pm WHERE pm.organization_id=w.organization_id AND pm.status='active' AND NOT EXISTS(SELECT 1 FROM people pp WHERE pp.id=pm.person_id AND pp.honji_subject LIKE 'caehub-debug-%') AND (EXISTS(SELECT 1 FROM workspace_participants wp WHERE wp.workspace_id=w.id AND wp.membership_id=pm.id) OR EXISTS(SELECT 1 FROM department_memberships dm WHERE dm.department_id=w.department_id AND dm.membership_id=pm.id AND dm.ended_at IS NULL))) AS participantCount,(SELECT COUNT(*) FROM boards b WHERE b.workspace_id=w.id) AS boardCount FROM workspaces w LEFT JOIN departments d ON d.id=w.department_id WHERE w.organization_id=? AND (w.status='active') ${admin ? '' : "AND (EXISTS (SELECT 1 FROM workspace_participants wp WHERE wp.workspace_id=w.id AND wp.membership_id=?) OR EXISTS (SELECT 1 FROM department_memberships dm WHERE dm.department_id=w.department_id AND dm.membership_id=? AND dm.ended_at IS NULL))"} ORDER BY w.name`, values);
  }
  async workspace(actor: Actor, id: string) { const rows = await this.listWorkspaces(actor); const value = rows.find((row) => row.id === id); if (!value) throw new NotFound('workspace'); const member = await this.requireMember(actor); const readOnly=Boolean(actor.debugView&&actor.debugView.mode!=='real');return { ...value, readOnly, centralHierarchy:Boolean(actor.centralHierarchy),canManage: !readOnly&&(await this.isAdmin(actor,member)||Boolean(value.departmentId&&await this.managesDepartment(member.id,value.departmentId))), participants: await this.workspaceParticipants(id) }; }
  async createWorkspace(actor: Actor, input: { name: string; description?: string; departmentId?: string }) {
    const member = await this.requireMember(actor); const admin = await this.isAdmin(actor, member); if (!admin && (!input.departmentId || !await this.managesDepartment(member.id, input.departmentId))) throw new Forbidden('department director or institutional administrator required');
    if(input.departmentId&&!await this.db.one<RowDataPacket>('SELECT id FROM departments WHERE id=? AND organization_id=?',[input.departmentId,CAECOMP_ORGANIZATION_ID]))throw new NotFound('department'); const id = randomUUID(); await this.db.run('INSERT INTO workspaces (id,organization_id,department_id,creator_membership_id,name,description) VALUES (?,?,?,?,?,?)', [id, CAECOMP_ORGANIZATION_ID, input.departmentId ?? null, member.id, input.name, input.description ?? null]); if(!input.departmentId)await this.db.run('INSERT INTO workspace_participants (workspace_id,membership_id,added_by_membership_id) VALUES (?,?,?)', [id, member.id, member.id]); await this.audit(actor, 'workspace.created', 'workspace', id); return { id };
  }
  async manageWorkspace(actor: Actor, id: string, input: { name?: string; description?: string; archive?: boolean; addMembershipId?: string; removeMembershipId?: string }) {
    const member = await this.requireMember(actor); const workspace = await this.db.one<RowDataPacket>('SELECT id,department_id AS departmentId FROM workspaces WHERE id=? AND organization_id=?', [id, CAECOMP_ORGANIZATION_ID]); if (!workspace) throw new NotFound('workspace'); if (!await this.isAdmin(actor, member) && (!workspace.departmentId || !await this.managesDepartment(member.id, workspace.departmentId))) throw new Forbidden('workspace administrator required');
    if (input.name !== undefined || input.description !== undefined) await this.db.run('UPDATE workspaces SET name=COALESCE(?,name),description=COALESCE(?,description) WHERE id=?', [input.name ?? null, input.description ?? null, id]);
    if (input.archive !== undefined) await this.db.run('UPDATE workspaces SET status=? WHERE id=?', [input.archive ? 'archived' : 'active', id]);
    if(actor.centralHierarchy&&workspace.departmentId&&(input.addMembershipId||input.removeMembershipId))throw new Forbidden('Gerencie os membros deste departamento no Honji.');
    if (input.addMembershipId) await this.db.run('INSERT IGNORE INTO workspace_participants (workspace_id,membership_id,added_by_membership_id) VALUES (?,?,?)', [id, input.addMembershipId, member.id]);
    if (input.removeMembershipId) await this.db.run('DELETE FROM workspace_participants WHERE workspace_id=? AND membership_id=?', [id, input.removeMembershipId]);
    await this.audit(actor, 'workspace.updated', 'workspace', id); return { id };
  }
}
