import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CAECOMP_ORGANIZATION_ID, type Database } from './database.js';
import type { RowDataPacket } from 'mysql2';

const snapshotSchema = z.object({ revision: z.number().int().positive(),
  departments: z.array(z.object({ id: z.string().uuid(), name: z.string().min(1).max(120), directorId: z.string().uuid().nullable(), memberIds: z.array(z.string().uuid()) })),
  roles: z.record(z.string().uuid(), z.enum(['president', 'vice_president', 'counselor', 'member'])),
  roster: z.array(z.object({ id: z.string().uuid(), name: z.string().min(1).max(120) })) });

// Only the service-authenticated Honji decision may supply this snapshot.
// Local memberships remain a projection for referential integrity, never a
// second editable authority once the project's hierarchy is activated.
export async function synchronizeHierarchy(db: Database, input: unknown) {
  const snapshot = snapshotSchema.parse(input);
  const snapshotHash=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  await db.transaction(async tx => {
    await tx.one('SELECT id FROM organizations WHERE id=? FOR UPDATE', [CAECOMP_ORGANIZATION_ID]);
    const cached = await tx.one<RowDataPacket>('SELECT revision,snapshot_hash FROM honji_hierarchy_projection WHERE organization_id=?', [CAECOMP_ORGANIZATION_ID]);
    // Roster eligibility can change without a hierarchy revision (suspension or
    // project-access revocation), so always reconcile it for this revision.
    if (cached && Number(cached.revision) > snapshot.revision) return;
    if(cached&&Number(cached.revision)===snapshot.revision&&cached.snapshot_hash===snapshotHash)return;
    const members = new Map<string, string>();
    for (const user of snapshot.roster) {
      let person = await tx.one<RowDataPacket>('SELECT id FROM people WHERE honji_subject=?', [user.id]);
      if (!person) { const id = randomUUID(); await tx.run('INSERT INTO people(id,honji_subject,display_name) VALUES (?,?,?)', [id, user.id, user.name]); person = { id } as RowDataPacket; }
      else await tx.run('UPDATE people SET display_name=? WHERE id=?', [user.name, person.id]);
      const existing = await tx.one<RowDataPacket>('SELECT id FROM memberships WHERE organization_id=? AND person_id=?', [CAECOMP_ORGANIZATION_ID, person.id]);
      const membershipId = existing?.id ?? randomUUID();
      const directed = snapshot.departments.some(d => d.directorId === user.id);
      const role = snapshot.roles[user.id] && snapshot.roles[user.id] !== 'member' ? snapshot.roles[user.id] : directed ? 'director' : 'member';
      if (existing) await tx.run("UPDATE memberships SET role=?,status='active',ended_at=NULL WHERE id=?", [role, membershipId]);
      else await tx.run("INSERT INTO memberships(id,organization_id,person_id,role,status) VALUES (?,?,?,?,'active')", [membershipId, CAECOMP_ORGANIZATION_ID, person.id, role]);
      members.set(user.id, membershipId);
    }
    await tx.run("UPDATE memberships m JOIN people p ON p.id=m.person_id SET m.status='suspended' WHERE m.organization_id=? AND p.honji_subject NOT LIKE 'caehub-debug-%' AND p.honji_subject NOT IN (" + (snapshot.roster.map(() => '?').join(',') || "''") + ')', [CAECOMP_ORGANIZATION_ID, ...snapshot.roster.map(u => u.id)]);
    const existingRelations = await tx.many<RowDataPacket>(`SELECT dm.id,dm.department_id AS departmentId,dm.membership_id AS membershipId,dm.kind FROM department_memberships dm JOIN departments d ON d.id=dm.department_id JOIN memberships m ON m.id=dm.membership_id JOIN people p ON p.id=m.person_id WHERE d.organization_id=? AND dm.ended_at IS NULL AND p.honji_subject NOT LIKE 'caehub-debug-%'`, [CAECOMP_ORGANIZATION_ID]);
    const desired = new Map<string,string>();
    for(const d of snapshot.departments)for(const subject of new Set([...d.memberIds,...(d.directorId?[d.directorId]:[])])){const memberId=members.get(subject);if(memberId)desired.set(`${d.id}:${memberId}`,subject===d.directorId?'director':'member');}
    for(const relation of existingRelations)if(desired.get(`${relation.departmentId}:${relation.membershipId}`)!==relation.kind)await tx.run('UPDATE department_memberships SET ended_at=NOW() WHERE id=?',[relation.id]);
    await tx.run(`DELETE wp FROM workspace_participants wp JOIN workspaces w ON w.id=wp.workspace_id JOIN memberships m ON m.id=wp.membership_id JOIN people p ON p.id=m.person_id WHERE w.organization_id=? AND w.department_id IS NOT NULL AND p.honji_subject NOT LIKE 'caehub-debug-%'`,[CAECOMP_ORGANIZATION_ID]);
    for (const department of snapshot.departments) {
      await tx.run('INSERT INTO departments(id,organization_id,name) VALUES (?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name)', [department.id, CAECOMP_ORGANIZATION_ID, department.name]);
      for (const subject of new Set([...department.memberIds, ...(department.directorId ? [department.directorId] : [])])) {
        const memberId = members.get(subject); if (!memberId) continue;
        const kind=subject===department.directorId?'director':'member';
        if(!existingRelations.some(r=>r.departmentId===department.id&&r.membershipId===memberId&&r.kind===kind))await tx.run('INSERT INTO department_memberships(id,department_id,membership_id,kind) VALUES (?,?,?,?)', [randomUUID(), department.id, memberId, kind]);
      }
      const workspace = await tx.one<RowDataPacket>('SELECT id FROM workspaces WHERE department_id=? AND organization_id=?', [department.id, CAECOMP_ORGANIZATION_ID]);
      if (!workspace && members.size) {
        const workspaceId=randomUUID(),creatorId=members.values().next().value;
        await tx.run('INSERT INTO workspaces(id,organization_id,department_id,creator_membership_id,name,description) VALUES (?,?,?,?,?,?)', [workspaceId, CAECOMP_ORGANIZATION_ID, department.id, creatorId, department.name, `Espaço do departamento ${department.name}.`]);
        const boardId=randomUUID();await tx.run('INSERT INTO boards(id,workspace_id,name,created_by_membership_id) VALUES (?,?,?,?)',[boardId,workspaceId,'Quadro do departamento',creatorId]);
        for(const [position,name]of ['Ideias','Planejado','Em andamento','Aguardando','Concluído'].entries())await tx.run('INSERT INTO board_columns(id,board_id,name,position,is_completion) VALUES (?,?,?,?,?)',[randomUUID(),boardId,name,position,position===4?1:0]);
      }
    }
    await tx.run('INSERT INTO honji_hierarchy_projection(organization_id,revision,snapshot_hash) VALUES (?,?,?) ON DUPLICATE KEY UPDATE revision=VALUES(revision),snapshot_hash=VALUES(snapshot_hash)', [CAECOMP_ORGANIZATION_ID, snapshot.revision,snapshotHash]);
  });
}
