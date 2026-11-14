/**
 * 冒烟：不碰 VRChat，直接往库里灌样例数据再读接口。
 *   node scripts/smoke.mjs            # 用 SQLite 临时库
 *   VRC_DB_URL=postgres://... node scripts/smoke.mjs   # 打真库（会写测试行！）
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const useSqlite = !process.env.VRC_DB_URL || process.env.VRC_DB_URL.startsWith('sqlite');
const file = path.join(os.tmpdir(), `vrc-smoke-${Date.now()}.db`);
const url = useSqlite ? `sqlite:${file}` : process.env.VRC_DB_URL;
const port = 8799;
const token = 'smoke-token';

const srv = spawn(process.execPath, ['src/index.js'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: { ...process.env, VRC_DB_URL: url, PORT: String(port), VRC_INGEST_TOKEN: token },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
srv.stdout.on('data', (d) => { log += d; });
srv.stderr.on('data', (d) => { log += d; });

const base = `http://127.0.0.1:${port}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let exitCode = 1;

try {
  for (let i = 0; i < 50; i++) {
    await wait(200);
    if (log.includes('[api]')) break;
  }
  if (!log.includes('[api]')) throw new Error(`api 未启动:\n${log}`);

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
