import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { CAECOMP_ORGANIZATION_ID, type Database } from './database.js';
import { Conflict } from './service.js';
import { occurrenceApplies } from './timetable-service.js';

export function blockOverlaps(block:RowDataPacket,from:Date,to:Date,offsetMinutes=0) {
  const cursor=new Date(from.getTime()-offsetMinutes*60000), last=new Date(to.getTime()-1-offsetMinutes*60000);
  cursor.setUTCHours(0,0,0,0);last.setUTCHours(0,0,0,0);
  for(;cursor<=last;cursor.setUTCDate(cursor.getUTCDate()+1)) {
    const date=cursor.toISOString().slice(0,10);
    if(!occurrenceApplies(block as never,date,cursor.getUTCDay())) continue;
    const start=new Date(Date.parse(`${date}T${String(block.startTime).slice(0,5)}:00Z`)+offsetMinutes*60000);
    const end=new Date(Date.parse(`${date}T${String(block.endTime).slice(0,5)}:00Z`)+offsetMinutes*60000);
    if(start<to&&end>from)return true;
  }
  return false;
}

export const sqlInstant = (value: string) => new Date(value).toISOString().slice(0,23).replace('T',' ');
export const placeholders = (values: unknown[]) => values.map(() => '?').join(',');
export async function activeParticipants(db: Database, ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) throw new Conflict('Selecione ao menos um participante.');
  const rows = await db.many<RowDataPacket>(`SELECT id FROM memberships WHERE organization_id=? AND status='active' AND id IN (${placeholders(unique)})`, [CAECOMP_ORGANIZATION_ID,...unique]);
  if (rows.length !== unique.length) throw new Conflict('Todos os participantes devem ter vínculo institucional ativo.');
  return unique;
}
export async function notify(db: Database, members: string[], kind: string, resourceType: string, resourceId: string, title: string, priority = 'normal') {
  for (const member of new Set(members)) await db.run('INSERT INTO agenda_notifications (id,membership_id,meeting_id,kind,resource_type,resource_id,title,priority) VALUES (?,?,?,?,?,?,?,?)', [randomUUID(),member,resourceType==='meeting'?resourceId:null,kind,resourceType,resourceId,title,priority]);
}
export async function agendaHistory(db: Database, actorId: string, resourceType: string, resourceId: string, action: string, data: object = {}) {
  await db.run('INSERT INTO agenda_history (id,actor_membership_id,resource_type,resource_id,action,data) VALUES (?,?,?,?,?,?)',[randomUUID(),actorId,resourceType,resourceId,action,JSON.stringify(data)]);
}
