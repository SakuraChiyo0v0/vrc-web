import { openDb } from './db/index.js';
import { dbUrl } from './config.js';

const db = await openDb(dbUrl());
console.log(`schema ready (${db.dialect})`);
const rows = await db.query(
  db.dialect === 'sqlite'
    ? `select name from sqlite_master where type='table' order by name`
    : `select table_name as name from information_schema.tables where table_schema='vrc' order by 1`,
);
console.log('tables:', rows.map((r) => r.name).join(', '));
await db.close();
