import fs from 'node:fs';

const DB_URL_FILE = process.env.VRC_DB_URL_FILE || '/opt/astra/home/db-url';

/**
 * 数据库连接串：
 *   VRC_DB_URL 直接给（postgres://… 或 sqlite:/path/vrc.db）
 *   否则读 VRC_DB_URL_FILE（默认 NAS 上那份 postgres 连接串）
 *   都没有 → 落到本地 SQLite（开发环境零配置）
 */
export function dbUrl() {
  if (process.env.VRC_DB_URL) return process.env.VRC_DB_URL;
  try {
    return fs.readFileSync(DB_URL_FILE, 'utf8').trim();
  } catch {
    return 'sqlite:./data/vrc.db';
  }
}
