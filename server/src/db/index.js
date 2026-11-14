import { open as openPg } from './postgres.js';
import { open as openSqlite } from './sqlite.js';
import { ddlFor } from './schema.js';

/**
 * 数据库适配层：上层只写 `?` 占位符的 SQL 和 JS 值，这里按方言翻译。
 * 连接串形态：
 *   postgres://user:pass@host:5432/db   → PostgreSQL
 *   sqlite:/path/to/vrc.db              → SQLite（文件不存在会自动建）
 *   :memory: / sqlite::memory:          → 内存库（测试用）
 */
export function isSqliteUrl(url) {
  return url.startsWith('sqlite:') || url === ':memory:' || url.endsWith('.db') || url.endsWith('.sqlite');
}

export async function openDb(url) {
  const db = isSqliteUrl(url) ? await openSqlite(url) : await openPg(url);
  for (const stmt of ddlFor(db.dialect)) {
    try {
      await db.exec(stmt);
    } catch (e) {
      // 老库已存在同名列等情况，DDL 幂等失败不该阻止启动
      if (!/already exists|duplicate column/i.test(e.message)) throw e;
    }
  }
  return db;
}

/** 建库（供 migrate 脚本用） */
export { ddlFor };
