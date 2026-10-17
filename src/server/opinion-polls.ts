import {randomUUID} from 'node:crypto';
import type {RowDataPacket} from 'mysql2';
import type {Database} from './database.js';
import {CAECOMP_ORGANIZATION_ID} from './database.js';
import type {Actor} from './domain.js';
import type {AgendaService} from './agenda.js';
import type {InstitutionalService} from './service.js';
import {Conflict,Forbidden,NotFound} from './service.js';
import {activeParticipants,agendaHistory,notify,sqlInstant} from './agenda-common.js';

export async function migrateOpinionPolls(db:Database){
 await db.run(`CREATE TABLE IF NOT EXISTS opinion_polls(id char(36) PRIMARY KEY, organization_id char(36) NOT NULL, organizer_id char(36) NOT NULL, workspace_id char(36) NULL, title varchar(200) NOT NULL, description text NULL, deadline datetime(3) NULL, closed_at datetime(3) NULL, created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(organization_id) REFERENCES organizations(id), FOREIGN KEY(organizer_id) REFERENCES memberships(id), FOREIGN KEY(workspace_id) REFERENCES workspaces(id))`);
 await db.run(`CREATE TABLE IF NOT EXISTS opinion_poll_options(id char(36) PRIMARY KEY,poll_id char(36) NOT NULL,label varchar(300) NOT NULL,position int NOT NULL,UNIQUE(id,poll_id),FOREIGN KEY(poll_id) REFERENCES opinion_polls(id))`);
 await db.run(`CREATE TABLE IF NOT EXISTS opinion_poll_participants(poll_id char(36) NOT NULL,membership_id char(36) NOT NULL,PRIMARY KEY(poll_id,membership_id),FOREIGN KEY(poll_id) REFERENCES opinion_polls(id),FOREIGN KEY(membership_id) REFERENCES memberships(id))`);
 await db.run(`CREATE TABLE IF NOT EXISTS opinion_poll_votes(poll_id char(36) NOT NULL,membership_id char(36) NOT NULL,option_id char(36) NOT NULL,PRIMARY KEY(poll_id,membership_id),FOREIGN KEY(poll_id,membership_id) REFERENCES opinion_poll_participants(poll_id,membership_id),FOREIGN KEY(option_id,poll_id) REFERENCES opinion_poll_options(id,poll_id))`);
}
export type OpinionInput={title:string;description?:string;workspaceId?:string;deadline?:string;participantIds:string[];options:string[]};
export class OpinionPolls{
 constructor(readonly db:Database,readonly institutional:InstitutionalService,readonly agenda:AgendaService){}
 async create(actor:Actor,input:OpinionInput){
  const member=await this.institutional.requireMember(actor);
  if(!await this.agenda.mayOrganize(actor,member,input.workspaceId))throw new Forbidden('Direção ou administração autorizada necessária.');
  if(new Set(input.options.map(o=>o.toLocaleLowerCase('pt-BR'))).size!==input.options.length)throw new Conflict('Informe opções distintas.');
  if(input.deadline&&Date.parse(input.deadline)<=Date.now())throw new Conflict('O prazo precisa estar no futuro.');
  const id=randomUUID();await this.db.transaction(async tx=>{
   const ids=await activeParticipants(tx,input.participantIds);
   await tx.run('INSERT INTO opinion_polls(id,organization_id,organizer_id,workspace_id,title,description,deadline) VALUES(?,?,?,?,?,?,?)',[id,CAECOMP_ORGANIZATION_ID,member.id,input.workspaceId??null,input.title,input.description??null,input.deadline?sqlInstant(input.deadline):null]);
   for(const [position,label]of input.options.entries())await tx.run('INSERT INTO opinion_poll_options(id,poll_id,label,position) VALUES(?,?,?,?)',[randomUUID(),id,label,position]);
   for(const pid of ids)await tx.run('INSERT INTO opinion_poll_participants(poll_id,membership_id) VALUES(?,?)',[id,pid]);
   await notify(tx,ids,'opinion_invited','opinion',id,input.title);await agendaHistory(tx,member.id,'opinion',id,'created');
  });return {id};
 }
 async list(actor:Actor){
  const member=await this.institutional.requireMember(actor),broad=await this.institutional.canViewAll(actor,member);
  const rows=await this.db.many<RowDataPacket>(`SELECT p.id,p.title,p.description,p.workspace_id AS workspaceId,p.organizer_id AS organizerId,p.deadline,p.closed_at AS closedAt,EXISTS(SELECT 1 FROM opinion_poll_participants pp WHERE pp.poll_id=p.id AND pp.membership_id=?) AS invited FROM opinion_polls p WHERE p.organization_id=? AND (? OR p.organizer_id=? OR EXISTS(SELECT 1 FROM opinion_poll_participants pp WHERE pp.poll_id=p.id AND pp.membership_id=?)) ORDER BY p.created_at DESC LIMIT 100`,[member.id,CAECOMP_ORGANIZATION_ID,broad,member.id,member.id]);
  for(const row of rows){
   row.canManage=Boolean((row.organizerId===member.id||broad)&&await this.agenda.mayOrganize(actor,member,row.workspaceId??undefined));row.open=!row.closedAt&&(!row.deadline||new Date(row.deadline)>new Date());row.invited=Boolean(row.invited);
   row.options=await this.db.many<RowDataPacket>(`SELECT o.id,o.label,(SELECT COUNT(*) FROM opinion_poll_votes v JOIN memberships m ON m.id=v.membership_id AND m.status='active' WHERE v.option_id=o.id) AS votes,EXISTS(SELECT 1 FROM opinion_poll_votes v WHERE v.option_id=o.id AND v.membership_id=?) AS selected FROM opinion_poll_options o WHERE o.poll_id=? ORDER BY o.position`,[member.id,row.id]);
   const count=await this.db.one<RowDataPacket>(`SELECT COUNT(*) AS invited, SUM(EXISTS(SELECT 1 FROM opinion_poll_votes v WHERE v.poll_id=pp.poll_id AND v.membership_id=pp.membership_id)) AS responded FROM opinion_poll_participants pp JOIN memberships m ON m.id=pp.membership_id AND m.status='active' WHERE pp.poll_id=?`,[row.id]);row.participantCount=Number(count?.invited??0);row.responseCount=Number(count?.responded??0);
  }return rows;
 }
 async act(actor:Actor,id:string,optionId?:string){
  const member=await this.institutional.requireMember(actor);await this.db.transaction(async tx=>{
   const poll=await tx.one<RowDataPacket>('SELECT * FROM opinion_polls WHERE id=? AND organization_id=? FOR UPDATE',[id,CAECOMP_ORGANIZATION_ID]);if(!poll)throw new NotFound('opinion');
   if(!optionId){
    if((poll.organizer_id!==member.id&&!await this.institutional.isAdmin(actor,member))||!await this.agenda.mayOrganize(actor,member,poll.workspace_id??undefined))throw new Forbidden('Organizador autorizado necessário.');
    if(poll.closed_at)return;
    await tx.run('UPDATE opinion_polls SET closed_at=NOW(3) WHERE id=?',[id]);const people=await tx.many<RowDataPacket>('SELECT membership_id FROM opinion_poll_participants WHERE poll_id=?',[id]);await notify(tx,people.map(p=>p.membership_id),'opinion_closed','opinion',id,poll.title);await agendaHistory(tx,member.id,'opinion',id,'closed');return;
   }
   if(poll.closed_at||(poll.deadline&&new Date(poll.deadline)<=new Date()))throw new Conflict('A votação está encerrada.');
   if(!await tx.one('SELECT 1 FROM opinion_poll_participants WHERE poll_id=? AND membership_id=?',[id,member.id]))throw new Forbidden('Convite para votação necessário.');
   if(!await tx.one('SELECT id FROM opinion_poll_options WHERE id=? AND poll_id=?',[optionId,id]))throw new Conflict('Opção não pertence à votação.');
   await tx.run('INSERT INTO opinion_poll_votes(poll_id,membership_id,option_id) VALUES(?,?,?) ON DUPLICATE KEY UPDATE option_id=VALUES(option_id)',[id,member.id,optionId]);await agendaHistory(tx,member.id,'opinion',id,'voted');
  });return {id};
 }
}
