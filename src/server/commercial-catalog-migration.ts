import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import type { Database } from './database.js';

export const defaultCategories = [
  {name:'Camisetas',prefix:'CAM',options:[{name:'Tamanho',values:['P','M','G','GG']},{name:'Modelo',values:['Tradicional','Babylook']}]},
  {name:'Moletons',prefix:'MOL',options:[{name:'Tamanho',values:['P','M','G','GG']}]},
  {name:'Adesivos',prefix:'ADS',options:[{name:'Modelo',values:['Modelo A','Modelo B']}]},
  {name:'Ecobags',prefix:'ECO',options:[]}, {name:'Canecas',prefix:'CAN',options:[]}, {name:'Outros',prefix:'OUT',options:[]},
];
export const categoryPrefix=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z]/g,'').slice(0,3).toUpperCase()||'PRD';
export async function migrateCommercialCatalog(db:Database){
  await db.run(`CREATE TABLE IF NOT EXISTS commercial_categories (id char(36) PRIMARY KEY, organization_id char(36) NOT NULL, name varchar(120) NOT NULL, prefix varchar(12) NOT NULL UNIQUE, options json NOT NULL, revision int unsigned NOT NULL DEFAULT 1, UNIQUE KEY category_name(organization_id,name), FOREIGN KEY(organization_id) REFERENCES organizations(id))`);
  await db.run(`CREATE TABLE IF NOT EXISTS commercial_code_counters (prefix varchar(12) PRIMARY KEY, next_number int unsigned NOT NULL DEFAULT 1)`);
  const add=async(table:string,column:string,type:string)=>{if(!await db.one<RowDataPacket>('SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?',[table,column]))await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)};
  await add('commercial_products','category_id','char(36) NULL, ADD CONSTRAINT commercial_product_category FOREIGN KEY(category_id) REFERENCES commercial_categories(id)');
  await add('commercial_products','cost_cents','int unsigned NULL');await add('commercial_products','sale_cents','int unsigned NULL');
  await add('commercial_variants','attributes','json NULL');
  await add('commercial_campaigns','description',"varchar(2000) NOT NULL DEFAULT ''");
  await add('commercial_campaigns','semester',"varchar(6) NOT NULL DEFAULT ''");
  await add('commercial_campaigns','stage',"enum('orders','collection') NOT NULL DEFAULT 'orders'");
  await add('commercial_campaigns','status',"enum('active','archived') NOT NULL DEFAULT 'active'");
  await add('commercial_campaigns','version','int unsigned NOT NULL DEFAULT 1');
  // Preserve all existing IDs, SKUs, quantities, movements and legacy reference prices.
  for(const c of defaultCategories)await db.run('INSERT IGNORE INTO commercial_categories(id,organization_id,name,prefix,options) SELECT ?,id,?,?,? FROM organizations WHERE slug=\'caecomp\'',[randomUUID(),c.name,c.prefix,JSON.stringify(c.options)]);
  const existing=await db.many<RowDataPacket>(`SELECT DISTINCT organization_id,category FROM commercial_products WHERE category<>''`);
  for(const row of existing){let cat=await db.one<RowDataPacket>('SELECT id FROM commercial_categories WHERE organization_id=? AND name=?',[row.organization_id,row.category]);if(!cat){const id=randomUUID(),base=categoryPrefix(row.category);let prefix=base,n=2;while(await db.one<RowDataPacket>('SELECT id FROM commercial_categories WHERE prefix=?',[prefix]))prefix=`${base}${n++}`;await db.run('INSERT IGNORE INTO commercial_categories(id,organization_id,name,prefix,options) VALUES (?,?,?,?,?)',[id,row.organization_id,row.category,prefix,'[]']);cat=await db.one<RowDataPacket>('SELECT id FROM commercial_categories WHERE organization_id=? AND name=?',[row.organization_id,row.category]);}await db.run('UPDATE commercial_products SET category_id=? WHERE organization_id=? AND category=? AND category_id IS NULL',[cat!.id,row.organization_id,row.category]);}
}
