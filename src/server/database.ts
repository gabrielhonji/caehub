import {migrateProblemReports} from './problem-reports.js';
import {migrateOpinionPolls} from './opinion-polls.js';
import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import { migrateTimetables } from './timetable-migration.js';
import { migrateAdvancedAgenda } from './agenda-advanced-migration.js';
import { migrateCommercial } from './commercial-migration.js';
import { migrateCommercialCatalog } from './commercial-catalog-migration.js';
import { migrateOrders } from './orders-migration.js';

export type DbConfig = { host: string; port: number; user: string; password: string; database: string };
export const configFromEnv = (env: NodeJS.ProcessEnv): DbConfig => ({
  host: env.DB_HOST ?? 'mysql', port: Number(env.DB_PORT ?? 3306), user: env.DB_USER ?? 'root', password: env.DB_PASSWORD ?? 'caehub-dev-root', database: env.DB_NAME ?? 'gabriel_caehub',
});

export class Database {
  constructor(readonly pool: Pool) {}
  async one<T extends RowDataPacket>(sql: string, values: any[] = []): Promise<T | undefined> { const [rows] = await this.pool.query<T[]>(sql, values); return rows[0]; }
  async many<T extends RowDataPacket>(sql: string, values: any[] = []): Promise<T[]> { const [rows] = await this.pool.query<T[]>(sql, values); return rows; }
  async run(sql: string, values: any[] = []): Promise<void> { await this.pool.execute(sql, values); }
  async transaction<T>(work: (db: Database) => Promise<T>, isolation?: 'READ COMMITTED'): Promise<T> {
    const connection = await this.pool.getConnection();
    if(isolation) await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await connection.beginTransaction();
    try {
      const value = await work(new Database(connection as unknown as Pool));
      await connection.commit();
      return value;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  }
  async close(): Promise<void> { await this.pool.end(); }
}

export async function connect(config: DbConfig): Promise<Database> {
  const bootstrap = await mysql.createConnection({ host: config.host, port: config.port, user: config.user, password: config.password });
  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${config.database.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  await bootstrap.end();
  return new Database(mysql.createPool({ ...config, waitForConnections: true, connectionLimit: 8 }));
}

export async function migrate(db: Database): Promise<void> {
  // DDL commits implicitly: serialize migrations on one dedicated session,
  // scoped to this database, rather than relying on a transaction lock.
  const connection=await db.pool.getConnection();let acquired=false;
  const name="CONCAT('caehub:migrate:',LEFT(SHA2(DATABASE(),256),48))";
  try {
    const [rows]=await connection.query<RowDataPacket[]>(`SELECT GET_LOCK(${name},60) AS acquired`);
    acquired=Number(rows[0]?.acquired)===1;
    if(!acquired)throw new Error('Schema migration lock unavailable');
    await migrateSchema(new Database(connection as unknown as Pool));
  } finally {
    try { if(acquired)await connection.query(`SELECT RELEASE_LOCK(${name})`); }
    finally { connection.release(); }
  }
}

async function migrateSchema(db: Database): Promise<void> {
  await db.run('CREATE TABLE IF NOT EXISTS honji_hierarchy_projection (organization_id CHAR(36) PRIMARY KEY, revision BIGINT NOT NULL, snapshot_hash CHAR(64) NULL)');
  if(!await db.one<RowDataPacket>("SHOW COLUMNS FROM honji_hierarchy_projection LIKE 'snapshot_hash'"))await db.run('ALTER TABLE honji_hierarchy_projection ADD COLUMN snapshot_hash CHAR(64) NULL');
  await db.run(`CREATE TABLE IF NOT EXISTS caehub_sessions (session_hash char(64) primary key, subject varchar(255) null, display_name varchar(255) null, csrf_token varchar(64) not null, oauth_state_hash char(64) null, oauth_nonce_hash char(64) null, oauth_verifier varchar(128) null, created_at datetime(3) not null, last_activity_at datetime(3) not null, expires_at datetime(3) not null, index caehub_sessions_expiry(expires_at))`);
  const debugMode = await db.one<RowDataPacket>(`SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='caehub_sessions' AND column_name='debug_mode'`);
  if (!debugMode) await db.run("ALTER TABLE caehub_sessions ADD COLUMN debug_mode VARCHAR(48) NOT NULL DEFAULT 'real'");
  const returnTo = await db.one<RowDataPacket>("SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='caehub_sessions' AND column_name='return_to'");
  if (!returnTo) await db.run("ALTER TABLE caehub_sessions ADD COLUMN return_to VARCHAR(2048) NOT NULL DEFAULT '/'");
  const providerSession = await db.one<RowDataPacket>("SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='caehub_sessions' AND column_name='identity_session_id'");
  if (!providerSession) await db.run('ALTER TABLE caehub_sessions ADD COLUMN identity_session_id VARCHAR(255) NULL');
  const debugType=await db.one<RowDataPacket>("SHOW COLUMNS FROM caehub_sessions LIKE 'debug_mode'");if(String(debugType?.Type).startsWith('enum'))await db.run("ALTER TABLE caehub_sessions MODIFY COLUMN debug_mode VARCHAR(48) NOT NULL DEFAULT 'real'");
  await db.run(`CREATE TABLE IF NOT EXISTS organizations (id char(36) primary key, slug varchar(80) not null unique, name varchar(255) not null, created_at datetime not null default current_timestamp, updated_at datetime not null default current_timestamp on update current_timestamp)`);
  await db.run(`CREATE TABLE IF NOT EXISTS departments (id char(36) primary key, organization_id char(36) not null, name varchar(120) not null, created_at datetime not null default current_timestamp, unique key departments_organization_name (organization_id,name), constraint fk_department_org foreign key (organization_id) references organizations(id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS people (id char(36) primary key, honji_subject varchar(255) not null unique, display_name varchar(255) not null, created_at datetime not null default current_timestamp)`);
  await db.run(`CREATE TABLE IF NOT EXISTS memberships (id char(36) primary key, organization_id char(36) not null, person_id char(36) not null, role enum('president','vice_president','counselor','director','member') not null default 'member', status enum('active','suspended','ended') not null default 'active', started_at datetime not null default current_timestamp, ended_at datetime null, created_at datetime not null default current_timestamp, updated_at datetime not null default current_timestamp on update current_timestamp, unique key membership_per_person_org (organization_id,person_id), constraint fk_membership_org foreign key (organization_id) references organizations(id), constraint fk_membership_person foreign key (person_id) references people(id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS department_memberships (id char(36) primary key, department_id char(36) not null, membership_id char(36) not null, kind enum('director','member') not null default 'member', started_at datetime not null default current_timestamp, ended_at datetime null, active_membership_id char(36) GENERATED ALWAYS AS (IF(ended_at IS NULL,membership_id,NULL)) STORED, unique key active_department_member (department_id,active_membership_id), constraint fk_department_membership_department foreign key (department_id) references departments(id), constraint fk_department_membership_membership foreign key (membership_id) references memberships(id))`);
  const activeKey = await db.one<RowDataPacket>(`SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='department_memberships' AND column_name='active_membership_id'`);
  if (!activeKey) await db.run('ALTER TABLE department_memberships ADD COLUMN active_membership_id char(36) GENERATED ALWAYS AS (IF(ended_at IS NULL,membership_id,NULL)) STORED, ADD UNIQUE KEY active_department_member_v2 (department_id,active_membership_id)');
  await db.run(`CREATE TABLE IF NOT EXISTS workspaces (id char(36) primary key, organization_id char(36) not null, department_id char(36) null, creator_membership_id char(36) not null, name varchar(160) not null, description text null, status enum('active','archived') not null default 'active', created_at datetime not null default current_timestamp, updated_at datetime not null default current_timestamp on update current_timestamp, constraint fk_workspace_org foreign key (organization_id) references organizations(id), constraint fk_workspace_department foreign key (department_id) references departments(id), constraint fk_workspace_creator foreign key (creator_membership_id) references memberships(id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS workspace_participants (workspace_id char(36) not null, membership_id char(36) not null, added_by_membership_id char(36) not null, created_at datetime not null default current_timestamp, primary key (workspace_id,membership_id), constraint fk_workspace_participant_workspace foreign key (workspace_id) references workspaces(id), constraint fk_workspace_participant_membership foreign key (membership_id) references memberships(id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS institutional_audit_events (id char(36) primary key, organization_id char(36) not null, actor_subject varchar(255) not null, action varchar(100) not null, resource_type varchar(80) not null, resource_id char(36) not null, metadata json null, created_at datetime not null default current_timestamp, constraint fk_audit_org foreign key (organization_id) references organizations(id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS boards (id char(36) primary key, workspace_id char(36) not null, name varchar(160) not null, created_by_membership_id char(36) not null, created_at datetime not null default current_timestamp, updated_at datetime not null default current_timestamp on update current_timestamp, constraint fk_board_workspace foreign key (workspace_id) references workspaces(id), constraint fk_board_creator foreign key (created_by_membership_id) references memberships(id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS kanban_commands (
    membership_id char(36) NOT NULL, scope varchar(100) NOT NULL, request_key char(36) NOT NULL,
    request_hash char(64) NOT NULL, response json NULL, created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(membership_id,scope,request_key), FOREIGN KEY(membership_id) REFERENCES memberships(id)
  )`);
  await db.run(`CREATE TABLE IF NOT EXISTS board_columns (id char(36) primary key, board_id char(36) not null, name varchar(120) not null, position int unsigned not null, is_completion boolean not null default false, created_at datetime not null default current_timestamp, updated_at datetime not null default current_timestamp on update current_timestamp, unique key board_column_position (board_id,position), constraint fk_column_board foreign key (board_id) references boards(id))`);
  if(!await db.one("SHOW COLUMNS FROM board_columns LIKE 'color'"))await db.run("ALTER TABLE board_columns ADD COLUMN color char(7) NOT NULL DEFAULT '#64748B' AFTER name");
  await db.run(`CREATE TABLE IF NOT EXISTS cards (id char(36) primary key, board_id char(36) not null, column_id char(36) not null, creator_membership_id char(36) not null, responsible_membership_id char(36) null, title varchar(200) not null, description text null, priority enum('low','normal','high') not null default 'normal', due_at datetime null, visibility enum('members','directors') not null default 'members', tags json null, completed_at datetime null, archived_at datetime null, version int unsigned not null default 1, created_at datetime not null default current_timestamp, updated_at datetime not null default current_timestamp on update current_timestamp, constraint fk_card_board foreign key (board_id) references boards(id), constraint fk_card_column foreign key (column_id) references board_columns(id), constraint fk_card_creator foreign key (creator_membership_id) references memberships(id), constraint fk_card_responsible foreign key (responsible_membership_id) references memberships(id))`);
  if(!await db.one("SHOW COLUMNS FROM cards LIKE 'purged_at'"))await db.run('ALTER TABLE cards ADD COLUMN purged_at datetime NULL AFTER archived_at');
  await db.run(`CREATE TABLE IF NOT EXISTS card_participants (card_id char(36) not null, membership_id char(36) not null, joined_at datetime not null default current_timestamp, left_at datetime null, active_membership_id char(36) GENERATED ALWAYS AS (IF(left_at IS NULL,membership_id,NULL)) STORED, unique key active_card_helper (card_id,active_membership_id), constraint fk_participant_card foreign key (card_id) references cards(id), constraint fk_participant_membership foreign key (membership_id) references memberships(id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS responsibility_transfers (id char(36) primary key, card_id char(36) not null, from_membership_id char(36) null, to_membership_id char(36) not null, requested_by_membership_id char(36) not null, status enum('pending','accepted','declined','cancelled','obsolete') not null default 'pending', created_at datetime not null default current_timestamp, decided_at datetime null, pending_card_id char(36) GENERATED ALWAYS AS (IF(status='pending',card_id,NULL)) STORED, unique key one_pending_transfer (pending_card_id), constraint fk_transfer_card foreign key (card_id) references cards(id), constraint fk_transfer_from foreign key (from_membership_id) references memberships(id), constraint fk_transfer_to foreign key (to_membership_id) references memberships(id), constraint fk_transfer_requester foreign key (requested_by_membership_id) references memberships(id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS checklist_items (id char(36) primary key, card_id char(36) not null, content varchar(500) not null, position int unsigned not null, completed boolean not null default false, created_at datetime not null default current_timestamp, updated_at datetime not null default current_timestamp on update current_timestamp, constraint fk_checklist_card foreign key (card_id) references cards(id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS card_comments (id char(36) primary key, card_id char(36) not null, author_membership_id char(36) not null, body text not null, created_at datetime not null default current_timestamp, constraint fk_comment_card foreign key (card_id) references cards(id), constraint fk_comment_author foreign key (author_membership_id) references memberships(id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS card_activities (id char(36) primary key, card_id char(36) not null, actor_membership_id char(36) not null, action varchar(80) not null, data json null, created_at datetime not null default current_timestamp, constraint fk_activity_card foreign key (card_id) references cards(id), constraint fk_activity_actor foreign key (actor_membership_id) references memberships(id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS availability_blocks (id char(36) primary key, membership_id char(36) not null, kind enum('weekly','date') not null, weekday tinyint unsigned null, specific_date date null, start_time time not null, end_time time not null, note varchar(255) null, created_at datetime not null default current_timestamp, updated_at datetime not null default current_timestamp on update current_timestamp, index availability_member_kind (membership_id,kind), constraint fk_availability_membership foreign key (membership_id) references memberships(id), constraint availability_shape check ((kind='weekly' and weekday between 0 and 6 and specific_date is null) or (kind='date' and weekday is null and specific_date is not null)), constraint availability_interval check (start_time < end_time))`);
  await db.run(`CREATE TABLE IF NOT EXISTS meetings (id char(36) primary key, organization_id char(36) not null, workspace_id char(36) null, organizer_membership_id char(36) not null, title varchar(200) not null, description text null, location varchar(255) null, starts_at datetime(3) not null, ends_at datetime(3) not null, revision int unsigned not null default 1, cancelled_at datetime(3) null, created_at datetime(3) not null default current_timestamp(3), updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3), index meetings_range (organization_id,starts_at,ends_at), constraint fk_meeting_org foreign key (organization_id) references organizations(id), constraint fk_meeting_workspace foreign key (workspace_id) references workspaces(id), constraint fk_meeting_organizer foreign key (organizer_membership_id) references memberships(id), constraint meeting_interval check (starts_at < ends_at))`);
  await db.run(`CREATE TABLE IF NOT EXISTS meeting_participants (meeting_id char(36) not null, membership_id char(36) not null, response enum('pending','confirmed','maybe','declined') not null default 'pending', response_revision int unsigned not null default 1, responded_at datetime(3) null, invited_at datetime(3) not null default current_timestamp(3), removed_at datetime(3) null, active_membership_id char(36) GENERATED ALWAYS AS (IF(removed_at IS NULL,membership_id,NULL)) STORED, unique key active_meeting_participant (meeting_id,active_membership_id), index participant_calendar (membership_id,removed_at), constraint fk_meeting_participant_meeting foreign key (meeting_id) references meetings(id), constraint fk_meeting_participant_membership foreign key (membership_id) references memberships(id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS agenda_notifications (id char(36) primary key, membership_id char(36) not null, meeting_id char(36) not null, kind enum('invited','rescheduled','removed') not null, created_at datetime(3) not null default current_timestamp(3), read_at datetime(3) null, index agenda_notification_inbox (membership_id,read_at,created_at), constraint fk_agenda_notification_membership foreign key (membership_id) references memberships(id), constraint fk_agenda_notification_meeting foreign key (meeting_id) references meetings(id))`);
  await migrateTimetables(db);
  await migrateAdvancedAgenda(db);
  await migrateOpinionPolls(db);
  await migrateProblemReports(db);
  for(const [table,column,definition] of [
    ['availability_request_participants','availability_fingerprint','char(64) NULL'],
    ['meeting_participants','justification','varchar(1000) NULL'],
    ['meeting_poll_participants','suggestion_note','varchar(1000) NULL'],
    ['meeting_poll_participants','suggested_start','datetime(3) NULL'],
    ['meeting_poll_participants','suggested_end','datetime(3) NULL']
  ]){if(!await db.one('SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?',[table,column]))await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);}

  await migrateCommercial(db);
  if(!await db.one("SHOW COLUMNS FROM commercial_campaigns LIKE 'orders_url'"))await db.run('ALTER TABLE commercial_campaigns ADD COLUMN orders_url varchar(2048) NULL AFTER name,ADD COLUMN collection_url varchar(2048) NULL AFTER orders_url');
  await seed(db);
  await migrateCommercialCatalog(db);
  await migrateOrders(db);
  if(!await db.one("SHOW COLUMNS FROM commercial_order_items LIKE 'unit_cost_cents'"))await db.run('ALTER TABLE commercial_order_items ADD COLUMN unit_cost_cents int unsigned NULL');
  if(!await db.one("SHOW COLUMNS FROM commercial_order_items LIKE 'combo_id'"))await db.run('ALTER TABLE commercial_order_items ADD COLUMN combo_id char(36) NULL,ADD COLUMN combo_name varchar(200) NULL');
  await db.run(`CREATE TABLE IF NOT EXISTS commercial_dashboard_access (organization_id char(36) PRIMARY KEY, department_ids json NOT NULL, revision int unsigned NOT NULL DEFAULT 1, FOREIGN KEY(organization_id) REFERENCES organizations(id))`);
  await db.run('INSERT IGNORE INTO commercial_dashboard_access (organization_id,department_ids) VALUES (?,?)',[CAECOMP_ORGANIZATION_ID,JSON.stringify(['1a4e0bd0-5f4a-4d10-8000-000000000103','1a4e0bd0-5f4a-4d10-8000-000000000106'])]);
  await db.run(`CREATE TABLE IF NOT EXISTS commercial_financial_targets (campaign_id char(36) PRIMARY KEY,fixed_cost_cents int unsigned NULL,revenue_goal_cents int unsigned NULL,cost_budget_cents int unsigned NULL,profit_goal_cents int unsigned NULL,revision int unsigned NOT NULL DEFAULT 1,FOREIGN KEY(campaign_id) REFERENCES commercial_campaigns(id))`);

  await db.run(`INSERT INTO boards (id,workspace_id,name,created_by_membership_id) SELECT UUID(),w.id,'Quadro principal',w.creator_membership_id FROM workspaces w WHERE NOT EXISTS (SELECT 1 FROM boards b WHERE b.workspace_id=w.id)`);
  for (const [position, name, completion] of [['0','Ideias','0'],['1','Planejado','0'],['2','Em andamento','0'],['3','Aguardando','0'],['4','Concluído','1']] as const) await db.run(`INSERT INTO board_columns (id,board_id,name,position,is_completion) SELECT UUID(),b.id,?,?,? FROM boards b WHERE NOT EXISTS (SELECT 1 FROM board_columns c WHERE c.board_id=b.id AND c.position=?)`, [name, Number(position), Number(completion), Number(position)]);
}

const orgId = '1a4e0bd0-5f4a-4d10-8000-000000000001';
const departments = ['RH/RE', 'Marketing', 'Produtos', 'Eventos', 'Secretaria', 'Financeiro'];
async function seed(db: Database): Promise<void> {
  await db.run(`INSERT IGNORE INTO organizations (id,slug,name) VALUES (?, 'caecomp', 'CAECOMP — Centro Acadêmico de Engenharia de Computação da UTFPR Apucarana')`, [orgId]);
  for (const [index, name] of departments.entries()) {
    const id = `1a4e0bd0-5f4a-4d10-8000-0000000001${String(index + 1).padStart(2, '0')}`;
    await db.run('INSERT IGNORE INTO departments (id,organization_id,name) VALUES (?,?,?)', [id, orgId, name]);
  }
  const bootstrapPerson = '1a4e0bd0-5f4a-4d10-8000-000000000010';
  const bootstrapMembership = '1a4e0bd0-5f4a-4d10-8000-000000000011';
  await db.run(`INSERT IGNORE INTO people (id,honji_subject,display_name) VALUES (?, 'caehub-system-bootstrap', 'CAEHUB system bootstrap')`, [bootstrapPerson]);
  await db.run(`INSERT IGNORE INTO memberships (id,organization_id,person_id,role,status,ended_at) VALUES (?,?,?,'member','ended',NOW())`, [bootstrapMembership, orgId, bootstrapPerson]);
  const templates = [
    ['1a4e0bd0-5f4a-4d10-8000-000000000020', '1a4e0bd0-5f4a-4d10-8000-000000000021', 'caehub-debug-admin', 'Administração / Presidência', 'president'],
    ['1a4e0bd0-5f4a-4d10-8000-000000000022', '1a4e0bd0-5f4a-4d10-8000-000000000023', 'caehub-debug-events-director', 'Direção de Eventos', 'director'],
    ['1a4e0bd0-5f4a-4d10-8000-000000000024', '1a4e0bd0-5f4a-4d10-8000-000000000025', 'caehub-debug-member', 'Membro de Eventos', 'member'],
    ['1a4e0bd0-5f4a-4d10-8000-000000000030','1a4e0bd0-5f4a-4d10-8000-000000000031','caehub-debug-global-admin','Administrador global','member'],
    ['1a4e0bd0-5f4a-4d10-8000-000000000032','1a4e0bd0-5f4a-4d10-8000-000000000033','caehub-debug-products-member','Membro de Produtos','member'],
  ] as const;
  for (const [personId, membershipId, subject, name, role] of templates) {
    await db.run('INSERT IGNORE INTO people (id,honji_subject,display_name) VALUES (?,?,?)', [personId, subject, name]);
    await db.run("INSERT IGNORE INTO memberships (id,organization_id,person_id,role,status) VALUES (?,?,?,?,'active')", [membershipId, orgId, personId, role]);
  }
  await db.run(`INSERT IGNORE INTO department_memberships (id,department_id,membership_id,kind) VALUES
    ('1a4e0bd0-5f4a-4d10-8000-000000000026','1a4e0bd0-5f4a-4d10-8000-000000000104','1a4e0bd0-5f4a-4d10-8000-000000000023','director')`);
  await db.run(`INSERT IGNORE INTO department_memberships(id,department_id,membership_id,kind) VALUES
    ('1a4e0bd0-5f4a-4d10-8000-000000000034','1a4e0bd0-5f4a-4d10-8000-000000000104','1a4e0bd0-5f4a-4d10-8000-000000000025','member'),
    ('1a4e0bd0-5f4a-4d10-8000-000000000035','1a4e0bd0-5f4a-4d10-8000-000000000103','1a4e0bd0-5f4a-4d10-8000-000000000033','member')`);
  const spaces: Array<[string, string, number | null]> = [['1a4e0bd0-5f4a-4d10-8000-000000000201', 'Direção Geral', null], ...departments.map((name, index) => [`1a4e0bd0-5f4a-4d10-8000-0000000002${String(index + 2).padStart(2, '0')}`, name, index] as [string, string, number])];
  for (const [id, name, index] of spaces) {
    const departmentId = index === null ? null : `1a4e0bd0-5f4a-4d10-8000-0000000001${String(index + 1).padStart(2, '0')}`;
    await db.run('INSERT IGNORE INTO workspaces (id,organization_id,department_id,creator_membership_id,name,description) VALUES (?,?,?,?,?,?)', [id, orgId, departmentId, bootstrapMembership, name, index === null ? 'Espaço institucional da direção geral.' : `Espaço inicial do departamento ${name}.`]);
  }
}
export const CAECOMP_ORGANIZATION_ID = orgId;
