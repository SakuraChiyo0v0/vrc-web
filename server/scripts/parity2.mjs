/**
 * 第二轮功能对齐检查：docs/vrcx0-parity.md 第二轮 21~27，一项一条断言。
 *   node server/scripts/parity2.mjs      # 临时 SQLite 库 + 自带样例，退出码 0 为全绿
 * 索引 x 结尾的检查是 web 端接线（读源码 grep），其余打真实 HTTP。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../src/db/index.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const file = path.join(os.tmpdir(), `vrc-parity2-${Date.now()}.db`);
const url = `sqlite:${file}`;
// 端口动态取，避免上一次跑完的进程没退干净导致 bind 失败
const port = await new Promise((res, rej) => {
  const s = net.createServer();
  s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
});
const base = `http://127.0.0.1:${port}`;
const at = (minAgo) => new Date(Date.now() - minAgo * 60000).toISOString();

const srv = spawn(process.execPath, ['src/index.js'], {
  cwd: path.join(ROOT, 'server'),
  env: { ...process.env, VRC_DB_URL: url, PORT: String(port), VRC_INGEST_TOKEN: 'parity2-token' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
let exited = null;
srv.stdout.on('data', (d) => { log += d; });
srv.stderr.on('data', (d) => { log += d; });
srv.on('error', (e) => { log += `[spawn error] ${e.message}\n`; exited = `spawn ${e.message}`; });
srv.on('exit', (code, sig) => { exited = `exit code=${code} sig=${sig ?? ''}`; log += `[exit] ${exited}\n`; });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (p, init) => {
  const r = await fetch(base + p, init);
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text, headers: r.headers };
};
const post = (p, body) =>
  get(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });

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
const src = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let exitCode = 1;
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (exited) break;
    try {
      if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; }
    } catch {}
    await wait(200);
  }
  must(ready, `服务未起来（${exited ?? 'timeout 30s'}）：${log.slice(0, 400)}`);

  // —— 样例数据 ——
  const db = await openDb(url);
  const ins = (sql, p) => db.query(sql, p);
  await ins(`insert into world (id, name, author_id, author_name, capacity, thumbnail) values (?,?,?,?,?,?)`,
    ['wrld_1', 'Test World', 'usr_creator', 'Creator', 32, 'http://x/w1.png']);
  await ins(`insert into world (id, name, author_id, author_name, capacity, thumbnail) values (?,?,?,?,?,?)`,
    ['wrld_2', 'Chill Room', 'usr_creator', 'Creator', 16, 'http://x/w2.png']);
  await ins(`insert into friend (user_id, display_name, location, world_id, world_name, icon_url, status) values (?,?,?,?,?,?,?)`,
    ['usr_alice', 'Alice', 'wrld_1:123', 'wrld_1', 'Test World', 'http://x/a.png', 'active']);
  await ins(`insert into friend (user_id, display_name, location, status) values (?,?,?,?)`,
    ['usr_bob', 'Bob', 'offline', 'offline']);
  for (const [kind, min, wid] of [['online', 180, null], ['location', 120, 'wrld_1'], ['profile', 1800, null]]) {
    await ins(`insert into friend_event (user_id, display_name, kind, world_id, world_name, at) values (?,?,?,?,?,?)`,
      ['usr_alice', 'Alice', kind, wid, wid ? 'Test World' : null, at(min)]);
  }
  for (const [wid, min] of [['wrld_1', 150], ['wrld_2', 60], ['wrld_1', 10]]) {
    await ins(`insert into self_event (kind, location, world_id, at) values (?,?,?,?)`, ['location', `${wid}:1`, wid, at(min)]);
  }
  for (const [name, uid, min] of [['Alice', 'usr_alice', 100], ['Alice', 'usr_alice', 80], ['Alice', 'usr_alice', 50], ['Bob', 'usr_bob', 40]]) {
    await ins(`insert into game_event (kind, display_name, user_id, world_name, at) values (?,?,?,?,?)`,
      ['room_join', name, uid, 'Test World', at(min)]);
  }
  await ins(`insert into notification (id, type, sender_user_id, message, created_at, seen) values (?,?,?,?,?,?)`,
    ['n1', 'invite', 'usr_alice', '邀请你去 Test World', at(30), 0]);
  await ins(`insert into notification (id, type, sender_user_id, message, created_at, seen) values (?,?,?,?,?,?)`,
    ['n2', 'friendRequest', 'usr_bob', '想加你好友', at(600), 1]);
  await db.close();

  // 21 全局搜索
  await check(21, '全局搜索 /api/search', async () => {
    const a = await get('/api/search?q=alice');
    must(a.status === 200, `HTTP ${a.status}`);
    must(Array.isArray(a.json.friends) && a.json.friends.some((f) => f.display_name === 'Alice'), '搜不到好友 Alice');
    must(Array.isArray(a.json.players) && a.json.players.length > 0, '搜不到玩家');
    const w = await get('/api/search?q=test');
    must(Array.isArray(w.json.worlds) && w.json.worlds.some((x) => x.id === 'wrld_1'), '搜不到世界 Test World');
    const empty = await get('/api/search?q=');
    must(empty.status === 200 && empty.json.friends.length === 0, '空查询应当返回空结果');
    return `friends=${a.json.friends.length} players=${a.json.players.length} worlds=${w.json.worlds.length}`;
  });

  // 22 世界详情
  await check(22, '世界详情 /api/world/:id', async () => {
    const r = await get('/api/world/wrld_1');
    must(r.status === 200, `HTTP ${r.status}`);
    must(r.json.world?.name === 'Test World', '世界名不对');
    must(r.json.world.author_name === 'Creator', '缺 author');
    must(Number(r.json.world.capacity) === 32, '缺 capacity');
    must(Number(r.json.online) === 1, `在线数 ${r.json.online} != 1`);
    must(Number(r.json.visits) >= 2, `到访次数 ${r.json.visits} < 2`);
    const miss = await get('/api/world/wrld_nope');
    must(miss.status === 404, `未收录世界应 404，实际 ${miss.status}`);
    return `author=${r.json.world.author_name} cap=${r.json.world.capacity} online=${r.json.online} visits=${r.json.visits}`;
  });

  // 23 好友详情
  await check(23, '好友详情 /api/friend/:id', async () => {
    const r = await get('/api/friend/usr_alice');
    must(r.status === 200, `HTTP ${r.status}`);
    must(r.json.profile?.display_name === 'Alice', '缺 profile');
    must(Array.isArray(r.json.events) && r.json.events.length >= 3, `事件 ${r.json.events?.length} < 3`);
    must(Array.isArray(r.json.worlds) && r.json.worlds.some((w) => w.world === 'Test World'), '缺常一起出现的世界');
    const miss = await get('/api/friend/usr_nope');
    must(miss.status === 404, `不存在应 404，实际 ${miss.status}`);
    return `events=${r.json.events.length} worlds=${r.json.worlds.length}`;
  });

  // 24 时间线筛选 + 分页
  await check(24, '事件筛选 /api/events', async () => {
    const k = await get('/api/events?kind=online&limit=10');
    must(k.status === 200 && k.json.events.length >= 1, '按 kind 过滤后为空');
    must(k.json.events.every((e) => e.kind === 'online'), '存在非 online 事件');
    const since = at(90);
    const s = await get(`/api/events?since=${encodeURIComponent(since)}&limit=100`);
    must(s.json.events.every((e) => new Date(e.at) >= new Date(since)), 'since 没生效（含更早事件）');
    const one = await get('/api/events?limit=1');
    must(one.json.events.length === 1, `limit=1 返回 ${one.json.events.length}`);
    must(one.json.has_more === true, 'limit 截断时 has_more 应为 true');
    const off = await get('/api/events?limit=1&offset=1');
    must(off.json.events[0]?.id !== one.json.events[0]?.id, 'offset 没生效');
    return `kind 过滤 ${k.json.events.length} 条，since 生效，limit/offset 分页 OK`;
  });

  // 25 CSV 导出
  await check(25, 'CSV 导出 /api/export', async () => {
    const f = await get('/api/export/friends.csv');
    must(f.status === 200, `friends.csv HTTP ${f.status}`);
    must(/text\/csv/.test(f.headers.get('content-type') ?? ''), `content-type ${f.headers.get('content-type')}`);
    const head = f.text.split('\n')[0];
    must(head.includes('user_id') && head.includes('display_name'), `表头不对: ${head}`);
    must(f.text.trim().split('\n').length >= 2, '没有数据行');
    const p = await get('/api/export/players.csv');
    must(p.status === 200 && p.text.split('\n')[0].includes('meets'), 'players.csv 表头缺 meets');
    const e = await get('/api/export/events.csv');
    must(e.status === 200 && /kind/.test(e.text.split('\n')[0]), 'events.csv 表头缺 kind');
    const bad = await get('/api/export/nope.csv');
    must(bad.status === 404, `未知导出应 404，实际 ${bad.status}`);
    return `friends ${f.text.trim().split('\n').length - 1} 行 / players / events 均 200`;
  });

  // 26 统计增强：days + 24x7 热力图
  await check(26, '统计 /api/stats?days=', async () => {
    const w = await get('/api/stats?days=7');
    must(w.status === 200, `HTTP ${w.status}`);
    must(Array.isArray(w.json.hourly) && w.json.hourly.length === 7, `hourly 行数 ${w.json.hourly?.length} != 7`);
    must(w.json.hourly.every((row) => Array.isArray(row) && row.length === 24), 'hourly 每行应为 24 小时');
    must(w.json.hourly.flat().reduce((a, b) => a + b, 0) > 0, '热力图全是 0');
    must(Number(w.json.days) === 7, 'days 没回显');
    const m = await get('/api/stats?days=30');
    must(m.json.hourly.length === 30, `days=30 行数 ${m.json.hourly.length}`);
    const d = await get('/api/stats');
    must(d.json.hourly.length === 7, `默认应为 7 天，实际 ${d.json.hourly.length}`);
    return `7d/30d 矩阵 OK，默认 7d`;
  });

  // 27 通知管理
  await check(27, '通知 已读/过滤', async () => {
    const un = await get('/api/notifications?unread=1');
    must(un.status === 200, `HTTP ${un.status}`);
    must(un.json.notifications.length === 1 && un.json.notifications[0].id === 'n1', '未读过滤不对');
    must(un.json.unread_count === 1, `unread_count ${un.json.unread_count} != 1`);
    const ty = await get('/api/notifications?type=invite');
    must(ty.json.notifications.length === 1 && ty.json.notifications[0].type === 'invite', '类型过滤不对');
    const one = await post('/api/notifications/read', { ids: ['n1'] });
    must(one.status === 200 && one.json.ok && Number(one.json.updated) === 1, `单条已读失败 ${one.text.slice(0, 120)}`);
    const after = await get('/api/notifications?unread=1');
    must(after.json.notifications.length === 0, '标记后仍有未读');
    const all = await post('/api/notifications/read', { all: true });
    must(all.status === 200 && all.json.ok, '全部已读失败');
    return `unread=1 过滤生效，单条/全部已读 OK`;
  });

  // —— web 端接线 ——
  await check('21w', '搜索面板接线', async () => {
    const app = src('web/src/App.jsx');
    must(/CommandPalette/.test(app), 'App 没挂 CommandPalette');
    must(/metaKey|ctrlKey/.test(app + src('web/src/components/CommandPalette.jsx')), '没有 ⌘K/Ctrl+K 快捷键');
    const pal = src('web/src/components/CommandPalette.jsx');
    must(/api\((`|')search\?q=/.test(pal), '面板没调 /api/search');
    must(/ArrowDown|ArrowUp/.test(pal), '面板不支持键盘上下选择');
    return '⌘K 面板 + /api/search + 键盘选择';
  });

  await check('22w', '世界详情接线', async () => {
    const d = src('web/src/components/WorldDrawer.jsx');
    must(/api\(`world\//.test(d) || /world\/\$\{/.test(d), '抽屉没调 /api/world/:id');
    must(/capacity/.test(d) && /online/.test(d) && /visits/.test(d), '抽屉没显示容量/在线/到访');
    must(/openWorld/.test(src('web/src/components/drawers.jsx')), '没有 openWorld 入口');
    return 'WorldDrawer 读 world/:id 并显示 capacity/online/visits';
  });

  await check('23w', '好友详情接线', async () => {
    const d = src('web/src/components/FriendDrawer.jsx');
    must(/friend\/\$\{/.test(d), '抽屉没调 /api/friend/:id');
    must(/events/.test(d) && /worlds/.test(d), '抽屉没渲染 events/worlds');
    must(/openFriend/.test(src('web/src/pages/FriendsPage.jsx')), '好友页点不进抽屉');
    return 'FriendDrawer 读 friend/:id，好友页可点开';
  });

  await check('24w', '动态页筛选', async () => {
    const f = src('web/src/pages/FeedPage.jsx');
    must(/kind=/.test(f), '页面没拼 kind 参数');
    must(/since/.test(f), '页面没拼 since 参数');
    must(/offset/.test(f), '页面没有 offset 分页');
    must(/加载更多|onScroll/.test(f), '没有滚动/加载更多');
    return 'kind + since + offset 分页';
  });

  await check('25w', '导出按钮', async () => {
    const f = src('web/src/pages/FriendsPage.jsx');
    // 现在导出走前端生成 CSV（跟着当前 tab/搜索/排序），不再直链 /api/export/friends.csv
    must(/export\/friends\.csv/.test(f) || /downloadCsv|toCsv/.test(f), '好友页没有导出能力');
    // 第十轮起玩家页同样改成前端生成 CSV（跟随当前排序/筛选），不再直链 /api/export
    const pl = src('web/src/pages/PlayersPage.jsx');
    must(/export\//.test(pl) || (/downloadCsv|toCsv/.test(pl) && /data-export="players"/.test(pl)), '玩家页没有导出按钮');
    must(/export\/events\.csv/.test(src('web/src/pages/FeedPage.jsx')), '动态页没有导出链接');
    return '好友/玩家/动态三页各带导出';
  });

  await check('26w', '统计页切换+热力图', async () => {
    const s = src('web/src/pages/StatsPage.jsx');
    must(/days=/.test(s), '没请求 days 参数');
    must(/热力|heat/i.test(s), '没渲染热力图');
    must(/setDays/.test(s), '没有 7/30 天切换');
    return 'days 切换 + 热力图';
  });

  await check('27w', '通知页已读交互', async () => {
    const n = src('web/src/pages/NotificationsPage.jsx');
    must(/unread=\$\{unread \? 1 : 0\}|unread=1/.test(n), '没做未读过滤');
    must(/notifications\/read/.test(n), '没调已读接口');
    must(/type=/.test(n), '没有类型过滤');
    return '未读/类型过滤 + 标记已读';
  });

  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  #${String(r.id).padStart(3)}  ${r.name.padEnd(20)} ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length
    ? `\nPARITY2 FAIL ${failed.length}/${results.length}: #${failed.map((f) => f.id).join(' #')}`
    : `\nPARITY2 OK ${results.length}/${results.length}`);
  exitCode = failed.length ? 1 : 0;
} catch (e) {
  console.error('PARITY2 ERROR', e.message);
} finally {
  srv.kill('SIGTERM');
  try { fs.rmSync(file); } catch {}
  process.exit(exitCode);
}
