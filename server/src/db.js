import fs from 'node:fs';
import pg from 'pg';

const DB_URL_FILE = process.env.VRC_DB_URL_FILE || '/opt/astra/home/db-url';

export function dbUrl() {
  if (process.env.VRC_DB_URL) return process.env.VRC_DB_URL;
  return fs.readFileSync(DB_URL_FILE, 'utf8').trim();
}

export const pool = new pg.Pool({ connectionString: dbUrl(), max: 6 });

export async function q(text, params) {
  const r = await pool.query(text, params);
  return r.rows;
}

export async function applySchema() {
  const sql = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
}

/** 从 location 里拆 world id：wrld_xxx:12345~region(us) → wrld_xxx */
export function worldIdOf(location) {
  if (!location) return null;
  const m = /^(wrld_[0-9a-f-]+)/i.exec(location);
  return m ? m[1] : null;
}
