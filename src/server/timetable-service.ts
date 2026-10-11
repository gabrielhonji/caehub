import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import type { Database } from './database.js';
import type { Actor } from './domain.js';
import { Conflict, Forbidden, NotFound, type InstitutionalService } from './service.js';

export type ImportInput = { term: string; validFrom: string; validTo: string; confirmed: true; rows: { weekday: number; startTime: string; endTime: string }[] };
const key = (row: { weekday: number; startTime: string; endTime: string }) => `${row.weekday}/${row.startTime}/${row.endTime}`;

export class TimetableService {
  constructor(readonly db: Database, readonly institutional: InstitutionalService) {}

  async confirm(actor: Actor, input: ImportInput) {
    const member = await this.institutional.requireMember(actor);
    if (!input.confirmed || input.validFrom > input.validTo || input.rows.some(row => row.startTime >= row.endTime)) throw new Conflict('Confira o período e todos os intervalos antes de confirmar.');
    const desired = [...new Map(input.rows.map(row => [key(row), row])).values()];
    const result = await this.db.transaction(async tx => {
      // Serialize reimports for this owner, including concurrent first imports.
      await tx.one<RowDataPacket>('SELECT id FROM memberships WHERE id=? FOR UPDATE', [member.id]);
      const previous = await tx.one<RowDataPacket>('SELECT id FROM academic_timetable_imports WHERE membership_id=? AND term=?', [member.id, input.term]);
      const importId = previous?.id ?? randomUUID();
      if (previous) await tx.run('UPDATE academic_timetable_imports SET valid_from=?,valid_to=? WHERE id=?', [input.validFrom, input.validTo, importId]);
      else await tx.run('INSERT INTO academic_timetable_imports (id,membership_id,term,valid_from,valid_to) VALUES (?,?,?,?,?)', [importId, member.id, input.term, input.validFrom, input.validTo]);
      const existing = await tx.many<RowDataPacket>(`SELECT id,weekday,TIME_FORMAT(start_time,'%H:%i') AS startTime,TIME_FORMAT(end_time,'%H:%i') AS endTime FROM availability_blocks WHERE membership_id=? AND timetable_import_id=?`, [member.id, importId]);
      const kept = new Set<string>();
      for (const row of desired) {
        const same = existing.find(block => key(block as never) === key(row) && !kept.has(block.id));
        if (same) { kept.add(same.id); continue; }
        const blockId = randomUUID(); kept.add(blockId);
        await tx.run("INSERT INTO availability_blocks (id,membership_id,kind,weekday,start_time,end_time,timetable_import_id) VALUES (?,?,'weekly',?,?,?,?)", [blockId, member.id, row.weekday, row.startTime, row.endTime, importId]);
      }
      for (const block of existing) if (!kept.has(block.id)) await tx.run('DELETE FROM availability_blocks WHERE id=?', [block.id]);
      await tx.run('INSERT INTO institutional_audit_events (id,organization_id,actor_subject,action,resource_type,resource_id,metadata) SELECT ?,organization_id,?,\'timetable.confirmed\',\'timetable\',?,? FROM memberships WHERE id=?', [randomUUID(), actor.subject, importId, JSON.stringify({ blockCount: desired.length, replaced: Boolean(previous) }), member.id]);
      return { id: importId, blockCount: desired.length, replaced: Boolean(previous) };
    });
    return result;
  }

  async exception(actor: Actor, blockId: string, date: string, excluded: boolean) {
    const member = await this.institutional.requireMember(actor);
    await this.db.transaction(async tx => {
      const block = await tx.one<RowDataPacket>('SELECT membership_id AS membershipId,kind,weekday FROM availability_blocks WHERE id=? FOR UPDATE', [blockId]);
      if (!block) throw new NotFound('availability block');
      if (block.membershipId !== member.id) throw new Forbidden('only the owner may edit availability');
      if (block.kind !== 'weekly' || new Date(`${date}T12:00:00Z`).getUTCDay() !== Number(block.weekday)) throw new Conflict('Escolha uma data correspondente ao dia semanal do bloco.');
      if (excluded) await tx.run('INSERT IGNORE INTO availability_occurrence_exceptions (block_id,specific_date) VALUES (?,?)', [blockId, date]);
      else await tx.run('DELETE FROM availability_occurrence_exceptions WHERE block_id=? AND specific_date=?', [blockId, date]);
    });
    await this.institutional.audit(actor, 'availability.occurrence_changed', 'availability_block', blockId, { date, excluded });
    return { id: blockId, date, excluded };
  }
}

/** Shared projection guard for both private calendar and occupancy-only queries. */
export function occurrenceApplies(block: { kind: string; weekday?: number; date?: string; validFrom?: string; validTo?: string; excludedDates?: string[] | string }, date: string, weekday: number) {
  if (block.validFrom && date < block.validFrom || block.validTo && date > block.validTo) return false;
  const excluded: string[] = (typeof block.excludedDates === 'string' ? JSON.parse(block.excludedDates) : block.excludedDates) ?? [];
  if (excluded.includes(date)) return false;
  return block.kind === 'weekly' ? weekday === Number(block.weekday) : date === block.date;
}
