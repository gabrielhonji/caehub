import { createHash,randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { CAECOMP_ORGANIZATION_ID, type Database } from './database.js';
import type { Actor } from './domain.js';
import { Conflict, Forbidden, NotFound, type InstitutionalService } from './service.js';
import type { AgendaService } from './agenda.js';
import { activeParticipants, agendaHistory, notify, sqlInstant } from './agenda-common.js';

async function availabilityFingerprint(db:Database,id:string){const rows=await db.many<RowDataPacket>(`SELECT b.id,b.kind,b.weekday,DATE_FORMAT(b.specific_date,'%Y-%m-%d') AS date,TIME_FORMAT(b.start_time,'%H:%i') AS startTime,TIME_FORMAT(b.end_time,'%H:%i') AS endTime,b.note,t.term,DATE_FORMAT(t.valid_from,'%Y-%m-%d') AS validFrom,DATE_FORMAT(t.valid_to,'%Y-%m-%d') AS validTo FROM availability_blocks b LEFT JOIN academic_timetable_imports t ON t.id=b.timetable_import_id WHERE b.membership_id=? ORDER BY b.id`,[id]);const exceptions=await db.many<RowDataPacket>(`SELECT e.block_id,DATE_FORMAT(e.specific_date,'%Y-%m-%d') AS date FROM availability_occurrence_exceptions e JOIN availability_blocks b ON b.id=e.block_id WHERE b.membership_id=? ORDER BY e.block_id,e.specific_date`,[id]);return createHash('sha256').update(JSON.stringify({rows,exceptions})).digest('hex');}

export class AvailabilityRequests {
  constructor(readonly db: Database, readonly institutional: InstitutionalService, readonly agenda: AgendaService) {}
  async create(actor: Actor, input: { title:string; workspaceId?:string; from:string; to:string; deadline?:string; participantIds:string[] }) {
    const member = await this.institutional.requireMember(actor);
    if (!await this.agenda.mayOrganize(actor, member, input.workspaceId)) throw new Forbidden('Organização exige direção ou administração autorizada.');
    if (new Date(input.from)>=new Date(input.to) || Date.parse(input.to)-Date.parse(input.from)>7*86400000) throw new Conflict('Selecione um intervalo de até uma semana.');
    const requestId=randomUUID();
    await this.db.transaction(async tx=>{
      const participants=await activeParticipants(tx,input.participantIds);
      await tx.run('INSERT INTO availability_requests (id,organization_id,organizer_membership_id,workspace_id,title,starts_at,ends_at,deadline) VALUES (?,?,?,?,?,?,?,?)',[requestId,CAECOMP_ORGANIZATION_ID,member.id,input.workspaceId??null,input.title,sqlInstant(input.from),sqlInstant(input.to),input.deadline?sqlInstant(input.deadline):null]);
      for(const participant of participants) await tx.run('INSERT INTO availability_request_participants (request_id,membership_id,availability_fingerprint) VALUES (?,?,?)',[requestId,participant,await availabilityFingerprint(tx,participant)]);
      await notify(tx,participants,'availability_requested','availability_request',requestId,input.title);
      await agendaHistory(tx,member.id,'availability_request',requestId,'created',{participantIds:participants});
    });
    return {id:requestId};
  }
  async list(actor:Actor) {
    const member=await this.institutional.requireMember(actor), admin=await this.institutional.canViewAll(actor,member);
    const requests=await this.db.many<RowDataPacket>(`SELECT r.id,r.title,r.workspace_id AS workspaceId,r.starts_at AS startsAt,r.ends_at AS endsAt,r.deadline,(r.organizer_membership_id=?) AS isOrganizer,p.display_name AS organizer FROM availability_requests r JOIN memberships om ON om.id=r.organizer_membership_id JOIN people p ON p.id=om.person_id WHERE r.organization_id=? AND (? OR r.organizer_membership_id=? OR EXISTS(SELECT 1 FROM availability_request_participants rp WHERE rp.request_id=r.id AND rp.membership_id=?)) ORDER BY r.created_at DESC LIMIT 50`,[member.id,CAECOMP_ORGANIZATION_ID,admin,member.id,member.id]);
    const currentFingerprint=requests.length?await availabilityFingerprint(this.db,member.id):undefined;
    for(const request of requests) {
      request.canManage=Boolean((request.isOrganizer||await this.institutional.isAdmin(actor,member))&&await this.agenda.mayOrganize(actor,member,request.workspaceId??undefined));delete request.isOrganizer;
      request.participants=await this.db.many<RowDataPacket>(`SELECT rp.membership_id AS membershipId,p.display_name AS displayName,rp.reviewed_at AS reviewedAt,rp.review_kind AS reviewKind,rp.availability_fingerprint AS fingerprint,EXISTS(SELECT 1 FROM institutional_audit_events a JOIN availability_requests original ON original.id=rp.request_id WHERE a.actor_subject=p.honji_subject AND a.action LIKE 'availability.%' AND a.created_at>original.created_at) AS legacyChanged FROM availability_request_participants rp JOIN memberships m ON m.id=rp.membership_id JOIN people p ON p.id=m.person_id WHERE rp.request_id=? ${request.canManage?'':'AND rp.membership_id=?'}`,request.canManage?[request.id]:[request.id,member.id]);
      for(const participant of request.participants){participant.changedSinceRequest=participant.membershipId===member.id&&Boolean(participant.fingerprint?participant.fingerprint!==currentFingerprint:participant.legacyChanged);delete participant.fingerprint;delete participant.legacyChanged;}
      for(const participant of request.participants)participant.canReviewAgain=participant.membershipId===member.id&&participant.reviewKind==='cancelled'&&(!request.deadline||new Date(request.deadline)>new Date());
      request.pendingCount=request.participants.filter((p:RowDataPacket)=>!p.reviewedAt).length;
    }
    return requests;
  }
  async review(actor:Actor,id:string,kind:'unchanged'|'updated'|'cancelled') {
    const member=await this.institutional.requireMember(actor);
    await this.db.transaction(async tx=>{
      const request=await tx.one<RowDataPacket>('SELECT * FROM availability_requests WHERE id=? AND organization_id=? FOR UPDATE',[id,CAECOMP_ORGANIZATION_ID]);
      if(!request) throw new NotFound('availability request');
      const invitation=await tx.one<RowDataPacket>('SELECT membership_id,availability_fingerprint AS fingerprint FROM availability_request_participants WHERE request_id=? AND membership_id=?',[id,member.id]);
      if(!invitation) throw new Forbidden('A solicitação não foi dirigida a você.');
      if(request.deadline&&new Date(request.deadline)<=new Date())throw new Conflict('O prazo desta revisão terminou.');
      if(kind==='cancelled'&&!await tx.one('SELECT membership_id FROM availability_request_participants WHERE request_id=? AND membership_id=? AND reviewed_at IS NOT NULL AND review_kind<>\'cancelled\'',[id,member.id]))throw new Conflict('Não há confirmação ativa para cancelar.');
      if(kind==='updated'&&invitation.fingerprint&&invitation.fingerprint===await availabilityFingerprint(tx,member.id))throw new Conflict('Revise seus horários antes de informar uma atualização.');
      await tx.run('UPDATE availability_request_participants SET reviewed_at=NOW(3),review_kind=? WHERE request_id=? AND membership_id=?',[kind,id,member.id]);
      await notify(tx,[request.organizer_membership_id],'availability_reviewed','availability_request',id,request.title);
      await agendaHistory(tx,member.id,'availability_request',id,'reviewed',{kind});
    });
    return {id};
  }
}
