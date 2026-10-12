import type { RowDataPacket } from 'mysql2';
import { CAECOMP_ORGANIZATION_ID as org, type Database } from './database.js';

// One database mutex for this small operation. All reservation/receipt/ledger
// writers acquire it before product, variant and order locks. No process mutex.
export async function lockCommercial(db: Database) {
  await db.one<RowDataPacket>('SELECT organization_id FROM commercial_operations WHERE organization_id=? FOR UPDATE',[org]);
}
export async function reserved(db: Database, variantId: string): Promise<number> {
  const r=await db.one<RowDataPacket>(`SELECT COALESCE(SUM(allocated_quantity),0) AS quantity FROM commercial_order_items WHERE variant_id=? AND (allocation_status='committed' OR (allocation_status='provisional' AND expires_at>NOW(3)))`,[variantId]);
  return Number(r!.quantity);
}
