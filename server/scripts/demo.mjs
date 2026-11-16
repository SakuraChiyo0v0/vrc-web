/**
 * 演示/截图用服务：临时 SQLite 种子 + 真实 server（含 web/dist 静态站）。
 *   node server/scripts/demo.mjs [port]        # 默认 8899，Ctrl-C 退出
 *
 * 只写临时库（os.tmpdir），不碰线上 PG / VRChat。种子与 parity7 一致，
 * 目的是让「概览 / 好友位置 / 动态 / 游戏日志」四页都有数据可看。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openDb } from '../src/db/index.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const port = Number(process.argv[2] ?? 8899);
const file = path.join(os.tmpdir(), `vrc-demo-${process.pid}.db`);
const dbUrl = `sqlite:${file}`;

const MIN = 60_000;
const now = Date.now();
const at = (ms) => new Date(ms).toISOString();
const daysAgo = (n) => now - n * 86400_000;

const srv = spawn(process.execPath, ['src/index.js'], {
  cwd: path.join(ROOT, 'server'),
  env: { ...process.env, VRC_DB_URL: dbUrl, PORT: String(port), VRC_INGEST_TOKEN: 'demo-token', VRC_ALERT_EMIT: '' },
  stdio: ['ignore', 'inherit', 'inherit'],
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 100; i++) {
  try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; } catch {}
  await wait(200);
}

const db = await openDb(dbUrl);
const ins = (sql, p) => db.query(sql, p);
await ins(`insert into world (id, name) values (?,?)`, ['wrld_a', 'Alpha Club']);
await ins(`insert into world (id, name) values (?,?)`, ['wrld_b', 'Beta Lounge']);
await ins(`insert into world (id, name) values (?,?)`, ['wrld_c', '夜の喫茶店']);
await ins(`insert into friend (user_id, display_name, trust_level, platform, status, status_description, location, world_id, world_name, icon_url, is_favorite, updated_at)
           values (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ['usr_alice', 'Alice', 'system_trust_trusted', 'standalonewindows', 'active', '画图', 'wrld_a:1~hidden(usr_me)~region(jp)', 'wrld_a', 'Alpha Club', 'av_1', 1, at(now - MIN)]);
await ins(`insert into friend (user_id, display_name, trust_level, platform, status, location, icon_url, is_favorite, updated_at)
           values (?,?,?,?,?,?,?,?,?)`,
  ['usr_bob', 'Bob', 'system_trust_known', 'android', 'offline', 'offline', 'av_2', 0, at(now - 5 * 60 * MIN)]);
await ins(`insert into friend (user_id, display_name, trust_level, platform, status, location, world_id, world_name, icon_url, is_favorite, updated_at)
           values (?,?,?,?,?,?,?,?,?,?,?)`,
  ['usr_carol', 'Carol', 'system_trust_basic', 'standalonewindows', 'join me', 'wrld_b:2~region(us)', 'wrld_b', 'Beta Lounge', 'av_3', 0, at(now - MIN)]);
await ins(`insert into friend_session (id, user_id, started_at, ended_at, minutes, location, world_id, world_name, status)
           values (?,?,?,?,?,?,?,?,?)`,
  ['s_alice', 'usr_alice', at(now - 36 * MIN), null, null, 'wrld_a:1~region(jp)', 'wrld_a', 'Alpha Club', 'active']);
await ins(`insert into friend_session (id, user_id, started_at, ended_at, minutes, location, world_id, world_name, status)
           values (?,?,?,?,?,?,?,?,?)`,
  ['s_carol', 'usr_carol', at(now - 20 * MIN), null, null, 'wrld_b:2~region(us)', 'wrld_b', 'Beta Lounge', 'join me']);
await ins(`insert into friend_session (id, user_id, started_at, ended_at, minutes, location, world_id, world_name, status)
           values (?,?,?,?,?,?,?,?,?)`,
  ['s_bob', 'usr_bob', at(now - 90 * MIN), at(now - 60 * MIN), 30, 'wrld_a:1', 'wrld_a', 'Alpha Club', 'active']);

// 我的足迹：近 7 天每天 1~3 段，供概览/行程/游戏日志有形状
const plan = [
  [6, 'wrld_a', 'Alpha Club', 95], [6, 'wrld_c', '夜の喫茶店', 40],
  [5, 'wrld_b', 'Beta Lounge', 70], [4, 'wrld_a', 'Alpha Club', 120],
  [3, 'wrld_c', '夜の喫茶店', 55], [2, 'wrld_a', 'Alpha Club', 80],
  [1, 'wrld_b', 'Beta Lounge', 45], [1, 'wrld_a', 'Alpha Club', 30],
  [0, 'wrld_a', 'Alpha Club', 60],
];
for (const [d, wid, wname, mins] of plan) {
  // myIntervals 语义：相邻两条 location 事件之间算一次停留 → 进入写世界，退出写 offline
  const start = daysAgo(d) - mins * MIN - 2 * 60 * MIN;
  await ins(`insert into self_event (kind, location, world_id, at) values (?,?,?,?)`,
    ['location', `${wid}:1~region(jp)`, wid, at(start)]);
  await ins(`insert into self_event (kind, location, world_id, at) values (?,?,?,?)`,
    ['location', 'offline', null, at(start + mins * MIN)]);
  await ins(`insert into game_event (kind, display_name, user_id, location, world_name, detail, at) values (?,?,?,?,?,?,?)`,
    ['room_join', 'Dave', 'usr_dave', null, wname, null, at(start + 5 * MIN)]);
}
await ins(`insert into game_event (kind, display_name, user_id, location, world_name, detail, at) values (?,?,?,?,?,?,?)`,
  ['room_join', 'Dave', 'usr_dave', null, 'Alpha Club', null, at(now - 60 * MIN)]);
await ins(`insert into game_event (kind, display_name, user_id, location, world_name, detail, at) values (?,?,?,?,?,?,?)`,
  ['room_join', 'Alice', 'usr_alice', null, 'Alpha Club', null, at(now - 50 * MIN)]);
// 正在进行的一次：只有进入、没有退出 → 区间到 now，供右栏「相处最久的人」有数据
await ins(`insert into self_event (kind, location, world_id, at) values (?,?,?,?)`,
  ['location', 'wrld_a:1~region(jp)', 'wrld_a', at(now - 100 * MIN)]);
await db.close();

fs.writeFileSync(path.join(os.tmpdir(), 'vrc-demo.url'), `http://127.0.0.1:${port}/\n`);
console.log(`DEMO READY http://127.0.0.1:${port}/  db=${file}`);
process.on('SIGTERM', () => { srv.kill('SIGTERM'); fs.rmSync(file, { force: true }); process.exit(0); });
setInterval(() => {}, 1 << 30);
