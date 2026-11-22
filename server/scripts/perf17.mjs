/**
 * 第十七轮性能基准：核心接口 p95 <100ms + 冷启动 <3s。
 *
 *   node server/scripts/perf17.mjs        # 退出码 0 = 全部达标
 *
 * 只碰临时 SQLite 库（os.tmpdir），起独立服务进程测：
 *   冷启动 = spawn → /api/health 首次 200 的墙钟时间
 *   p95    = 每个接口 20 次取样（丢弃第 1 次预热）排序后第 95 百分位
 * 数据量同 perf12：500 好友 / 2 万好友事件 / 1 万游戏事件 / 各 5 千资料·状态。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../src/db/index.js';

const COLD_LIMIT_MS = 3000;
const SAMPLES = 20;

/** 核心接口：首页一带都会打的读接口，全部要求 p95 <100ms */
const CORE = [
  ['health', '/api/health'],
  ['status', '/api/status'],
  ['friends', '/api/friends'],
  ['events', '/api/events?limit=100'],
  ['notifications', '/api/notifications'],
  ['sessions', '/api/sessions'],
  ['players', '/api/players'],
  ['stats', '/api/stats?days=7'],
];
/** 搜索另有 60s 缓存，单独给更严的 100ms；friend-log 是分析型列表，保留 200ms 档 */
const EXTRA = [
  ['search', '/api/search?q=%E5%B0%8F%E7%BA%A2', 100],
  ['friendlog', '/api/friend-log?hours=720&limit=100', 200],
];

const file = path.join(os.tmpdir(), `vrc-perf17-${Date.now()}.db`);
const db = await openDb(`sqlite:${file}`);
const q = (sql, p) => db.query(sql, p);

const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
await db.exec('begin');

const friends = [];
for (let i = 0; i < 500; i++) {
  const online = i % 4 !== 0;
  friends.push([
    `usr_${i}`,
    i % 3 === 0 ? `小红${i}` : `friend_${i}`,
    ['system_trust_trusted', 'system_trust_known', 'system_trust_basic'][i % 3],
    i % 2 ? 'standalonewindows' : 'android',
    online ? 'active' : 'offline',
    online ? `wrld_${i % 40}:12345` : 'offline',
    online ? `wrld_${i % 40}` : null,
    online ? `World ${i % 40}` : null,
  ]);
}
for (const f of friends) {
  await q(
    `insert into friend (user_id, display_name, trust_level, platform, status, location, world_id, world_name, updated_at)
     values (?,?,?,?,?,?,?,?,?)`,
    [...f, iso(now)],
  );
}
for (let i = 0; i < 40; i++) {
  await q(`insert into world (id, name, author_name) values (?,?,?)`, [`wrld_${i}`, `World ${i}`, 'author']);
}
const evKinds = ['online', 'offline', 'location'];
for (let i = 0; i < 20000; i++) {
  await q(
    `insert into friend_event (user_id, display_name, kind, location, world_id, world_name, at)
     values (?,?,?,?,?,?,?)`,
    [`usr_${i % 500}`, friends[i % 500][1], evKinds[i % 3], `wrld_${i % 40}`, `wrld_${i % 40}`, `World ${i % 40}`, iso(now - i * 120_000)],
  );
}
for (let i = 0; i < 10000; i++) {
  await q(
    `insert into game_event (kind, display_name, user_id, location, world_name, at)
     values (?,?,?,?,?,?)`,
    ['room_join', friends[i % 500][1], `usr_${i % 500}`, `wrld_${i % 40}`, `World ${i % 40}`, iso(now - i * 240_000)],
  );
}
for (let i = 0; i < 5000; i++) {
  await q(`insert into friend_change (user_id, field, old_value, new_value, at) values (?,?,?,?,?)`, [
    `usr_${i % 500}`, 'bio', null, 'x', iso(now - i * 300_000),
  ]);
  await q(`insert into friend_status_history (user_id, status, description, at) values (?,?,?,?)`, [
    `usr_${i % 500}`, 'active', 'hi', iso(now - i * 300_000),
  ]);
  await q(`insert into notification (id, type, sender_user_id, message, created_at) values (?,?,?,?,?)`, [
    `ntf_${i}`, 'friendRequest', `usr_${i % 500}`, 'hi', iso(now - i * 600_000),
  ]);
}
await db.exec('commit');
await db.close();

const port = await new Promise((res, rej) => {
  const s = net.createServer();
  s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
});

const t0 = performance.now();
const srv = spawn(process.execPath, ['src/index.js'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: { ...process.env, VRC_DB_URL: `sqlite:${file}`, PORT: String(port), VRC_INGEST_TOKEN: 'perf' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
srv.stdout.on('data', (d) => { log += d; });
srv.stderr.on('data', (d) => { log += d; });

const base = `http://127.0.0.1:${port}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let exitCode = 1;

try {
  let coldMs = 0;
  for (let i = 0; i < 600; i++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) { coldMs = performance.now() - t0; break; }
    } catch {}
    await wait(100);
  }
  if (!coldMs) throw new Error(`api 未启动（60s）：\n${log}`);

  const time = async (url) => {
    const t = performance.now();
    const r = await fetch(base + url);
    const body = await r.json();
    const ms = performance.now() - t;
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return { ms, body };
  };

  const p95 = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)];
  };

  const rows = [];
  const bodies = {};
  for (const [name, url, limit] of [...CORE.map(([n, u]) => [n, u, 100]), ...EXTRA]) {
    const runs = [];
    for (let i = 0; i < SAMPLES; i++) {
      const r = await time(url);
      bodies[name] = r.body;
      if (i > 0) runs.push(r.ms); // 第 1 次含缓存/连接预热，丢弃
    }
    const p = p95(runs);
    rows.push({ name, p95: Math.round(p), max: Math.round(Math.max(...runs)), limit, ok: p < limit });
  }

  // 结果非空：空结果集的「快」不算数
  const counts = {
    friends: bodies.friends?.total ?? 0,
    events: bodies.events?.returned ?? 0,
    notifications: bodies.notifications?.returned ?? 0,
    sessions: bodies.sessions?.returned ?? 0,
    players: bodies.players?.returned ?? 0,
    stats: bodies.stats?.total ?? 0,
    search: bodies.search?.counts?.friends ?? 0,
    friendlog: bodies.friendlog?.items?.length ?? 0,
  };
  const empty = Object.entries(counts).filter(([, n]) => !n).map(([k]) => k);

  const coldOk = coldMs < COLD_LIMIT_MS;
  console.log(`PERF17 冷启动 ${Math.round(coldMs)}ms (${coldOk ? '<' : '>='} ${COLD_LIMIT_MS}) ${coldOk ? 'OK' : 'FAIL'}`);
  for (const r of rows) {
    console.log(`PERF17 ${r.name} p95=${r.p95}ms max=${r.max}ms (<${r.limit}) ${r.ok ? 'OK' : 'FAIL'}`);
  }
  console.log(`PERF17 结果条数 ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ')}${empty.length ? `（空：${empty.join(',')}，计时不可信）` : ''}`);

  exitCode = coldOk && rows.every((r) => r.ok) && !empty.length ? 0 : 1;
  console.log(exitCode === 0 ? 'PERF17 OK' : 'PERF17 FAIL');
} catch (e) {
  console.log(`PERF17 FAIL ${e.message}`);
} finally {
  srv.kill();
  await wait(300);
  for (const f of [file, `${file}-wal`, `${file}-shm`]) { try { fs.unlinkSync(f); } catch {} }
}
process.exit(exitCode);
