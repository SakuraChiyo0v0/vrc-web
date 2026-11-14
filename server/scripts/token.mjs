#!/usr/bin/env node
/**
 * 对外只读 API 令牌管理（走 db 适配层，SQLite / PG 通用）：
 *   node server/scripts/token.mjs add [名字]    # 生成令牌并打印（只打印一次）
 *   node server/scripts/token.mjs list
 *   node server/scripts/token.mjs rm <token>
 */
import crypto from 'node:crypto';
import { openDb } from '../src/db/index.js';
import { dbUrl } from '../src/config.js';

const [cmd = 'list', arg] = process.argv.slice(2);
const db = await openDb(dbUrl());
const T = (n) => db.tbl(n);

try {
  if (cmd === 'add') {
    const token = `vrc_${crypto.randomBytes(24).toString('base64url')}`;
    const name = arg ?? 'default';
    await db.query(`insert into ${T('api_token')} (token, name) values (?,?)`, [token, name]);
    console.log(token);
  } else if (cmd === 'list') {
    const rows = await db.query(
      `select name, token, created_at, last_used_at from ${T('api_token')} order by created_at desc`,
    );
    if (!rows.length) console.log('（无令牌）');
    for (const r of rows) {
      const mask = `${String(r.token).slice(0, 8)}…${String(r.token).slice(-4)}`;
      console.log(`${(r.name ?? '-').padEnd(12)} ${mask}  建=${r.created_at}  用=${r.last_used_at ?? '-'}`);
    }
  } else if (cmd === 'rm') {
    if (!arg) throw new Error('用法：token.mjs rm <token>');
    await db.query(`delete from ${T('api_token')} where token = ?`, [arg]);
    console.log(`已删除 ${arg.slice(0, 8)}…`);
  } else {
    console.error('用法：token.mjs add [名字] | list | rm <token>');
    process.exitCode = 1;
  }
} finally {
  await db.close();
}
