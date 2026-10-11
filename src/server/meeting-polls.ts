import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { CAECOMP_ORGANIZATION_ID, type Database } from './database.js';
import type { Actor } from './domain.js';
import { Conflict, Forbidden, NotFound, type InstitutionalService } from './service.js';
import type { AgendaService } from './agenda.js';
import { activeParticipants, agendaHistory, notify, sqlInstant } from './agenda-common.js';

export type PollInput={title:string;description?:string;location?:string;workspaceId?:string;deadline?:string;participantIds:string[];options:{startsAt:string;endsAt:string}[]};
export class MeetingPolls {
  constructor(readonly db:Database,readonly institutional:InstitutionalService,readonly agenda:AgendaService) {}
  async create(actor:Actor,input:PollInput) {
    const member=await this.institutional.requireMember(actor);
    if(!await this.agenda.mayOrganize(actor,member,input.workspaceId))throw new Forbidden('Organização exige direção autorizada.');
    if(input.options.some(o=>Date.parse(o.startsAt)>=Date.parse(o.endsAt))||new Set(input.options.map(o=>`${sqlInstant(o.startsAt)}/${sqlInstant(o.endsAt)}`)).size!==input.options.length)throw new Conflict('Informe opções distintas com intervalos válidos.');
    const id=randomUUID();
    await this.db.transaction(async tx=>{
      const participants=await activeParticipants(tx,input.participantIds);
      await tx.run('INSERT INTO meeting_polls (id,organization_id,organizer_membership_id,workspace_id,title,description,location,deadline) VALUES (?,?,?,?,?,?,?,?)',[id,CAECOMP_ORGANIZATION_ID,member.id,input.workspaceId??null,input.title,input.description??null,input.location??null,input.deadline?sqlInstant(input.deadline):null]);
      for(const option of input.options)await tx.run('INSERT INTO meeting_poll_options (id,poll_id,starts_at,ends_at) VALUES (?,?,?,?)',[randomUUID(),id,sqlInstant(option.startsAt),sqlInstant(option.endsAt)]);
      for(const participant of participants)await tx.run('INSERT INTO meeting_poll_participants (poll_id,membership_id) VALUES (?,?)',[id,participant]);
      await notify(tx,participants,'poll_invited','poll',id,input.title);
      await agendaHistory(tx,member.id,'poll',id,'created');
    });return {id};
  }
  async list(actor:Actor) {
    const member=await this.institutional.requireMember(actor),admin=await this.institutional.isAdmin(actor,member);
    const polls=await this.db.many<RowDataPacket>(`SELECT p.id,p.title,p.description,p.location,p.workspace_id AS workspaceId,p.deadline,p.closed_at AS closedAt,p.resulting_meeting_id AS meetingId,p.organizer_membership_id AS organizerId FROM meeting_polls p WHERE p.organization_id=? AND (? OR p.organizer_membership_id=? OR EXISTS(SELECT 1 FROM meeting_poll_participants pp WHERE pp.poll_id=p.id AND pp.membership_id=?)) ORDER BY p.created_at DESC LIMIT 50`,[CAECOMP_ORGANIZATION_ID,admin,member.id,member.id]);
    for(const poll of polls) {
      poll.canManage=Boolean((admin||poll.organizerId===member.id)&&await this.agenda.mayOrganize(actor,member,poll.workspaceId??undefined));
      poll.options=await this.db.many<RowDataPacket>(`SELECT o.id,o.starts_at AS startsAt,o.ends_at AS endsAt,(SELECT COUNT(*) FROM meeting_poll_votes v WHERE v.option_id=o.id) AS votes,EXISTS(SELECT 1 FROM meeting_poll_votes v WHERE v.option_id=o.id AND v.membership_id=?) AS selected FROM meeting_poll_options o WHERE o.poll_id=? ORDER BY o.starts_at`,[member.id,poll.id]);
      const own=await this.db.one<RowDataPacket>('SELECT none_works AS noneWorks,voted_at AS votedAt FROM meeting_poll_participants WHERE poll_id=? AND membership_id=?',[poll.id,member.id]);
      poll.invited=Boolean(own);poll.noneWorks=Boolean(own?.noneWorks);poll.votedAt=own?.votedAt;
      poll.open=!poll.closedAt&&(!poll.deadline||new Date(poll.deadline)>new Date());
      if(poll.canManage)poll.participants=await this.db.many<RowDataPacket>(`SELECT pp.membership_id AS membershipId,p.display_name AS displayName,pp.none_works AS noneWorks,pp.voted_at AS votedAt FROM meeting_poll_participants pp JOIN memberships m ON m.id=pp.membership_id JOIN people p ON p.id=m.person_id WHERE pp.poll_id=?`,[poll.id]);
    }return polls;
  }
  async vote(actor:Actor,id:string,optionIds:string[],noneWorks:boolean) {
    const member=await this.institutional.requireMember(actor);
    if(new Set(optionIds).size!==optionIds.length||noneWorks===Boolean(optionIds.length))throw new Conflict('Selecione horários ou informe que nenhuma opção funciona.');
    await this.db.transaction(async tx=>{
      const poll=await tx.one<RowDataPacket>('SELECT * FROM meeting_polls WHERE id=? AND organization_id=? FOR UPDATE',[id,CAECOMP_ORGANIZATION_ID]);
      if(!poll)throw new NotFound('poll');
      if(poll.closed_at||(poll.deadline&&new Date(poll.deadline)<=new Date()))throw new Conflict('A votação está encerrada.');
      if(!await tx.one('SELECT membership_id FROM meeting_poll_participants WHERE poll_id=? AND membership_id=?',[id,member.id]))throw new Forbidden('Convite para votação necessário.');
      const options=await tx.many<RowDataPacket>('SELECT id FROM meeting_poll_options WHERE poll_id=?',[id]);
      if(optionIds.some(option=>!options.some(o=>o.id===option)))throw new Conflict('Opção não pertence à votação.');
      await tx.run('DELETE FROM meeting_poll_votes WHERE poll_id=? AND membership_id=?',[id,member.id]);
      for(const option of optionIds)await tx.run('INSERT INTO meeting_poll_votes (poll_id,membership_id,option_id) VALUES (?,?,?)',[id,member.id,option]);
      await tx.run('UPDATE meeting_poll_participants SET none_works=?,voted_at=NOW(3) WHERE poll_id=? AND membership_id=?',[noneWorks,id,member.id]);
      await agendaHistory(tx,member.id,'poll',id,'voted',{optionIds,noneWorks});
    });return {id};
  }
  async close(actor:Actor,id:string,confirmed:boolean,optionId?:string) {
    const member=await this.institutional.requireMember(actor);
    if(!confirmed)throw new Conflict('Confirme o encerramento e a convocação.');
    return this.db.transaction(async tx=>{
      const poll=await tx.one<RowDataPacket>('SELECT * FROM meeting_polls WHERE id=? AND organization_id=? FOR UPDATE',[id,CAECOMP_ORGANIZATION_ID]);
      if(!poll)throw new NotFound('poll');
      if((poll.organizer_membership_id!==member.id&&!await this.institutional.isAdmin(actor,member))||!await this.agenda.mayOrganize(actor,member,poll.workspace_id??undefined))throw new Forbidden('Organizador autorizado necessário.');
      if(poll.resulting_meeting_id)return {id,meetingId:poll.resulting_meeting_id};
      const options=await tx.many<RowDataPacket>(`SELECT o.*,(SELECT COUNT(*) FROM meeting_poll_votes v JOIN memberships m ON m.id=v.membership_id AND m.status='active' WHERE v.option_id=o.id) AS votes FROM meeting_poll_options o WHERE o.poll_id=?`,[id]);
      const maximum=Math.max(...options.map(o=>Number(o.votes)));
      if(!maximum)throw new Conflict('Não há votos válidos para convocar a reunião.');
      const leaders=options.filter(o=>Number(o.votes)===maximum);
      const winner=optionId?leaders.find(o=>o.id===optionId):leaders.length===1?leaders[0]:undefined;
      if(!winner)throw new Conflict('Escolha uma das opções empatadas com mais votos.');
      const participants=await tx.many<RowDataPacket>(`SELECT pp.membership_id AS id,EXISTS(SELECT 1 FROM meeting_poll_votes v WHERE v.poll_id=pp.poll_id AND v.membership_id=pp.membership_id AND v.option_id=?) AS winner FROM meeting_poll_participants pp JOIN memberships m ON m.id=pp.membership_id WHERE pp.poll_id=? AND m.status='active'`,[winner.id,id]);
      const meetingId=randomUUID();
      await tx.run('INSERT INTO meetings (id,organization_id,workspace_id,organizer_membership_id,title,description,location,starts_at,ends_at) VALUES (?,?,?,?,?,?,?,?,?)',[meetingId,CAECOMP_ORGANIZATION_ID,poll.workspace_id,poll.organizer_membership_id,poll.title,poll.description,poll.location,winner.starts_at,winner.ends_at]);
      for(const participant of participants)await tx.run(`INSERT INTO meeting_participants (meeting_id,membership_id,response,responded_at) VALUES (?,?,?,?)`,[meetingId,participant.id,participant.winner?'confirmed':'pending',participant.winner?new Date():null]);
      await tx.run('UPDATE meeting_polls SET closed_at=NOW(3),resulting_meeting_id=? WHERE id=?',[meetingId,id]);
      await notify(tx,participants.map(p=>p.id),'poll_closed','poll',id,poll.title);
      await notify(tx,participants.map(p=>p.id),'invited','meeting',meetingId,poll.title);
      await agendaHistory(tx,member.id,'poll',id,'closed',{optionId:winner.id,meetingId});
      return {id,meetingId};
    });
  }
}
