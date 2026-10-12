import type { Database } from './database.js';

export async function migrateOrders(db: Database) {
  await db.run(`CREATE TABLE IF NOT EXISTS commercial_operations (organization_id char(36) PRIMARY KEY, reservation_minutes int unsigned NULL, pix_instructions varchar(2000) NOT NULL DEFAULT '', FOREIGN KEY (organization_id) REFERENCES organizations(id))`);
  await db.run(`INSERT IGNORE INTO commercial_operations(organization_id) SELECT id FROM organizations WHERE slug='caecomp'`);
  await db.run(`CREATE TABLE IF NOT EXISTS commercial_orders (
    id char(36) PRIMARY KEY, campaign_id char(36) NOT NULL, buyer_person_id char(36) NULL,
    buyer_name varchar(255) NOT NULL, buyer_contact varchar(255) NOT NULL DEFAULT '',
    request_key char(36) NOT NULL UNIQUE, request_hash char(64) NOT NULL, total_cents bigint unsigned NOT NULL,
    status enum('pending','confirmed','expired','review','cancelled','completed') NOT NULL DEFAULT 'pending',
    payment_status enum('pending','problem','paid','refund_required','refunded') NOT NULL DEFAULT 'pending',
    delivery_status enum('waiting','ready','collected') NOT NULL DEFAULT 'waiting',
    payment_actor varchar(255) NULL, paid_at datetime(3) NULL, delivery_actor varchar(255) NULL, collected_at datetime(3) NULL,
    created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    FOREIGN KEY(campaign_id) REFERENCES commercial_campaigns(id), FOREIGN KEY(buyer_person_id) REFERENCES people(id),
    INDEX order_campaign(campaign_id,created_at), INDEX order_buyer(buyer_person_id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS commercial_order_items (
    id char(36) PRIMARY KEY, order_id char(36) NOT NULL, variant_id char(36) NOT NULL,
    product_name varchar(200) NOT NULL, variant_name varchar(120) NOT NULL,
    fulfillment enum('stock','preorder') NOT NULL, quantity int unsigned NOT NULL, unit_price_cents int unsigned NOT NULL,
    allocation_status enum('none','provisional','committed','released','consumed') NOT NULL DEFAULT 'none',
    allocated_quantity int unsigned NOT NULL DEFAULT 0, expires_at datetime(3) NULL,
    production_status enum('waiting','in_production','received','not_needed') NOT NULL DEFAULT 'not_needed',
    UNIQUE KEY order_variant(order_id,variant_id), INDEX variant_allocation(variant_id,allocation_status,expires_at),
    FOREIGN KEY(order_id) REFERENCES commercial_orders(id), FOREIGN KEY(variant_id) REFERENCES commercial_variants(id),
    CHECK(quantity>0), CHECK(allocated_quantity<=quantity))`);
  await db.run(`CREATE TABLE IF NOT EXISTS commercial_order_events (
    id char(36) PRIMARY KEY, order_id char(36) NOT NULL, action varchar(80) NOT NULL,
    actor_subject varchar(255) NOT NULL, actor_name varchar(255) NOT NULL, note varchar(1000) NOT NULL DEFAULT '',
    created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), FOREIGN KEY(order_id) REFERENCES commercial_orders(id), INDEX order_events(order_id,created_at))`);
  await db.run(`CREATE TABLE IF NOT EXISTS commercial_production_receipts (
    id char(36) PRIMARY KEY, campaign_id char(36) NOT NULL, variant_id char(36) NOT NULL, quantity int unsigned NOT NULL,
    expected_quantity int unsigned NOT NULL, allocated_quantity int unsigned NOT NULL, reference varchar(200) NOT NULL,
    actor_subject varchar(255) NOT NULL, actor_name varchar(255) NOT NULL, created_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    FOREIGN KEY(campaign_id) REFERENCES commercial_campaigns(id), FOREIGN KEY(variant_id) REFERENCES commercial_variants(id), CHECK(quantity>0))`);
}
