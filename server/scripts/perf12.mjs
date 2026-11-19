/**
 * 125 性能基准：搜索 <100ms、好友历史 <200ms（连续 3 次都达标）。
 *
 *   node server/scripts/perf12.mjs        # 退出码 0 = 全部达标
 *
 * 只碰临时 SQLite 库（os.tmpdir），起一个独立 server 进程压测，不碰线上 PG / VRChat。
 * 数据量按「一个真活跃账号」的量级造：500 好友、2 万好友事件、1 万游戏事件。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../src/db/index.js';

const RUNS = 3;
const THRESH = { search: 100, friendlog: 200 };

const file = path.join(os.tmpdir(), `vrc-perf12-${Date.now()}.db`);
const db = await openDb(`sqlite:${file}`);
const q = (sql, p) => db.query(sql, p);

const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
// 3.5 万条逐条 insert 在 WAL 上要跑几分钟；整个种子包一个事务，压到几秒
await db.exec('begin');

// 500 好友，名字里混中英文，搜索要走 pinyin + 全量过滤
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

// 2 万条好友事件（30 天），好友历史要在这上面按时间窗排序
const evKinds = ['online', 'offline', 'location'];
for (let i = 0; i < 20000; i++) {
  const uid = `usr_${i % 500}`;
  await q(
    `insert into friend_event (user_id, display_name, kind, location, world_id, world_name, at)
     values (?,?,?,?,?,?,?)`,
    [uid, friends[i % 500][1], evKinds[i % 3], `wrld_${i % 40}`, `wrld_${i % 40}`, `World ${i % 40}`, iso(now - i * 120_000)],
  );
}
// 1 万条游戏事件（同房统计 / 搜索里的玩家区走这张表）
for (let i = 0; i < 10000; i++) {
  await q(
    `insert into game_event (kind, display_name, user_id, location, world_name, at)
     values (?,?,?,?,?,?)`,
    ['room_join', friends[i % 500][1], `usr_${i % 500}`, `wrld_${i % 40}`, `World ${i % 40}`, iso(now - i * 240_000)],
  );
}
// 5000 条资料变更 + 5000 条状态历史（friend-log 三表合并）
for (let i = 0; i < 5000; i++) {
  await q(`insert into friend_change (user_id, field, old_value, new_value, at) values (?,?,?,?,?)`, [
    `usr_${i % 500}`, 'bio', null, 'x', iso(now - i * 300_000),
  ]);
  await q(`insert into friend_status_history (user_id, status, description, at) values (?,?,?,?)`, [
    `usr_${i % 500}`, 'active', 'hi', iso(now - i * 300_000),
  ]);
}
await db.exec('commit');
await db.close();

const port = await new Promise((res, rej) => {
  const s = net.createServer();
  s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
});

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
  let ready = false;
  for (let i = 0; i < 225; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; } } catch {}
    await wait(200);
  }
  if (!ready) throw new Error(`api 未启动：\n${log}`);

  /** 每个端点连续 3 次，取各自耗时；首轮含缓存预热，仍然要求达标 */
  const time = async (url) => {
    const t0 = performance.now();
    const r = await fetch(base + url);
    const body = await r.json();
    const ms = performance.now() - t0;
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return { ms, body };
  };

  const out = {};
  const first = {};
  for (const [name, url, limit] of [
    ['search', '/api/search?q=%E5%B0%8F%E7%BA%A2', THRESH.search],
    ['friendlog', '/api/friend-log?hours=720&limit=100', THRESH.friendlog],
  ]) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await time(url));
    const worst = Math.max(...runs.map((x) => x.ms));
    out[name] = { runs: runs.map((x) => Math.round(x.ms)), worst: Math.round(worst), limit, ok: worst < limit };
    first[name] = runs[0].body ?? {};
  }

  const payload = first.search;
  const fl = first.friendlog;
  // 命中数必须 > 0：空结果集的「快」没有意义
  const hits = { search: payload.counts?.friends ?? 0, friendlog: fl.items?.length ?? 0 };
  const hitOk = hits.search > 0 && hits.friendlog > 0;
  console.log(`PERF12 search=${out.search.runs.join('/')}ms (最差 ${out.search.worst} < ${THRESH.search}) ${out.search.ok ? 'OK' : 'FAIL'}`);
  console.log(`PERF12 friend-log=${out.friendlog.runs.join('/')}ms (最差 ${out.friendlog.worst} < ${THRESH.friendlog}) ${out.friendlog.ok ? 'OK' : 'FAIL'}`);
  console.log(`PERF12 结果条数 search.friends=${hits.search} friend-log.items=${hits.friendlog}${hitOk ? '' : '（0=子进程库没读到数据，计时仅供参考）'}`);

  exitCode = out.search.ok && out.friendlog.ok && hitOk ? 0 : 1;
  if (exitCode === 0) console.log('PERF12 OK');
  else console.log('PERF12 FAIL');
} catch (e) {
  console.log(`PERF12 FAIL ${e.message}`);
} finally {
  srv.kill();
  await wait(300);
  try { fs.unlinkSync(file); } catch {}
  try { fs.unlinkSync(`${file}-wal`); } catch {}
  try { fs.unlinkSync(`${file}-shm`); } catch {}
}
process.exit(exitCode);
