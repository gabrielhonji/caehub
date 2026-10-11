import type { RowDataPacket } from 'mysql2';
import type { Database } from './database.js';

export async function migrateTimetables(db: Database) {
  await db.run(`CREATE TABLE IF NOT EXISTS academic_timetable_imports (
    id char(36) PRIMARY KEY, membership_id char(36) NOT NULL, term varchar(80) NOT NULL,
    valid_from date NOT NULL, valid_to date NOT NULL,
    updated_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY timetable_member_term (membership_id,term),
    FOREIGN KEY (membership_id) REFERENCES memberships(id), CHECK (valid_from<=valid_to))`);
  const column = await db.one<RowDataPacket>(`SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='availability_blocks' AND column_name='timetable_import_id'`);
  if (!column) await db.run(`ALTER TABLE availability_blocks ADD COLUMN timetable_import_id char(36) NULL,
    ADD CONSTRAINT fk_availability_timetable FOREIGN KEY (timetable_import_id) REFERENCES academic_timetable_imports(id)`);
  await db.run(`CREATE TABLE IF NOT EXISTS availability_occurrence_exceptions (
    block_id char(36) NOT NULL, specific_date date NOT NULL, PRIMARY KEY (block_id,specific_date),
    FOREIGN KEY (block_id) REFERENCES availability_blocks(id) ON DELETE CASCADE)`);
}
