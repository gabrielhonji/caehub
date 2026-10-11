import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { CAECOMP_ORGANIZATION_ID, type Database } from './database.js';
import type { Actor } from './domain.js';
import { Conflict, Forbidden, NotFound, type InstitutionalService } from './service.js';
import type { AgendaService } from './agenda.js';
import { activeParticipants, agendaHistory, notify, sqlInstant } from './agenda-common.js';

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
      for(const participant of participants) await tx.run('INSERT INTO availability_request_participants (request_id,membership_id) VALUES (?,?)',[requestId,participant]);
      await notify(tx,participants,'availability_requested','availability_request',requestId,input.title);
      await agendaHistory(tx,member.id,'availability_request',requestId,'created',{participantIds:participants});
    });
    return {id:requestId};
  }
  async list(actor:Actor) {
    const member=await this.institutional.requireMember(actor), admin=await this.institutional.isAdmin(actor,member);
    const requests=await this.db.many<RowDataPacket>(`SELECT r.id,r.title,r.workspace_id AS workspaceId,r.starts_at AS startsAt,r.ends_at AS endsAt,r.deadline,(r.organizer_membership_id=?) AS isOrganizer,p.display_name AS organizer FROM availability_requests r JOIN memberships om ON om.id=r.organizer_membership_id JOIN people p ON p.id=om.person_id WHERE r.organization_id=? AND (? OR r.organizer_membership_id=? OR EXISTS(SELECT 1 FROM availability_request_participants rp WHERE rp.request_id=r.id AND rp.membership_id=?)) ORDER BY r.created_at DESC LIMIT 50`,[member.id,CAECOMP_ORGANIZATION_ID,admin,member.id,member.id]);
    for(const request of requests) {
      request.canManage=Boolean(request.isOrganizer||admin);delete request.isOrganizer;
      request.participants=await this.db.many<RowDataPacket>(`SELECT rp.membership_id AS membershipId,p.display_name AS displayName,rp.reviewed_at AS reviewedAt,rp.review_kind AS reviewKind FROM availability_request_participants rp JOIN memberships m ON m.id=rp.membership_id JOIN people p ON p.id=m.person_id WHERE rp.request_id=? ${request.canManage?'':'AND rp.membership_id=?'}`,request.canManage?[request.id]:[request.id,member.id]);
      request.pendingCount=request.participants.filter((p:RowDataPacket)=>!p.reviewedAt).length;
    }
    return requests;
  }
  async review(actor:Actor,id:string,kind:'unchanged'|'updated') {
    const member=await this.institutional.requireMember(actor);
    await this.db.transaction(async tx=>{
      const request=await tx.one<RowDataPacket>('SELECT * FROM availability_requests WHERE id=? AND organization_id=? FOR UPDATE',[id,CAECOMP_ORGANIZATION_ID]);
      if(!request) throw new NotFound('availability request');
      const invitation=await tx.one<RowDataPacket>('SELECT membership_id FROM availability_request_participants WHERE request_id=? AND membership_id=?',[id,member.id]);
      if(!invitation) throw new Forbidden('A solicitação não foi dirigida a você.');
      await tx.run('UPDATE availability_request_participants SET reviewed_at=NOW(3),review_kind=? WHERE request_id=? AND membership_id=?',[kind,id,member.id]);
      await notify(tx,[request.organizer_membership_id],'availability_reviewed','availability_request',id,request.title);
      await agendaHistory(tx,member.id,'availability_request',id,'reviewed',{kind});
    });
    return {id};
  }
}
