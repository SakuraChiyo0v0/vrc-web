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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 顺序很重要：先建库+种子，再起服务。以前是先起服务再种子，两者同时初始化
// 同一个 SQLite 文件会撞 "database is locked"，子服务直接退出、种子落进没人读的库。
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

// 动态页（80）需要 friend_event：上线 / 换房 / 活跃 / 下线各来几条，带区域与访问级别
const feed = [
  ['usr_alice', 'Alice', 'location', 'wrld_a:1~hidden(usr_me)~region(jp)', 'wrld_a', 'Alpha Club', 4],
  ['usr_bob', 'Bob', 'offline', 'offline', null, null, 12],
  ['usr_carol', 'Carol', 'location', 'wrld_b:2~region(us)', 'wrld_b', 'Beta Lounge', 20],
  ['usr_dave', 'Dave', 'online', 'wrld_c:3~group(grp_1)~region(jp)', 'wrld_c', '夜の喫茶店', 35],
  ['usr_alice', 'Alice', 'active', 'wrld_a:1~hidden(usr_me)~region(jp)', 'wrld_a', 'Alpha Club', 48],
  ['usr_carol', 'Carol', 'profile', null, null, null, 70],
  ['usr_dave', 'Dave', 'offline', 'offline', null, null, 95],
  ['usr_bob', 'Bob', 'location', 'wrld_a:1~friends(usr_me)~region(jp)', 'wrld_a', 'Alpha Club', 130],
];
for (const [uid, name, kind, loc, wid, wname, mins] of feed) {
  await ins(`insert into friend_event (user_id, display_name, kind, location, world_id, world_name, at)
             values (?,?,?,?,?,?,?)`, [uid, name, kind, loc, wid, wname, at(now - mins * MIN)]);
}

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
// 动态页（/api/events → friend_event）：五种 kind 都摆一条，location 带 region/access 让「JP · 仅好友」有意义
const ev = (kind, uid, name, loc, wid, wname, minsAgo) =>
  ins(`insert into friend_event (user_id, display_name, kind, location, world_id, world_name, at) values (?,?,?,?,?,?,?)`,
    [uid, name, kind, loc, wid, wname, at(now - minsAgo * MIN)]);
await ev('online', 'usr_alice', 'Alice', 'wrld_a:1~region(jp)~hidden(usr_me)', 'wrld_a', 'Alpha Club', 95);
await ev('location', 'usr_alice', 'Alice', 'wrld_b:2~region(jp)~group(grp_1)', 'wrld_b', 'Beta Lounge', 80);
await ev('active', 'usr_alice', 'Alice', 'wrld_b:2~region(jp)~group(grp_1)', 'wrld_b', 'Beta Lounge', 74);
await ev('location', 'usr_alice', 'Alice', 'wrld_a:3~region(jp)~hidden(usr_me)', 'wrld_a', 'Alpha Club', 36);
await ev('profile', 'usr_carol', 'Carol', null, null, null, 30);
await ev('online', 'usr_carol', 'Carol', 'wrld_b:2~region(us)~friends(usr_me)', 'wrld_b', 'Beta Lounge', 20);
await ev('offline', 'usr_bob', 'Bob', 'offline', null, null, 18);
await ev('location', 'usr_dave', 'Dave', 'wrld_c:4~region(jp)', 'wrld_c', '夜の喫茶店', 8);
const counts = (await db.query(`select
  (select count(*) from friend) as friends,
  (select count(*) from self_event) as self_events,
  (select count(*) from friend_event) as feed,
  (select count(*) from game_event) as game_events`))[0];
await db.close();
const empty = Object.entries(counts).filter(([, n]) => !Number(n)).map(([k]) => k);
if (empty.length) {
  console.error(`[demo] 种子为空：${empty.join(',')}（库 ${file}）`);
  process.exit(1);
}
console.log(`[demo] 种子 ${JSON.stringify(counts)}`);

// 种子落盘后再起服务，探活失败/子进程退出直接报错，避免截到空态。
const srv = spawn(process.execPath, ['src/index.js'], {
  cwd: path.join(ROOT, 'server'),
  env: { ...process.env, VRC_DB_URL: dbUrl, PORT: String(port), VRC_INGEST_TOKEN: 'demo-token', VRC_ALERT_EMIT: '' },
  stdio: ['ignore', 'inherit', 'inherit'],
});
let childDead = null;
srv.on('exit', (code) => { childDead = code; });
let up = false;
for (let i = 0; i < 100; i++) {
  if (childDead !== null) {
    console.error(`[demo] 子服务退出 code=${childDead}（端口 ${port} 被占用？先杀掉残留 demo/服务进程）`);
    process.exit(1);
  }
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/roster`);
    if (r.ok) {
      const probe = await r.json();
      if (!probe.total) { console.error('[demo] 端口上跑的是别的实例（roster.total=0），种子没被读到'); process.exit(1); }
      up = true;
      break;
    }
  } catch {}
  await wait(200);
}
if (!up) { console.error('[demo] 服务 20s 内未就绪'); process.exit(1); }

fs.writeFileSync(path.join(os.tmpdir(), 'vrc-demo.url'), `http://127.0.0.1:${port}/\n`);
console.log(`DEMO READY http://127.0.0.1:${port}/  db=${file}`);
process.on('SIGTERM', () => { srv.kill('SIGTERM'); fs.rmSync(file, { force: true }); process.exit(0); });
setInterval(() => {}, 1 << 30);
