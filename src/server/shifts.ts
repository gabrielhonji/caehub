import { createHash, randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { CAECOMP_ORGANIZATION_ID, type Database } from './database.js';
import type { Actor } from './domain.js';
import { Conflict, Forbidden, NotFound, type InstitutionalService } from './service.js';
import type { AgendaService } from './agenda.js';
import { activeParticipants, agendaHistory, blockOverlaps, notify, sqlInstant } from './agenda-common.js';

export class ScheduleConflict extends Conflict {}
export type ShiftInput={title:string;description?:string;location?:string;workspaceId:string;relatedMeetingId?:string|null;startsAt:string;endsAt:string;minimumCapacity?:number|null;maximumCapacity:number;priorityWindowHours?:number};
const occupied=(status:string)=>status==='pending'||status==='confirmed';
export class Shifts {
  constructor(readonly db:Database,readonly institutional:InstitutionalService,readonly agenda:AgendaService) {}
  private validate(input:ShiftInput) {
    if(Date.parse(input.startsAt)>=Date.parse(input.endsAt))throw new Conflict('O fim deve ser posterior ao início.');
    if(input.minimumCapacity!=null&&input.minimumCapacity>input.maximumCapacity)throw new Conflict('Equipe mínima não pode superar a capacidade máxima.');
  }
  private async related(db:Database,input:ShiftInput) {
    if(input.relatedMeetingId&&!await db.one('SELECT id FROM meetings WHERE id=? AND organization_id=? AND workspace_id=? AND cancelled_at IS NULL',[input.relatedMeetingId,CAECOMP_ORGANIZATION_ID,input.workspaceId]))throw new Conflict('O evento relacionado deve ser uma reunião ativa do mesmo espaço.');
  }
  async create(actor:Actor,input:ShiftInput) {
    const member=await this.institutional.requireMember(actor);
    if(!await this.agenda.mayOrganize(actor,member,input.workspaceId))throw new Forbidden('Direção do espaço necessária.');
    this.validate(input);const id=randomUUID();
    await this.db.transaction(tx=>this.insert(tx,member.id,id,input));return {id};
  }
  private async insert(tx:Database,memberId:string,id:string,input:ShiftInput){
    await this.related(tx,input);
    await tx.run('INSERT INTO agenda_shifts (id,organization_id,workspace_id,organizer_membership_id,related_meeting_id,title,description,location,starts_at,ends_at,minimum_capacity,maximum_capacity,priority_window_hours) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,CAECOMP_ORGANIZATION_ID,input.workspaceId,memberId,input.relatedMeetingId??null,input.title,input.description??null,input.location??null,sqlInstant(input.startsAt),sqlInstant(input.endsAt),input.minimumCapacity??null,input.maximumCapacity,input.priorityWindowHours??2]);
    await agendaHistory(tx,memberId,'shift',id,'created');
  }
  async createMany(actor:Actor,requestKey:string,inputs:ShiftInput[]){
    const member=await this.institutional.requireMember(actor);
    for(const input of inputs){if(!await this.agenda.mayOrganize(actor,member,input.workspaceId))throw new Forbidden('Direção do espaço necessária.');this.validate(input);}
    const hash=createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
    return this.db.transaction(async tx=>{
      await tx.run('INSERT IGNORE INTO agenda_shift_batches(request_key,organizer_id,payload_hash,shift_ids) VALUES(?,?,?,JSON_ARRAY())',[requestKey,member.id,hash]);
      const previous=await tx.one<RowDataPacket>('SELECT * FROM agenda_shift_batches WHERE request_key=? FOR UPDATE',[requestKey]);
      if(previous!.organizer_id!==member.id||previous!.payload_hash!==hash)throw new Conflict('Esta solicitação já foi usada para outra escala.');
      const existing=typeof previous!.shift_ids==='string'?JSON.parse(previous!.shift_ids):previous!.shift_ids;if(existing.length)return {ids:existing};
      const ids:string[]=[];for(const input of inputs){const id=randomUUID();await this.insert(tx,member.id,id,input);ids.push(id);}
      await tx.run('UPDATE agenda_shift_batches SET shift_ids=? WHERE request_key=?',[JSON.stringify(ids),requestKey]);return {ids};
    });
  }
  private async access(actor:Actor,member:RowDataPacket,shift:RowDataPacket,manage=false) {
    const allowed=manage?await this.agenda.mayOrganize(actor,member,shift.workspace_id):await this.agenda.mayReadWorkspace(actor,member,shift.workspace_id)||Boolean(await this.db.one('SELECT membership_id FROM agenda_shift_participants WHERE shift_id=? AND membership_id=?',[shift.id,member.id]));
    if(!allowed)throw new Forbidden(manage?'Direção do espaço necessária.':'Acesso ao turno necessário.');
  }
  async list(actor:Actor) {
    const member=await this.institutional.requireMember(actor),admin=await this.institutional.canViewAll(actor,member);
    const rows=await this.db.many<RowDataPacket>(`SELECT s.*,w.name AS workspace FROM agenda_shifts s JOIN workspaces w ON w.id=s.workspace_id WHERE s.organization_id=? AND (? OR EXISTS(SELECT 1 FROM workspace_participants wp WHERE wp.workspace_id=s.workspace_id AND wp.membership_id=?) OR EXISTS(SELECT 1 FROM department_memberships dm WHERE dm.department_id=w.department_id AND dm.membership_id=? AND dm.ended_at IS NULL) OR EXISTS(SELECT 1 FROM agenda_shift_participants sp WHERE sp.shift_id=s.id AND sp.membership_id=?)) ORDER BY s.starts_at DESC LIMIT 100`,[CAECOMP_ORGANIZATION_ID,admin,member.id,member.id,member.id]);
    const result=[];
    for(const row of rows) {
      const participants=await this.db.many<RowDataPacket>(`SELECT sp.membership_id AS membershipId,sp.status,p.display_name AS displayName FROM agenda_shift_participants sp JOIN memberships m ON m.id=sp.membership_id JOIN people p ON p.id=m.person_id WHERE sp.shift_id=?`,[row.id]);
      const canManage=await this.agenda.mayOrganize(actor,member,row.workspace_id);
      const confirmed=participants.filter(p=>p.status==='confirmed').length,reserved=participants.filter(p=>p.status==='pending').length;
      result.push({id:row.id,title:row.title,description:row.description,location:row.location,workspaceId:row.workspace_id,workspace:row.workspace,relatedMeetingId:row.related_meeting_id,startsAt:row.starts_at,endsAt:row.ends_at,minimumCapacity:row.minimum_capacity,maximumCapacity:row.maximum_capacity,priorityWindowHours:row.priority_window_hours,revision:row.revision,cancelledAt:row.cancelled_at,canManage,canVolunteer:await this.agenda.mayReadWorkspace(actor,member,row.workspace_id,true),confirmed,reserved,remaining:Number(row.maximum_capacity)-confirmed-reserved,minimumReached:row.minimum_capacity==null||confirmed>=row.minimum_capacity,ownStatus:participants.find(p=>p.membershipId===member.id)?.status,participants:participants.filter(p=>canManage||occupied(p.status)||p.membershipId===member.id)});
    }return result;
  }
  async relatedMeetings(actor:Actor,workspaceId:string) {
    const member=await this.institutional.requireMember(actor);
    if(!await this.agenda.mayOrganize(actor,member,workspaceId))throw new Forbidden('Direção do espaço necessária.');
    return this.db.many<RowDataPacket>('SELECT id,title,starts_at AS startsAt FROM meetings WHERE organization_id=? AND workspace_id=? AND cancelled_at IS NULL ORDER BY starts_at DESC LIMIT 100',[CAECOMP_ORGANIZATION_ID,workspaceId]);
  }
  private async conflicts(db:Database,membershipId:string,shift:RowDataPacket,offset:number) {
    const from=new Date(shift.starts_at),to=new Date(shift.ends_at);
    const blocks=await db.many<RowDataPacket>(`SELECT b.kind,b.weekday,DATE_FORMAT(b.specific_date,'%Y-%m-%d') AS date,TIME_FORMAT(b.start_time,'%H:%i') AS startTime,TIME_FORMAT(b.end_time,'%H:%i') AS endTime,DATE_FORMAT(t.valid_from,'%Y-%m-%d') AS validFrom,DATE_FORMAT(t.valid_to,'%Y-%m-%d') AS validTo,(SELECT JSON_ARRAYAGG(DATE_FORMAT(e.specific_date,'%Y-%m-%d')) FROM availability_occurrence_exceptions e WHERE e.block_id=b.id) AS excludedDates FROM availability_blocks b LEFT JOIN academic_timetable_imports t ON t.id=b.timetable_import_id WHERE b.membership_id=?`,[membershipId]);
    if(blocks.some(block=>blockOverlaps(block,from,to,offset)))return true;
    if(await db.one(`SELECT m.id FROM meetings m WHERE m.organization_id=? AND m.cancelled_at IS NULL AND m.starts_at<? AND m.ends_at>? AND (m.organizer_membership_id=? OR EXISTS(SELECT 1 FROM meeting_participants mp WHERE mp.meeting_id=m.id AND mp.membership_id=? AND mp.removed_at IS NULL AND mp.response<>'declined')) LIMIT 1`,[CAECOMP_ORGANIZATION_ID,to,from,membershipId,membershipId]))return true;
    return Boolean(await db.one(`SELECT s.id FROM agenda_shifts s JOIN agenda_shift_participants sp ON sp.shift_id=s.id WHERE sp.membership_id=? AND sp.status IN ('pending','confirmed') AND s.cancelled_at IS NULL AND s.id<>? AND s.starts_at<? AND s.ends_at>? LIMIT 1`,[membershipId,shift.id,to,from]));
  }
  async participate(actor:Actor,id:string,input:{action:'volunteer'|'assign'|'accept'|'decline'|'withdraw'|'remove';membershipId?:string;confirmConflict?:boolean;offsetMinutes?:number}) {
    const member=await this.institutional.requireMember(actor),management=input.action==='assign'||input.action==='remove';
    const target=management?input.membershipId:member.id;
    if(!target)throw new Conflict('Selecione a pessoa.');
    await this.db.transaction(async tx=>{
      // Membership lock serializes concurrent reservations for the same person across shifts.
      if(input.action!=='remove')await activeParticipants(tx,[target]);
      const targetMember=await tx.one('SELECT id FROM memberships WHERE id=? AND organization_id=? FOR UPDATE',[target,CAECOMP_ORGANIZATION_ID]);
      if(!targetMember)throw new Conflict('Vínculo institucional inexistente.');
      const shift=await tx.one<RowDataPacket>('SELECT * FROM agenda_shifts WHERE id=? AND organization_id=? FOR UPDATE',[id,CAECOMP_ORGANIZATION_ID]);
      if(!shift)throw new NotFound('shift');
      await this.access(actor,member,shift,management);
      if(shift.cancelled_at)throw new Conflict('Turno cancelado.');
      if(input.action==='volunteer'&&!await this.agenda.mayReadWorkspace(actor,member,shift.workspace_id,true))throw new Forbidden('Inscrição exige acesso ao espaço.');
      const previous=await tx.one<RowDataPacket>('SELECT status FROM agenda_shift_participants WHERE shift_id=? AND membership_id=?',[id,target]);
      let status:string;
      if(input.action==='volunteer'||input.action==='assign') {
        if(previous&&occupied(previous.status))throw new Conflict('A pessoa já ocupa ou reserva uma vaga.');
        const count=await tx.one<RowDataPacket>(`SELECT COUNT(*) AS count FROM agenda_shift_participants WHERE shift_id=? AND status IN ('pending','confirmed')`,[id]);
        if(Number(count?.count)>=Number(shift.maximum_capacity))throw new Conflict('Não há vagas disponíveis.');
        status=input.action==='assign'?'pending':'confirmed';
      } else {
        if(!previous||!occupied(previous.status))throw new Conflict('Não há participação ativa.');
        if((input.action==='accept'||input.action==='decline')&&previous.status!=='pending')throw new Conflict('A reserva já foi respondida.');
        if(input.action==='withdraw'&&previous.status!=='confirmed')throw new Conflict('Somente participação confirmada permite desistência.');
        status=input.action==='accept'?'confirmed':input.action==='decline'?'declined':input.action==='withdraw'?'withdrawn':'removed';
      }
      let conflict=false;
      if(occupied(status)) {
        conflict=await this.conflicts(tx,target,shift,input.offsetMinutes??180);
        if(conflict&&!input.confirmConflict)throw new ScheduleConflict('Existe sobreposição de horários. Confirme conscientemente para prosseguir.');
      }
      await tx.run('INSERT INTO agenda_shift_participants (shift_id,membership_id,status,responded_at) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),responded_at=VALUES(responded_at)',[id,target,status,status==='pending'?null:new Date()]);
      const kind=input.action==='assign'?'shift_assigned':input.action==='remove'?'shift_removed':status==='confirmed'?'shift_accepted':status==='declined'?'shift_declined':'shift_withdrawn';
      const priority=status==='withdrawn'&&new Date(shift.starts_at).getTime()-Date.now()<=Number(shift.priority_window_hours)*3600000?'high':'normal';
      await notify(tx,management?[target]:[shift.organizer_membership_id],kind,'shift',id,shift.title,priority);
      await agendaHistory(tx,member.id,'shift',id,input.action,{membershipId:target,previousStatus:previous?.status??null,status,conflict,conflictConfirmed:conflict&&Boolean(input.confirmConflict),priority});
    },'READ COMMITTED');return {id};
  }
  async update(actor:Actor,id:string,input:ShiftInput&{expectedRevision:number}) {
    const member=await this.institutional.requireMember(actor);this.validate(input);
    await this.db.transaction(async tx=>{
      const shift=await tx.one<RowDataPacket>('SELECT * FROM agenda_shifts WHERE id=? AND organization_id=? FOR UPDATE',[id,CAECOMP_ORGANIZATION_ID]);
      if(!shift)throw new NotFound('shift');await this.access(actor,member,shift,true);
      if(!await this.agenda.mayOrganize(actor,member,input.workspaceId))throw new Forbidden('Direção do espaço necessária.');
      if(shift.cancelled_at||Number(shift.revision)!==input.expectedRevision)throw new Conflict('Turno atualizado ou cancelado. Recarregue antes de salvar.');
      await this.related(tx,input);
      const participants=await tx.many<RowDataPacket>(`SELECT membership_id AS membershipId,status FROM agenda_shift_participants WHERE shift_id=? AND status IN ('pending','confirmed')`,[id]);
      if(input.maximumCapacity<participants.length)throw new Conflict('Capacidade não pode ser menor que as vagas ocupadas e reservadas.');
      const rescheduled=sqlInstant(input.startsAt)!==sqlInstant(new Date(shift.starts_at).toISOString())||sqlInstant(input.endsAt)!==sqlInstant(new Date(shift.ends_at).toISOString());
      await tx.run('UPDATE agenda_shifts SET title=?,description=?,location=?,workspace_id=?,related_meeting_id=?,starts_at=?,ends_at=?,minimum_capacity=?,maximum_capacity=?,priority_window_hours=?,revision=revision+1 WHERE id=?',[input.title,input.description??null,input.location??null,input.workspaceId,input.relatedMeetingId??null,sqlInstant(input.startsAt),sqlInstant(input.endsAt),input.minimumCapacity??null,input.maximumCapacity,input.priorityWindowHours??Number(shift.priority_window_hours),id]);
      if(rescheduled) {
        await tx.run("UPDATE agenda_shift_participants SET status='pending',responded_at=NULL WHERE shift_id=? AND status IN ('pending','confirmed')",[id]);
        await notify(tx,participants.map(p=>p.membershipId),'shift_rescheduled','shift',id,input.title);
      }
      await agendaHistory(tx,member.id,'shift',id,'updated',{rescheduled,previous:{startsAt:shift.starts_at,endsAt:shift.ends_at,minimumCapacity:shift.minimum_capacity,maximumCapacity:shift.maximum_capacity,priorityWindowHours:shift.priority_window_hours,participants},next:input});
    });return {id};
  }
  async cancel(actor:Actor,id:string) {
    const member=await this.institutional.requireMember(actor);
    await this.db.transaction(async tx=>{
      const shift=await tx.one<RowDataPacket>('SELECT * FROM agenda_shifts WHERE id=? AND organization_id=? FOR UPDATE',[id,CAECOMP_ORGANIZATION_ID]);
      if(!shift)throw new NotFound('shift');await this.access(actor,member,shift,true);
      if(shift.cancelled_at)return;
      const participants=await tx.many<RowDataPacket>(`SELECT membership_id AS membershipId,status FROM agenda_shift_participants WHERE shift_id=? AND status IN ('pending','confirmed')`,[id]);
      await tx.run('UPDATE agenda_shifts SET cancelled_at=NOW(3),revision=revision+1 WHERE id=?',[id]);
      await tx.run("UPDATE agenda_shift_participants SET status='cancelled',responded_at=NOW(3) WHERE shift_id=? AND status IN ('pending','confirmed')",[id]);
      await notify(tx,participants.map(p=>p.membershipId),'shift_cancelled','shift',id,shift.title);
      await agendaHistory(tx,member.id,'shift',id,'cancelled',{participants});
    });return {id};
  }
  async history(actor:Actor,id:string) {
    const member=await this.institutional.requireMember(actor),shift=await this.db.one<RowDataPacket>('SELECT * FROM agenda_shifts WHERE id=? AND organization_id=?',[id,CAECOMP_ORGANIZATION_ID]);
    if(!shift)throw new NotFound('shift');await this.access(actor,member,shift,true);
    return this.db.many<RowDataPacket>(`SELECT h.id,h.action,h.data,h.created_at AS createdAt,p.display_name AS actor FROM agenda_history h JOIN memberships m ON m.id=h.actor_membership_id JOIN people p ON p.id=m.person_id WHERE h.resource_type='shift' AND h.resource_id=? ORDER BY h.created_at,h.id`,[id]);
  }
}
