import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { CAECOMP_ORGANIZATION_ID, type Database } from './database.js';
import type { Actor } from './domain.js';
import { Conflict, Forbidden, InstitutionalService, NotFound } from './service.js';
import { occurrenceApplies } from './timetable-service.js';

type AvailabilityInput = { kind: 'weekly' | 'date'; weekday?: number; date?: string; startTime: string; endTime: string; note?: string };
type MeetingInput = { title: string; description?: string; location?: string; workspaceId?: string; startsAt: string; endsAt: string; participantIds: string[] };
type MeetingUpdateInput = Partial<MeetingInput> & { expectedRevision:number };
type CalendarScope = 'personal' | 'general' | 'workspace';
const sqlDate = (value: string) => new Date(value).toISOString().slice(0, 23).replace('T', ' ');
const timePart = (value: unknown) => String(value).slice(0, 5);
const dayKey = (value: Date) => value.toISOString().slice(0, 10);
const wallInstant = (date:string, time:string, offsetMinutes=0) => new Date(Date.parse(`${date}T${time}:00.000Z`) + offsetMinutes * 60_000);

export class AgendaService {
  constructor(readonly db: Database, readonly institutional: InstitutionalService) {}

  private async mayOrganize(actor: Actor, membership: RowDataPacket, workspaceId?: string): Promise<boolean> {
    if (await this.institutional.isAdmin(actor, membership as never)) return true;
    if (membership.role !== 'director') return false;
    if (!workspaceId) return true;
    const workspace = await this.db.one<RowDataPacket>('SELECT department_id AS departmentId FROM workspaces WHERE id=? AND organization_id=? AND status=\'active\'', [workspaceId, CAECOMP_ORGANIZATION_ID]);
    return Boolean(workspace && workspace.departmentId && await this.institutional.managesDepartment(membership.id, workspace.departmentId));
  }

  private async mayReadWorkspace(actor: Actor, membership: RowDataPacket, workspaceId: string): Promise<boolean> {
    if (await this.institutional.isAdmin(actor, membership as never)) return true;
    const row = await this.db.one<RowDataPacket>(`SELECT w.id FROM workspaces w WHERE w.id=? AND w.organization_id=? AND w.status='active' AND (EXISTS(SELECT 1 FROM workspace_participants wp WHERE wp.workspace_id=w.id AND wp.membership_id=?) OR EXISTS(SELECT 1 FROM department_memberships dm WHERE dm.department_id=w.department_id AND dm.membership_id=? AND dm.kind='director' AND dm.ended_at IS NULL))`, [workspaceId, CAECOMP_ORGANIZATION_ID, membership.id, membership.id]);
    return Boolean(row);
  }

  async myAvailability(actor: Actor) {
    const member = await this.institutional.requireMember(actor);
    return this.db.many<RowDataPacket>(`SELECT b.id,b.kind,b.weekday,DATE_FORMAT(b.specific_date,'%Y-%m-%d') AS date,TIME_FORMAT(b.start_time,'%H:%i') AS startTime,TIME_FORMAT(b.end_time,'%H:%i') AS endTime,b.note,t.term,DATE_FORMAT(t.valid_from,'%Y-%m-%d') AS validFrom,DATE_FORMAT(t.valid_to,'%Y-%m-%d') AS validTo,(SELECT JSON_ARRAYAGG(DATE_FORMAT(e.specific_date,'%Y-%m-%d')) FROM availability_occurrence_exceptions e WHERE e.block_id=b.id) AS excludedDates FROM availability_blocks b LEFT JOIN academic_timetable_imports t ON t.id=b.timetable_import_id WHERE b.membership_id=? ORDER BY b.kind,b.weekday,b.specific_date,b.start_time`, [member.id]);
  }

  async createAvailability(actor: Actor, input: AvailabilityInput) {
    const member = await this.institutional.requireMember(actor);
    if (input.startTime >= input.endTime) throw new Conflict('end time must be after start time');
    const id = randomUUID();
    await this.db.run('INSERT INTO availability_blocks (id,membership_id,kind,weekday,specific_date,start_time,end_time,note) VALUES (?,?,?,?,?,?,?,?)', [id, member.id, input.kind, input.kind === 'weekly' ? input.weekday : null, input.kind === 'date' ? input.date : null, input.startTime, input.endTime, input.note ?? null]);
    await this.institutional.audit(actor, 'availability.created', 'availability_block', id);
    return { id };
  }

  async updateAvailability(actor: Actor, id: string, input: AvailabilityInput) {
    const member = await this.institutional.requireMember(actor);
    const block = await this.db.one<RowDataPacket>('SELECT id,membership_id AS membershipId FROM availability_blocks WHERE id=?', [id]);
    if (!block) throw new NotFound('availability block');
    if (block.membershipId !== member.id) throw new Forbidden('only the owner may edit availability');
    if (input.startTime >= input.endTime) throw new Conflict('end time must be after start time');
    await this.db.run('UPDATE availability_blocks SET kind=?,weekday=?,specific_date=?,start_time=?,end_time=?,note=? WHERE id=?', [input.kind, input.kind === 'weekly' ? input.weekday : null, input.kind === 'date' ? input.date : null, input.startTime, input.endTime, input.note ?? null, id]);
    await this.institutional.audit(actor, 'availability.updated', 'availability_block', id);
    return { id };
  }

  async deleteAvailability(actor: Actor, id: string) {
    const member = await this.institutional.requireMember(actor);
    const block = await this.db.one<RowDataPacket>('SELECT id,membership_id AS membershipId FROM availability_blocks WHERE id=?', [id]);
    if (!block) throw new NotFound('availability block');
    if (block.membershipId !== member.id) throw new Forbidden('only the owner may edit availability');
    await this.db.run('DELETE FROM availability_blocks WHERE id=?', [id]);
    await this.institutional.audit(actor, 'availability.deleted', 'availability_block', id);
  }

  async calendar(actor: Actor, query: { from: string; to: string; scope: CalendarScope; workspaceId?: string; offsetMinutes?:number }) {
    const member = await this.institutional.requireMember(actor);
    if (query.scope === 'workspace' && (!query.workspaceId || !await this.mayReadWorkspace(actor, member, query.workspaceId))) throw new Forbidden('workspace calendar access required');
    const values: unknown[] = [CAECOMP_ORGANIZATION_ID, sqlDate(query.to), sqlDate(query.from)];
    let visibility = '';
    if (query.scope === 'personal') { visibility = 'AND (m.organizer_membership_id=? OR EXISTS(SELECT 1 FROM meeting_participants own WHERE own.meeting_id=m.id AND own.membership_id=? AND own.removed_at IS NULL))'; values.push(member.id, member.id); }
    if (query.scope === 'workspace') { visibility = 'AND m.workspace_id=?'; values.push(query.workspaceId); }
    if (query.scope === 'general' && !await this.institutional.isAdmin(actor, member)) { visibility = `AND (m.workspace_id IS NULL OR m.organizer_membership_id=? OR EXISTS(SELECT 1 FROM meeting_participants own WHERE own.meeting_id=m.id AND own.membership_id=? AND own.removed_at IS NULL) OR EXISTS(SELECT 1 FROM workspace_participants wp WHERE wp.workspace_id=m.workspace_id AND wp.membership_id=?) OR EXISTS(SELECT 1 FROM workspaces wx JOIN department_memberships dm ON dm.department_id=wx.department_id WHERE wx.id=m.workspace_id AND dm.membership_id=? AND dm.kind='director' AND dm.ended_at IS NULL))`; values.push(member.id, member.id, member.id, member.id); }
    const meetings = await this.db.many<RowDataPacket>(`SELECT m.id,m.title,m.description,m.location,m.workspace_id AS workspaceId,w.name AS workspace,m.starts_at AS startsAt,m.ends_at AS endsAt,m.revision,p.display_name AS organizer,(m.organizer_membership_id=?) AS canManage,(SELECT JSON_ARRAYAGG(mp2.membership_id) FROM meeting_participants mp2 WHERE mp2.meeting_id=m.id AND mp2.removed_at IS NULL) AS participantIds,COALESCE(mp.response,IF(m.organizer_membership_id=?,'confirmed',NULL)) AS response FROM meetings m JOIN memberships om ON om.id=m.organizer_membership_id JOIN people p ON p.id=om.person_id LEFT JOIN workspaces w ON w.id=m.workspace_id LEFT JOIN meeting_participants mp ON mp.meeting_id=m.id AND mp.membership_id=? AND mp.removed_at IS NULL WHERE m.organization_id=? AND m.cancelled_at IS NULL AND m.starts_at<? AND m.ends_at>? ${visibility} ORDER BY m.starts_at`, [member.id, member.id, member.id, ...values]);
    const items: object[] = meetings.map((row) => { const canManage=Boolean(row.canManage || actor.owner); return { ...row, canManage, participantIds:canManage?(Array.isArray(row.participantIds)?row.participantIds:JSON.parse(row.participantIds??'[]')):undefined, type: 'meeting' }; });
    if (query.scope === 'personal') {
      const blocks = await this.myAvailability(actor);
      const from = new Date(query.from), to = new Date(query.to);
      for (const block of blocks) {
        for (let cursor = new Date(from); cursor < to; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
          const matches = occurrenceApplies(block as never, dayKey(cursor), cursor.getUTCDay());
          if (!matches) continue;
          const date = dayKey(cursor);
          items.push({ id: block.id, type: 'unavailable', title: block.note || 'Indisponível', startsAt: wallInstant(date,timePart(block.startTime),query.offsetMinutes).toISOString(), endsAt: wallInstant(date,timePart(block.endTime),query.offsetMinutes).toISOString(), recurring: block.kind === 'weekly' });
        }
      }
    }
    return items.sort((a: any, b: any) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }

  async collective(actor: Actor, query: { from: string; to: string; membershipIds?: string[]; departmentId?: string; offsetMinutes?:number }) {
    const manager = await this.institutional.requireMember(actor);
    if (!await this.institutional.isAdmin(actor, manager) && manager.role !== 'director') throw new Forbidden('director or institutional administrator required');
    const values: unknown[] = [CAECOMP_ORGANIZATION_ID]; let where = '';
    if (query.membershipIds?.length) { where += ` AND m.id IN (${query.membershipIds.map(() => '?').join(',')})`; values.push(...query.membershipIds); }
    if (query.departmentId) { where += ' AND EXISTS(SELECT 1 FROM department_memberships dm WHERE dm.membership_id=m.id AND dm.department_id=? AND dm.ended_at IS NULL)'; values.push(query.departmentId); }
    const members = await this.db.many<RowDataPacket>(`SELECT m.id AS membershipId,p.display_name AS displayName FROM memberships m JOIN people p ON p.id=m.person_id WHERE m.organization_id=? AND m.status='active' ${where} ORDER BY p.display_name`, values);
    const from = new Date(query.from), to = new Date(query.to);
    const blocks = members.length ? await this.db.many<RowDataPacket>(`SELECT b.membership_id AS membershipId,b.kind,b.weekday,DATE_FORMAT(b.specific_date,'%Y-%m-%d') AS date,TIME_FORMAT(b.start_time,'%H:%i') AS startTime,TIME_FORMAT(b.end_time,'%H:%i') AS endTime,DATE_FORMAT(t.valid_from,'%Y-%m-%d') AS validFrom,DATE_FORMAT(t.valid_to,'%Y-%m-%d') AS validTo,(SELECT JSON_ARRAYAGG(DATE_FORMAT(e.specific_date,'%Y-%m-%d')) FROM availability_occurrence_exceptions e WHERE e.block_id=b.id) AS excludedDates FROM availability_blocks b LEFT JOIN academic_timetable_imports t ON t.id=b.timetable_import_id WHERE b.membership_id IN (${members.map(() => '?').join(',')})`, members.map((m) => m.membershipId)) : [];
    const meetings = members.length ? await this.db.many<RowDataPacket>(`SELECT mp.membership_id AS membershipId,m.starts_at AS startsAt,m.ends_at AS endsAt FROM meeting_participants mp JOIN meetings m ON m.id=mp.meeting_id WHERE mp.membership_id IN (${members.map(() => '?').join(',')}) AND mp.removed_at IS NULL AND mp.response<>'declined' AND m.cancelled_at IS NULL AND m.starts_at<? AND m.ends_at>? UNION ALL SELECT m.organizer_membership_id AS membershipId,m.starts_at AS startsAt,m.ends_at AS endsAt FROM meetings m WHERE m.organizer_membership_id IN (${members.map(() => '?').join(',')}) AND m.cancelled_at IS NULL AND m.starts_at<? AND m.ends_at>?`, [...members.map((m) => m.membershipId), sqlDate(query.to), sqlDate(query.from), ...members.map((m) => m.membershipId), sqlDate(query.to), sqlDate(query.from)]) : [];
    return members.map((person) => {
      const own = blocks.filter((b) => b.membershipId === person.membershipId);
      const busy = meetings.some((m) => m.membershipId === person.membershipId && new Date(m.startsAt) < to && new Date(m.endsAt) > from) || own.some((block) => {
        for (let cursor = new Date(from); cursor < to; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
          const matches = occurrenceApplies(block as never, dayKey(cursor), cursor.getUTCDay());
          if (!matches) continue;
          const start = wallInstant(dayKey(cursor),timePart(block.startTime),query.offsetMinutes), end = wallInstant(dayKey(cursor),timePart(block.endTime),query.offsetMinutes);
          if (start < to && end > from) return true;
        }
        return false;
      });
      const firstDay = dayKey(new Date(from.getTime() - (query.offsetMinutes ?? 0) * 60_000));
      const lastDay = dayKey(new Date(to.getTime() - 1 - (query.offsetMinutes ?? 0) * 60_000));
      return { membershipId: person.membershipId, displayName: person.displayName, status: busy ? 'busy' : own.some((block)=>block.kind==='weekly' && (!block.validFrom || block.validFrom <= firstDay) && (!block.validTo || block.validTo >= lastDay)) ? 'free' : 'unknown' };
    });
  }

  async options(actor:Actor) {
    const member=await this.institutional.requireMember(actor);
    if(!await this.institutional.isAdmin(actor,member)&&member.role!=='director') throw new Forbidden('director or institutional administrator required');
    return this.db.many<RowDataPacket>(`SELECT m.id,m.role,p.display_name AS displayName,COALESCE((SELECT JSON_ARRAYAGG(dm.department_id) FROM department_memberships dm WHERE dm.membership_id=m.id AND dm.ended_at IS NULL),JSON_ARRAY()) AS departmentIds FROM memberships m JOIN people p ON p.id=m.person_id WHERE m.organization_id=? AND m.status='active' ORDER BY p.display_name`,[CAECOMP_ORGANIZATION_ID]);
  }

  async createMeeting(actor: Actor, input: MeetingInput) {
    const organizer = await this.institutional.requireMember(actor);
    if (!await this.mayOrganize(actor, organizer, input.workspaceId)) throw new Forbidden('director or institutional administrator required');
    if (new Date(input.startsAt) >= new Date(input.endsAt)) throw new Conflict('end time must be after start time');
    const participants = [...new Set(input.participantIds)].filter((value) => value !== organizer.id);
    if (participants.length) {
      const valid = await this.db.many<RowDataPacket>(`SELECT id FROM memberships WHERE organization_id=? AND status='active' AND id IN (${participants.map(() => '?').join(',')})`, [CAECOMP_ORGANIZATION_ID, ...participants]);
      if (valid.length !== participants.length) throw new Conflict('all participants must be active institutional members');
    }
    const meetingId = randomUUID();
    await this.db.transaction(async (tx) => {
      await tx.run('INSERT INTO meetings (id,organization_id,workspace_id,organizer_membership_id,title,description,location,starts_at,ends_at) VALUES (?,?,?,?,?,?,?,?,?)', [meetingId, CAECOMP_ORGANIZATION_ID, input.workspaceId ?? null, organizer.id, input.title, input.description ?? null, input.location ?? null, sqlDate(input.startsAt), sqlDate(input.endsAt)]);
      for (const membershipId of participants) { await tx.run('INSERT INTO meeting_participants (meeting_id,membership_id) VALUES (?,?)', [meetingId, membershipId]); await tx.run('INSERT INTO agenda_notifications (id,membership_id,meeting_id,kind) VALUES (?,?,?,\'invited\')', [randomUUID(), membershipId, meetingId]); }
    });
    await this.institutional.audit(actor, 'meeting.created', 'meeting', meetingId, { participantCount: participants.length });
    return { id: meetingId };
  }

  private async meetingFor(actor: Actor, id: string) {
    const member = await this.institutional.requireMember(actor);
    const meeting = await this.db.one<RowDataPacket>('SELECT * FROM meetings WHERE id=? AND organization_id=? AND cancelled_at IS NULL', [id, CAECOMP_ORGANIZATION_ID]);
    if (!meeting) throw new NotFound('meeting');
    return { member, meeting };
  }

  async updateMeeting(actor: Actor, id: string, input: MeetingUpdateInput) {
    const member=await this.institutional.requireMember(actor);
    if(input.workspaceId&&!await this.mayOrganize(actor,member,input.workspaceId)) throw new Forbidden('workspace meeting administration required');
    const outcome=await this.db.transaction(async (tx) => {
      const meeting=await tx.one<RowDataPacket>('SELECT * FROM meetings WHERE id=? AND organization_id=? AND cancelled_at IS NULL FOR UPDATE',[id,CAECOMP_ORGANIZATION_ID]);
      if(!meeting) throw new NotFound('meeting');
      if(meeting.organizer_membership_id!==member.id&&!await this.institutional.isAdmin(actor,member)) throw new Forbidden('meeting organizer required');
      if(Number(meeting.revision)!==input.expectedRevision) throw new Conflict('meeting was updated; reload before saving');
      const startsAt = input.startsAt ?? new Date(meeting.starts_at).toISOString(), endsAt = input.endsAt ?? new Date(meeting.ends_at).toISOString();
      if (new Date(startsAt) >= new Date(endsAt)) throw new Conflict('end time must be after start time');
      const rescheduled = Boolean(input.startsAt || input.endsAt) && (sqlDate(startsAt) !== sqlDate(new Date(meeting.starts_at).toISOString()) || sqlDate(endsAt) !== sqlDate(new Date(meeting.ends_at).toISOString()));
      await tx.run(`UPDATE meetings SET title=COALESCE(?,title),description=COALESCE(?,description),location=COALESCE(?,location),workspace_id=COALESCE(?,workspace_id),starts_at=?,ends_at=?,revision=revision+1 WHERE id=?`, [input.title ?? null, input.description ?? null, input.location ?? null, input.workspaceId ?? null, sqlDate(startsAt), sqlDate(endsAt), id]);
      if (rescheduled) { await tx.run("UPDATE meeting_participants SET response='pending',response_revision=response_revision+1,responded_at=NULL WHERE meeting_id=? AND removed_at IS NULL", [id]); const participants = await tx.many<RowDataPacket>('SELECT membership_id AS membershipId FROM meeting_participants WHERE meeting_id=? AND removed_at IS NULL', [id]); for (const p of participants) await tx.run("INSERT INTO agenda_notifications (id,membership_id,meeting_id,kind) VALUES (?,?,?,'rescheduled')", [randomUUID(), p.membershipId, id]); }
      if (input.participantIds) {
        const desired = [...new Set(input.participantIds)].filter((value) => value !== meeting.organizer_membership_id);
        if (desired.length) { const valid=await tx.many<RowDataPacket>(`SELECT id FROM memberships WHERE organization_id=? AND status='active' AND id IN (${desired.map(()=>'?').join(',')})`,[CAECOMP_ORGANIZATION_ID,...desired]); if(valid.length!==desired.length) throw new Conflict('all participants must be active institutional members'); }
        const current = await tx.many<RowDataPacket>('SELECT membership_id AS membershipId FROM meeting_participants WHERE meeting_id=? AND removed_at IS NULL', [id]);
        for (const existing of current.filter((p) => !desired.includes(p.membershipId))) { await tx.run('UPDATE meeting_participants SET removed_at=NOW(3) WHERE meeting_id=? AND membership_id=? AND removed_at IS NULL', [id, existing.membershipId]); await tx.run("INSERT INTO agenda_notifications (id,membership_id,meeting_id,kind) VALUES (?,?,?,'removed')", [randomUUID(), existing.membershipId, id]); }
        for (const membershipId of desired.filter((value) => !current.some((p) => p.membershipId === value))) { await tx.run("INSERT INTO meeting_participants (meeting_id,membership_id) VALUES (?,?)", [id, membershipId]); await tx.run("INSERT INTO agenda_notifications (id,membership_id,meeting_id,kind) VALUES (?,?,?,'invited')", [randomUUID(), membershipId, id]); }
      }
      return {rescheduled,revision:Number(meeting.revision)+1};
    });
    await this.institutional.audit(actor, 'meeting.updated', 'meeting', id, { rescheduled:outcome.rescheduled });
    return { id, ...outcome };
  }

  async respond(actor: Actor, id: string, response: 'confirmed' | 'maybe' | 'declined') {
    const { member } = await this.meetingFor(actor, id);
    const invite = await this.db.one<RowDataPacket>('SELECT meeting_id FROM meeting_participants WHERE meeting_id=? AND membership_id=? AND removed_at IS NULL', [id, member.id]);
    if (!invite) throw new Forbidden('active meeting invitation required');
    await this.db.run('UPDATE meeting_participants SET response=?,responded_at=NOW(3) WHERE meeting_id=? AND membership_id=? AND removed_at IS NULL', [response, id, member.id]);
    await this.institutional.audit(actor, 'meeting.responded', 'meeting', id, { response });
    return { id, response };
  }

  async notifications(actor: Actor) {
    const member = await this.institutional.requireMember(actor);
    return this.db.many<RowDataPacket>(`SELECT n.id,n.kind,n.created_at AS createdAt,n.read_at AS readAt,m.id AS meetingId,m.title FROM agenda_notifications n JOIN meetings m ON m.id=n.meeting_id WHERE n.membership_id=? ORDER BY n.created_at DESC LIMIT 50`, [member.id]);
  }
}
