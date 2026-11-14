import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * SQLite 适配：时间一律存 ISO 字符串，布尔存 0/1，jsonb 存 TEXT。
 * node:sqlite 是实验特性，会在启动时打一条 ExperimentalWarning，可以忽略。
 */
export async function open(file) {
  const target = file.startsWith('sqlite:') ? file.slice('sqlite:'.length) : file;
  if (target !== ':memory:') fs.mkdirSync(path.dirname(target), { recursive: true });
  const db = new DatabaseSync(target);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  const norm = (params) =>
    (params ?? []).map((v) => {
      if (v instanceof Date) return v.toISOString();
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (v !== null && typeof v === 'object') return JSON.stringify(v);
      return v;
    });

  return {
    dialect: 'sqlite',
    tbl: (name) => name,
    async query(sql, params) {
      const stmt = db.prepare(sql);
      const p = norm(params);
      if (!p.length) return stmt.all();
      return stmt.all(...p);
    },
    async exec(sql) {
      db.exec(sql);
    },
    async close() {
      db.close();
    },
    raw: db,
  };
}
