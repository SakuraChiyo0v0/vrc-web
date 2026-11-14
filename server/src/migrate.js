import { applySchema, q } from './db.js';
await applySchema();
const r = await q("select table_name from information_schema.tables where table_schema='vrc' order by 1");
console.log('tables:', r.map((x) => x.table_name).join(', '));
process.exit(0);
