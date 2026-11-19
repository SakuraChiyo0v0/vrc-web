/**
 * 冒烟：不碰 VRChat，直接往库里灌样例数据再读接口。
 *   node scripts/smoke.mjs            # 用 SQLite 临时库
 *   VRC_DB_URL=postgres://... node scripts/smoke.mjs   # 打真库（会写测试行！）
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const useSqlite = !process.env.VRC_DB_URL || process.env.VRC_DB_URL.startsWith('sqlite');
const file = path.join(os.tmpdir(), `vrc-smoke-${Date.now()}.db`);
const url = useSqlite ? `sqlite:${file}` : process.env.VRC_DB_URL;
// 端口动态取，避免上一次进程没退干净导致 bind 失败
const port = await new Promise((res, rej) => {
  const s = net.createServer();
  s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
});
const token = 'smoke-token';

const srv = spawn(process.execPath, ['src/index.js'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: { ...process.env, VRC_DB_URL: url, PORT: String(port), VRC_INGEST_TOKEN: token },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
let exited = null;
srv.stdout.on('data', (d) => { log += d; });
srv.stderr.on('data', (d) => { log += d; });
srv.on('error', (e) => { exited = `spawn ${e.message}`; log += `[spawn error] ${e.message}\n`; });
srv.on('exit', (code, sig) => { exited = `exit code=${code} sig=${sig ?? ''}`; log += `[exit] ${exited}\n`; });

const base = `http://127.0.0.1:${port}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let exitCode = 1;

try {
  let ready = false;
  // 90s：src/index.js 在 listen 之前要跑搜索缓存预热（warmSearchCache），
  // 机器忙时（并行 build/多份 demo 服务）能拖到 30s 以上，30s 预算会误报「api 未启动」。
  for (let i = 0; i < 450; i++) {
    if (exited) break;
    try {
      if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; }
    } catch {}
    await wait(200);
  }
  if (!ready) throw new Error(`api 未启动（${exited ?? 'timeout 90s，子进程日志见下'}）:\n${log || '（子进程还没有任何输出：多半卡在 listen 前的搜索缓存预热）'}`);

  const now = Date.now();
  const at = (m) => new Date(now - m * 60000).toISOString();
  const r = await fetch(`${base}/ingest/log`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-ingest-token': token },
    body: JSON.stringify({ events: [
      { kind: 'room_join', displayName: 'Alice', userId: 'usr_a', worldName: 'Test World', at: at(30) },
      { kind: 'room_join', displayName: 'Bob', worldName: 'Test World', at: at(20) },
      { kind: 'room_join', displayName: 'Alice', userId: 'usr_a', worldName: 'Test World 2', at: at(5) },
    ] }),
  });
  const ing = await r.json();
  console.log('ingest  ', r.status, JSON.stringify(ing));

  const status = await (await fetch(`${base}/api/status`)).json();
  console.log('status  ', JSON.stringify(status));

  const players = await (await fetch(`${base}/api/players`)).json();
  console.log('players ', JSON.stringify(players));

  const stats = await (await fetch(`${base}/api/stats`)).json();
  console.log('stats   ', JSON.stringify(stats).slice(0, 200));

  const sessions = await (await fetch(`${base}/api/sessions`)).json();
  const mine = await (await fetch(`${base}/api/my-sessions`)).json();
  console.log('sessions', sessions.returned, 'my', mine.returned);
  console.log('events  ', (await (await fetch(`${base}/api/events`)).json()).returned);

  const health = await (await fetch(`${base}/api/health`)).json();
  console.log('health  ', JSON.stringify(health));
  const healthOk = health.ok === true
    && health.db && ['postgres', 'sqlite'].includes(health.db.kind)
    && health.collector && typeof health.collector.connected === 'boolean'
    && typeof health.collector.msgCount === 'number';

  const pass = status.dialect && players.players.length === 2 && ing.inserted === 3 && healthOk;
  console.log(pass ? 'SMOKE OK' : 'SMOKE FAIL');
  exitCode = pass ? 0 : 1;
} catch (e) {
  console.error('SMOKE ERROR', e.message);
} finally {
  srv.kill('SIGTERM');
  if (useSqlite) { try { fs.rmSync(file); } catch {} }
  process.exit(exitCode);
}
