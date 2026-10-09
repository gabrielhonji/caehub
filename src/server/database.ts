import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';

export type DbConfig = { host: string; port: number; user: string; password: string; database: string };
export const configFromEnv = (env: NodeJS.ProcessEnv): DbConfig => ({
  host: env.DB_HOST ?? 'mysql', port: Number(env.DB_PORT ?? 3306), user: env.DB_USER ?? 'root', password: env.DB_PASSWORD ?? 'caehub-dev-root', database: env.DB_NAME ?? 'gabriel_caehub',
});

export class Database {
  constructor(readonly pool: Pool) {}
  async one<T extends RowDataPacket>(sql: string, values: any[] = []): Promise<T | undefined> { const [rows] = await this.pool.query<T[]>(sql, values); return rows[0]; }
  async many<T extends RowDataPacket>(sql: string, values: any[] = []): Promise<T[]> { const [rows] = await this.pool.query<T[]>(sql, values); return rows; }
  async run(sql: string, values: any[] = []): Promise<void> { await this.pool.execute(sql, values); }
  async close(): Promise<void> { await this.pool.end(); }
}

export async function connect(config: DbConfig): Promise<Database> {
  const bootstrap = await mysql.createConnection({ host: config.host, port: config.port, user: config.user, password: config.password });
  await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${config.database.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  await bootstrap.end();
  return new Database(mysql.createPool({ ...config, waitForConnections: true, connectionLimit: 8 }));
}

export async function migrate(db: Database): Promise<void> {
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
  await seed(db);
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
  const spaces: Array<[string, string, number | null]> = [['1a4e0bd0-5f4a-4d10-8000-000000000201', 'Direção Geral', null], ...departments.map((name, index) => [`1a4e0bd0-5f4a-4d10-8000-0000000002${String(index + 2).padStart(2, '0')}`, name, index] as [string, string, number])];
  for (const [id, name, index] of spaces) {
    const departmentId = index === null ? null : `1a4e0bd0-5f4a-4d10-8000-0000000001${String(index + 1).padStart(2, '0')}`;
    await db.run('INSERT IGNORE INTO workspaces (id,organization_id,department_id,creator_membership_id,name,description) VALUES (?,?,?,?,?,?)', [id, orgId, departmentId, bootstrapMembership, name, index === null ? 'Espaço institucional da direção geral.' : `Espaço inicial do departamento ${name}.`]);
  }
}
export const CAECOMP_ORGANIZATION_ID = orgId;
