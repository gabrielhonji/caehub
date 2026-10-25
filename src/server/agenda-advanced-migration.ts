import type { RowDataPacket } from 'mysql2';
import type { Database } from './database.js';

export async function migrateAdvancedAgenda(db: Database) {
  const generic = await db.one<RowDataPacket>(`SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='agenda_notifications' AND column_name='resource_type'`);
  if (!generic) await db.run(`ALTER TABLE agenda_notifications MODIFY meeting_id char(36) NULL, MODIFY kind varchar(40) NOT NULL,
    ADD COLUMN resource_type varchar(40) NOT NULL DEFAULT 'meeting', ADD COLUMN resource_id char(36) NULL,
    ADD COLUMN title varchar(200) NULL, ADD COLUMN priority enum('normal','high') NOT NULL DEFAULT 'normal'`);
  await db.run(`CREATE TABLE IF NOT EXISTS agenda_history (id char(36) PRIMARY KEY, actor_membership_id char(36) NOT NULL,
    resource_type varchar(40) NOT NULL, resource_id char(36) NOT NULL, action varchar(60) NOT NULL, data json NULL,
    created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX agenda_resource_history(resource_type,resource_id,created_at),
    FOREIGN KEY(actor_membership_id) REFERENCES memberships(id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS availability_requests (id char(36) PRIMARY KEY, organization_id char(36) NOT NULL,
    organizer_membership_id char(36) NOT NULL, workspace_id char(36) NULL, title varchar(200) NOT NULL,
    starts_at datetime(3) NOT NULL, ends_at datetime(3) NOT NULL, deadline datetime(3) NULL,
    created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    FOREIGN KEY(organization_id) REFERENCES organizations(id), FOREIGN KEY(organizer_membership_id) REFERENCES memberships(id),
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id), CHECK(starts_at<ends_at))`);
  await db.run(`CREATE TABLE IF NOT EXISTS availability_request_participants (request_id char(36) NOT NULL, membership_id char(36) NOT NULL,
    reviewed_at datetime(3) NULL, review_kind enum('unchanged','updated','cancelled') NULL, PRIMARY KEY(request_id,membership_id),
    FOREIGN KEY(request_id) REFERENCES availability_requests(id), FOREIGN KEY(membership_id) REFERENCES memberships(id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS meeting_polls (id char(36) PRIMARY KEY, organization_id char(36) NOT NULL,
    organizer_membership_id char(36) NOT NULL, workspace_id char(36) NULL, title varchar(200) NOT NULL, description text NULL,
    location varchar(255) NULL, deadline datetime(3) NULL, closed_at datetime(3) NULL, resulting_meeting_id char(36) NULL UNIQUE,
    created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(organization_id) REFERENCES organizations(id),
    FOREIGN KEY(organizer_membership_id) REFERENCES memberships(id), FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
    FOREIGN KEY(resulting_meeting_id) REFERENCES meetings(id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS meeting_poll_options (id char(36) PRIMARY KEY,poll_id char(36) NOT NULL,
    starts_at datetime(3) NOT NULL, ends_at datetime(3) NOT NULL, UNIQUE(poll_id,id), UNIQUE(poll_id,starts_at,ends_at),
    FOREIGN KEY(poll_id) REFERENCES meeting_polls(id), CHECK(starts_at<ends_at))`);
  await db.run(`CREATE TABLE IF NOT EXISTS meeting_poll_participants (poll_id char(36) NOT NULL,membership_id char(36) NOT NULL,
    none_works boolean NOT NULL DEFAULT false,voted_at datetime(3) NULL,PRIMARY KEY(poll_id,membership_id),
    FOREIGN KEY(poll_id) REFERENCES meeting_polls(id), FOREIGN KEY(membership_id) REFERENCES memberships(id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS meeting_poll_votes (poll_id char(36) NOT NULL,membership_id char(36) NOT NULL,option_id char(36) NOT NULL,
    PRIMARY KEY(poll_id,membership_id,option_id), FOREIGN KEY(poll_id,membership_id) REFERENCES meeting_poll_participants(poll_id,membership_id),
    FOREIGN KEY(poll_id,option_id) REFERENCES meeting_poll_options(poll_id,id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS agenda_shifts (id char(36) PRIMARY KEY,organization_id char(36) NOT NULL,
    workspace_id char(36) NOT NULL,organizer_membership_id char(36) NOT NULL,related_meeting_id char(36) NULL,
    title varchar(200) NOT NULL,description text NULL,location varchar(255) NULL,starts_at datetime(3) NOT NULL,ends_at datetime(3) NOT NULL,
    minimum_capacity int unsigned NULL,maximum_capacity int unsigned NOT NULL,priority_window_hours int unsigned NOT NULL DEFAULT 2,
    revision int unsigned NOT NULL DEFAULT 1,cancelled_at datetime(3) NULL,created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    FOREIGN KEY(organization_id) REFERENCES organizations(id),FOREIGN KEY(workspace_id) REFERENCES workspaces(id),
    FOREIGN KEY(organizer_membership_id) REFERENCES memberships(id),FOREIGN KEY(related_meeting_id) REFERENCES meetings(id),
    CHECK(starts_at<ends_at),CHECK(maximum_capacity>0),CHECK(minimum_capacity IS NULL OR minimum_capacity<=maximum_capacity))`);
  await db.run(`CREATE TABLE IF NOT EXISTS agenda_shift_participants (shift_id char(36) NOT NULL,membership_id char(36) NOT NULL,
    status enum('pending','confirmed','declined','withdrawn','removed','cancelled') NOT NULL,responded_at datetime(3) NULL,
    PRIMARY KEY(shift_id,membership_id),FOREIGN KEY(shift_id) REFERENCES agenda_shifts(id),FOREIGN KEY(membership_id) REFERENCES memberships(id),
    INDEX shift_member_calendar(membership_id,status))`);
 await db.run(`CREATE TABLE IF NOT EXISTS agenda_shift_batches(request_key char(36) PRIMARY KEY,organizer_id char(36) NOT NULL,payload_hash char(64) NOT NULL,shift_ids JSON NOT NULL)`);
 await db.run("ALTER TABLE availability_request_participants MODIFY COLUMN review_kind enum('unchanged','updated','cancelled') NULL");

}
