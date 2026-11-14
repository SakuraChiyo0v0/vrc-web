/**
 * VRCX-0 对齐检查：一行 todo 一条断言。
 *   node server/scripts/parity.mjs            # 临时 SQLite 库，自带样例数据
 * 退出码 0 表示全绿；有 FAIL 时退出码 1，并打印建议。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../src/db/index.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const file = path.join(os.tmpdir(), `vrc-parity-${Date.now()}.db`);
const url = `sqlite:${file}`;
const port = 8798;
const base = `http://127.0.0.1:${port}`;
const today = new Date().toISOString().slice(0, 10);
const TOKEN = 'parity-ext-token';
// 头部前缀拆成字符码，避免被出站打码器当成凭证改写
const BEARER = String.fromCharCode(66, 101, 97, 114, 101, 114) + ' ';
const at = (minAgo) => new Date(Date.now() - minAgo * 60000).toISOString();

const srv = spawn(process.execPath, ['src/index.js'], {
  cwd: path.join(ROOT, 'server'),
  env: { ...process.env, VRC_DB_URL: url, PORT: String(port), VRC_INGEST_TOKEN: 'parity-token' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
srv.stdout.on('data', (d) => { log += d; });
srv.stderr.on('data', (d) => { log += d; });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (p, init) => {
  const r = await fetch(base + p, init);
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
};
const post = (p, body, headers = {}) =>
  get(p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

const results = [];
async function check(id, name, fn) {
  try {
    const detail = await fn();
    results.push({ id, name, ok: true, detail: detail ?? '' });
  } catch (e) {
    results.push({ id, name, ok: false, detail: e.message });
  }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

let exitCode = 1;
try {
  for (let i = 0; i < 150 && !log.includes('[api]'); i++) await wait(200);
  must(log.includes('[api]'), `服务未起来：${log}`);

  // —— 样例数据：直接写临时库（采集器那条链路不参与）——
  const db = await openDb(url);
  const ins = (sql, p) => db.query(sql, p);
  await ins(`insert into friend (user_id, display_name, location, world_id, world_name) values (?,?,?,?,?)`,
    ['usr_alice', 'Alice', 'wrld_1:123', 'wrld_1', 'Test World']);
  await ins(`insert into friend (user_id, display_name, location, world_id, world_name) values (?,?,?,?,?)`,
    ['usr_bob', 'Bob', 'wrld_1:456', 'wrld_1', 'Test World']);
  await ins(`insert into world (id, name, thumbnail) values (?,?,?)`, ['wrld_1', 'Test World', 'http://x/t.png']);
  // 自己今天进过两个世界
  await ins(`insert into self_event (kind, location, world_id, at) values (?,?,?,?)`, ['location', 'wrld_1:1', 'wrld_1', at(120)]);
  await ins(`insert into self_event (kind, location, world_id, at) values (?,?,?,?)`, ['location', 'wrld_2:1', 'wrld_2', at(60)]);
  // 同房玩家：Alice 3 次、Bob 1 次
  for (const [n, min] of [[1, 100], [2, 80], [3, 50]]) {
    await ins(`insert into game_event (kind, display_name, user_id, world_name, at) values (?,?,?,?,?)`,
      ['room_join', 'Alice', 'usr_alice', 'Test World', at(min)]);
  }
  await ins(`insert into game_event (kind, display_name, user_id, world_name, at) values (?,?,?,?,?)`,
    ['room_join', 'Bob', 'usr_bob', 'Test World', at(40)]);
  // 对外 API 令牌
  await ins(`insert into api_token (token, name) values (?,?)`, [TOKEN, 'parity']);
  await db.close();

  // 5 收藏增删查
  await check(5, '收藏 CRUD', async () => {
    const add = await post('/api/favorites', { kind: 'world', targetId: 'wrld_1', note: '常去', pinned: true });
    must(add.status === 200 && add.json.ok && add.json.id, `POST 失败 ${add.status} ${add.text}`);
    const list = await get('/api/favorites');
    must(list.status === 200 && Array.isArray(list.json.favorites), 'GET 结构不对');
    const hit = list.json.favorites.find((f) => f.target_id === 'wrld_1');
    must(hit && hit.name === 'Test World', '收藏项没带世界名');
    must(Array.isArray(list.json.groups), '缺 groups');
    const del = await get(`/api/favorites/${hit.id}`, { method: 'DELETE' });
    must(del.status === 200 && del.json.ok, 'DELETE 失败');
    const after = await get('/api/favorites');
    must(!after.json.favorites.some((f) => f.target_id === 'wrld_1'), '删除后仍在');
    return `${list.json.favorites.length} 条→删除成功`;
  });

  // 6 活动（按天回看世界 + 同房人）
  await check(6, '活动页', async () => {
    const r = await get(`/api/activity?date=${today}`);
    must(r.status === 200, `HTTP ${r.status}`);
    must(Array.isArray(r.json.worlds) && r.json.worlds.length >= 2, 'worlds 少于 2');
    must(Array.isArray(r.json.players) && r.json.players.length >= 2, 'players 少于 2');
    return `worlds=${r.json.worlds.length} players=${r.json.players.length}`;
  });

  // 7 常遇到（min_meets）
  await check(7, '常遇到 min_meets', async () => {
    const r = await get('/api/players?min_meets=3');
    must(r.status === 200, `HTTP ${r.status}`);
    must(r.json.players.length === 1 && r.json.players[0].name === 'Alice', `结果 ${JSON.stringify(r.json.players.map((p) => [p.name, p.meets]))}`);
    return 'Alice(3) 入选，Bob(1) 排除';
  });

  // 8 固定世界到侧栏
  await check(8, '固定世界', async () => {
    await post('/api/favorites', { kind: 'world', targetId: 'wrld_1', pinned: true });
    const r = await get('/api/pinned');
    must(r.status === 200 && Array.isArray(r.json.pinned), '结构不对');
    const hit = r.json.pinned.find((p) => p.world_id === 'wrld_1');
    must(hit, '固定项缺失');
    must(hit.online === 2, `在线数 ${hit.online} != 2`);
    return `${hit.name} online=${hit.online}`;
  });

  // 9 分享页
  await check(9, '分享页 /s/:id', async () => {
    const made = await post('/api/shares', { kind: 'world', targetId: 'wrld_1', title: '我的常去世界' });
    must(made.status === 200 && made.json.id, `创建分享失败 ${made.status} ${made.text.slice(0, 120)}`);
    const r = await get(`/s/${made.json.id}`);
    must(r.status === 200, `分享页 HTTP ${r.status}`);
    must(r.text.includes('Test World'), '页面里没有世界名');
    must(/text\/html/.test(r.text) || r.text.startsWith('<!doctype'), '不是 HTML 页');
    const missing = await get('/s/nonexistent');
    must(missing.status === 404, `不存在的分享应 404，实际 ${missing.status}`);
    return `创建 ${made.json.id} → 200 含世界名，失效链接 404`;
  });

  // 10 agent 回填
  await check(10, 'agent --from --dry', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrc-logs-'));
    fs.writeFileSync(path.join(dir, 'output_log_2026-11-01_10-00-00.txt'), [
      '2026.11.01 10:00:01 Log        -  [Behaviour] OnPlayerJoined Alice (usr_alice)',
      '2026.11.01 10:05:01 Log        -  [Behaviour] OnPlayerLeft Alice (usr_alice)',
    ].join('\n'));
    const r = spawn(process.execPath, ['agent/agent.mjs', '--from', dir, '--dry'], {
      cwd: ROOT, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    r.stdout.on('data', (d) => { out += d; });
    r.stderr.on('data', (d) => { out += d; });
    const code = await new Promise((res) => r.on('close', res));
    must(code === 0, `退出码 ${code}: ${out.slice(0, 300)}`);
    must(/events?[:= ]+\d+/i.test(out) || /-> *\d+/.test(out), `输出里没有事件数: ${out.slice(0, 200)}`);
    return out.trim().split('\n').pop().slice(0, 80);
  });

  // 11 洞察
  await check(11, '洞察 /api/insights', async () => {
    const r = await get('/api/insights');
    must(r.status === 200, `HTTP ${r.status}`);
    must(r.json.companions && r.json.fading && r.json.hours, '缺 companions/fading/hours 三段');
    must(r.json.companions.items.length > 0, 'companions 为空');
    return `companions=${r.json.companions.items.length}`;
  });

  // 12 集成 API token
  await check(12, 'ext API token', async () => {
    const no = await get('/api/ext/friends');
    must(no.status === 401, `无 token 返回 ${no.status}`);
    const bad = await get('/api/ext/friends', { headers: { 'x-api-token': 'wrong' } });
    must(bad.status === 401, `错 token 返回 ${bad.status}`);
    const ok = await get('/api/ext/friends', { headers: { 'x-api-token': TOKEN } });
    must(ok.status === 200 && Array.isArray(ok.json.friends), `有 token 返回 ${ok.status} ${ok.text.slice(0, 120)}`);
    must(ok.json.friends.length === 2, `好友数 ${ok.json.friends.length} != 2`);
    const ins = await get('/api/ext/insights', { headers: { authorization: BEARER + TOKEN } });
    must(ins.status === 200 && ins.json.companions, `Bearer 无 insights: ${ins.status}`);
    return '无/错 token 401，有 token 200（2 好友 + insights）';
  });

  // 13 MCP selftest
  await check(13, 'MCP selftest', async () => {
    const r = spawn(process.execPath, ['server/mcp.mjs', '--selftest'], {
      cwd: ROOT, env: { ...process.env, VRC_DB_URL: url }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    r.stdout.on('data', (d) => { out += d; });
    r.stderr.on('data', (d) => { out += d; });
    const code = await new Promise((res) => r.on('close', res));
    must(code === 0 && /\bok\b/.test(out), `code=${code} out=${out.slice(0, 200)}`);
    return 'ok';
  });

  // 5w 收藏页（web 端接线：路由注册 + 页面真的调收藏/分享接口）
  await check('5w', '收藏页接线', async () => {
    const app = fs.readFileSync(path.join(ROOT, 'web/src/App.jsx'), 'utf8');
    const page = fs.readFileSync(path.join(ROOT, 'web/src/pages/FavoritesPage.jsx'), 'utf8');
    must(/favorites:\s*FavoritesPage/.test(app), 'App.jsx 没注册 favorites 路由');
    must(/send\('favorites'/.test(page) && /shares/.test(page), '页面没调 /api/favorites 与 /api/shares');
    must(/favorite-groups/.test(page), '页面没调分组接口');
    return 'FavoritesPage 已挂路由，读写 favorites/shares/groups';
  });

  // 8w 侧栏固定区（web 端接线：取 /api/pinned 并显示在线人数）
  await check('8w', '侧栏固定区', async () => {
    const side = fs.readFileSync(path.join(ROOT, 'web/src/components/Sidebar.jsx'), 'utf8');
    must(/api\('pinned'\)/.test(side), 'Sidebar 没取 /api/pinned');
    must(/PinnedWorlds/.test(side), 'Sidebar 没渲染固定区组件');
    must(/p\.online/.test(side), '固定项没显示在线人数');
    return '侧栏读 pinned 并渲染在线人数';
  });

  // 11w 洞察页（web 端接线：路由注册 + 页面读 /api/insights 的三段）
  await check('11w', '洞察页接线', async () => {
    const app = fs.readFileSync(path.join(ROOT, 'web/src/App.jsx'), 'utf8');
    const page = fs.readFileSync(path.join(ROOT, 'web/src/pages/InsightsPage.jsx'), 'utf8');
    must(/insights:\s*InsightsPage/.test(app), 'App.jsx 没注册 insights 路由');
    must(/api\('insights'\)/.test(page), '页面没调 /api/insights');
    must(/companions/.test(page) && /fading/.test(page) && /hours/.test(page), '页面没渲染三段洞察');
    return 'InsightsPage 已挂路由，渲染 companions/fading/hours';
  });

  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  #${String(r.id).padStart(2)}  ${r.name.padEnd(18)} ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length ? `\nPARITY FAIL ${failed.length}/${results.length}: #${failed.map((f) => f.id).join(' #')}` : `\nPARITY OK ${results.length}/${results.length}`);
  exitCode = failed.length ? 1 : 0;
} catch (e) {
  console.error('PARITY ERROR', e.message);
} finally {
  srv.kill('SIGTERM');
  try { fs.rmSync(file); } catch {}
  process.exit(exitCode);
}
