/** 临时：验证 111 的 /api/search limit + counts（跑完即删） */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const file = path.join(os.tmpdir(), `vrc-s11-${Date.now()}.db`);
const port = await new Promise((res) => {
  const s = net.createServer();
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
});
const token = 't11';
const srv = spawn(process.execPath, ['src/index.js'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: { ...process.env, VRC_DB_URL: `sqlite:${file}`, PORT: String(port), VRC_INGEST_TOKEN: token },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
srv.stdout.on('data', (d) => { log += d; });
srv.stderr.on('data', (d) => { log += d; });
const base = `http://127.0.0.1:${port}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let code = 1;
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; } } catch {}
    await wait(200);
  }
  if (!ready) throw new Error('api 未起：' + log);
  const at = (m) => new Date(Date.now() - m * 60000).toISOString();
  const ev = [];
  for (let i = 0; i < 12; i++) ev.push({ kind: 'room_join', displayName: `Player${i}`, userId: `usr_${i}`, worldName: 'T World', at: at(i + 1) });
  const r = await fetch(`${base}/ingest/log`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-ingest-token': token }, body: JSON.stringify({ events: ev }) });
  console.log('ingest', r.status, JSON.stringify(await r.json()));

  const s1 = await (await fetch(`${base}/api/search?q=Player&limit=30`)).json();
  console.log('limit30:', s1.friends.length, s1.worlds.length, s1.players.length, JSON.stringify(s1.counts));
  const s0 = await (await fetch(`${base}/api/search?q=Player`)).json();
  console.log('default:', s0.friends.length, s0.worlds.length, s0.players.length, JSON.stringify(s0.counts));
  const empty = await (await fetch(`${base}/api/search?q=`)).json();
  console.log('empty:', JSON.stringify(empty.counts), empty.total);

  const ok = s1.players.length === 12 && s1.counts.players === 12 && s0.players.length === 8
    && s0.counts.players === 12 && s1.total === 12;
  console.log(ok ? 'SEARCH11 OK' : 'SEARCH11 FAIL');
  code = ok ? 0 : 1;
} catch (e) {
  console.error('ERR', e.message);
} finally {
  srv.kill('SIGTERM');
  try { fs.rmSync(file); } catch {}
  process.exit(code);
}
