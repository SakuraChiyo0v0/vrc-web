/**
 * 第四轮功能对齐检查：docs/vrcx0-parity.md 第四轮 41~46，一项一条断言。
 *   node server/scripts/parity4.mjs       # 临时 SQLite 库，退出码 0 为全绿
 *
 * 只起本地 server（不碰线上 PG / 不碰 VRChat），数据全在临时 SQLite 里。
 * 带 w 后缀的是 web 端接线检查（读源码 / 读 web/dist 构建产物，先跑 npm run build）。
 */
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openDb } from '../src/db/index.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const file = path.join(os.tmpdir(), `vrc-parity4-${Date.now()}.db`);
const url = `sqlite:${file}`;

const freePort = () => new Promise((res, rej) => {
  const s = net.createServer();
  s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
});
const port = await freePort();
const base = `http://127.0.0.1:${port}`;

// 告警外发在这条验收里不需要，明确关掉，避免真的推到通知群
const srv = spawn(process.execPath, ['src/index.js'], {
  cwd: path.join(ROOT, 'server'),
  env: {
    ...process.env,
    VRC_DB_URL: url,
    PORT: String(port),
    VRC_INGEST_TOKEN: 'parity4-token',
    VRC_ALERT_EMIT: '',
    VRC_STALE_MINUTES: '30',
    VRC_IMG_CACHE: fs.mkdtempSync(path.join(os.tmpdir(), 'vrc-parity4-img-')),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
let exited = null;
srv.stdout.on('data', (d) => { log += d; });
srv.stderr.on('data', (d) => { log += d; });
srv.on('error', (e) => { log += `[spawn error] ${e.message}\n`; exited = `spawn ${e.message}`; });
srv.on('exit', (code, sig) => { exited = `exit code=${code} sig=${sig ?? ''}`; log += `[exit] ${exited}\n`; });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const req = async (p, init) => {
  const r = await fetch(base + p, init);
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text, headers: r.headers };
};
const get = (p) => req(p);
const send = (p, method, body) => req(p, {
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

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
const asset = (ext) => {
  const dir = path.join(ROOT, 'web/dist/assets');
  must(fs.existsSync(dir), 'web/dist 不存在（先跑 npm run build）');
  const files = fs.readdirSync(dir).filter((x) => x.endsWith(ext));
  if (!files.length) throw new Error(`web/dist/assets 里没有 ${ext}`);
  // 134 起页面按路由分 chunk：断言在全部产物里找，只读第一个文件会漏
  return files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
};

// —— 时间基准：按 +08:00 切日，跟服务端一致 ——
const TZ = 8 * 3600_000;
const DAY = 86400_000;
const now = Date.now();
const midnight = Math.floor((now + TZ) / DAY) * DAY - TZ;
const dayKey = (ms) => new Date(ms + TZ).toISOString().slice(0, 10);
const at = (ms) => new Date(ms).toISOString();

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
  const todayMin = Math.max(0, Math.round((now - midnight) / 60000));

  for (const [id, name, author, cap] of [
    ['wrld_a', 'Alpha Club', 'Creator A', 32],
    ['wrld_b', 'Beta Lounge', 'Creator B', 16],
    ['wrld_c', 'Gamma Galaxy', 'Creator C', null],
  ]) {
    await ins(`insert into world (id, name, author_name, capacity) values (?,?,?,?)`, [id, name, author, cap]);
  }
  await ins(`insert into friend (user_id, display_name, location, world_id, world_name, status, platform, trust_level)
             values (?,?,?,?,?,?,?,?)`,
    ['usr_alice', 'Alice', 'wrld_a:111~region(jp)', 'wrld_a', 'Alpha Club', 'active', 'standalonewindows', 'trusted']);
  await ins(`insert into friend (user_id, display_name, location, world_id, world_name)
             values (?,?,?,?,?)`, ['usr_bob', 'Bob', 'offline', null, null]);
  await ins(`insert into friend (user_id, display_name) values (?,?)`, ['usr_carol', 'Carol']);

  // 自己：wrld_a 去过两次（今天 + 3 天前），wrld_b 一次（昨天/当天更早）
  await ins(`insert into self_event (kind, location, world_id, at) values (?,?,?,?)`,
    ['location', 'wrld_a:111~region(jp)', 'wrld_a', at(midnight - 3 * DAY)]);
  await ins(`insert into self_event (kind, location, world_id, at) values (?,?,?,?)`,
    ['location', 'wrld_b:222~region(us)', 'wrld_b', at(midnight - DAY)]);
  const startToday = Math.max(midnight + 60_000, now - 75 * 60000);
  await ins(`insert into self_event (kind, location, world_id, at) values (?,?,?,?)`,
    ['location', 'wrld_a:111~region(jp)', 'wrld_a', at(startToday)]);
  await ins(`insert into self_event (kind, location, world_id, at) values (?,?,?,?)`,
    ['location', 'wrld_a:111~region(jp)', 'wrld_a', at(startToday + 30 * 60000)]);

  // 好友事件：日历计数 / 世界遇见人数
  const evs = [
    ['usr_alice', 'Alice', 'online', 'wrld_a', 'Alpha Club', midnight + 5 * 60000],
    ['usr_bob', 'Bob', 'location', 'wrld_a', 'Alpha Club', midnight + 10 * 60000],
    ['usr_alice', 'Alice', 'offline', 'wrld_a', 'Alpha Club', midnight + 20 * 60000],
    ['usr_bob', 'Bob', 'location', 'wrld_b', 'Beta Lounge', midnight - DAY + 3600_000],
    ['usr_carol', 'Carol', 'location', 'wrld_c', 'Gamma Galaxy', midnight - 3 * DAY],
  ];
  for (const [uid, name, kind, wid, wname, ms] of evs) {
    await ins(`insert into friend_event (user_id, display_name, kind, world_id, world_name, at)
               values (?,?,?,?,?,?)`, [uid, name, kind, wid, wname, at(ms)]);
  }
  // 同房：今天进过 Alice / Carol 的房间
  for (const [kind, name, ms] of [
    ['room_join', 'Alice', midnight + 6 * 60000],
    ['room_join', 'Carol', midnight + 12 * 60000],
  ]) {
    await ins(`insert into game_event (kind, display_name, at) values (?,?,?)`, [kind, name, at(ms)]);
  }
  await ins(`update collector_state set connected = 1, last_msg_at = ?, msg_count = 7 where id = 1`,
    [at(now - 60000)]);
  await db.close();

  // —— 41 世界库：列表 / 排序 / 搜索 / 分页 ——
  await check(41, '世界库 /api/worlds', async () => {
    const r = await get('/api/worlds');
    must(r.status === 200, `HTTP ${r.status} ${r.text.slice(0, 120)}`);
    must(r.json.total === 3, `total ${r.json.total} != 3`);
    must(r.json.worlds.map((w) => w.id).join(',') === 'wrld_a,wrld_b,wrld_c',
      `recent 排序应为 a,b,c，实际 ${r.json.worlds.map((w) => w.id).join(',')}`);
    const a = r.json.worlds.find((w) => w.id === 'wrld_a');
    must(a.visits === 3, `wrld_a visits ${a.visits} != 3`);
    must(a.friends_seen === 2, `wrld_a friends_seen ${a.friends_seen} != 2`);
    must(a.last_at && new Date(a.last_at).getTime() === startToday + 30 * 60000,
      `wrld_a last_at 应取最近一次自己到访 ${at(startToday + 30 * 60000)}，实际 ${a.last_at}`);
    must(a.capacity === 32 && a.thumbnail === null, 'wrld_a 容量/缩略图字段不对');

    const v = await get('/api/worlds?sort=visits');
    must(v.json.worlds.map((w) => w.id).join(',') === 'wrld_a,wrld_b,wrld_c',
      `visits 排序应为 a(2),b(1),c(0)，实际 ${v.json.worlds.map((w) => `${w.id}:${w.visits}`).join(',')}`);
    must(v.json.sort === 'visits', `sort 回显 ${v.json.sort}`);

    const q = await get('/api/worlds?q=beta');
    must(q.json.total === 1 && q.json.worlds[0].id === 'wrld_b', `q=beta 命中 ${q.json.total}`);
    const qa = await get('/api/worlds?q=CREATOR%20C');
    must(qa.json.total === 1 && qa.json.worlds[0].id === 'wrld_c', '按作者搜索大小写不敏感失败');

    const p1 = await get('/api/worlds?limit=2&offset=0');
    must(p1.json.returned === 2 && p1.json.has_more === true, `首页 returned=${p1.json.returned} has_more=${p1.json.has_more}`);
    const p2 = await get('/api/worlds?limit=2&offset=2');
    must(p2.json.returned === 1 && p2.json.has_more === false, `次页 returned=${p2.json.returned} has_more=${p2.json.has_more}`);
    const bad = await get('/api/worlds?sort=nope&limit=9999');
    must(bad.status === 200 && bad.json.sort === 'recent' && bad.json.limit === 200, '非法 sort/limit 没有回落到默认值');

    // c 只在好友事件里出现过：不该被 visits 影响，但要有名字和 friends_seen
    const c = v.json.worlds.find((w) => w.id === 'wrld_c');
    must(c.name === 'Gamma Galaxy' && c.visits === 0 && c.friends_seen === 1,
      `wrld_c ${c.name}/${c.visits}/${c.friends_seen}`);
    return `total=3 recent=a,b,c visits=a3/b1/c0 命中 q=beta 1 条 作者搜索大小写不敏感 分页 2+1 非法参数回落`;
  });

  // —— 42 备注 + 标签（只写本地库） ——
  await check(42, '备注/标签 CRUD', async () => {
    const empty = await get('/api/friend/usr_alice/note');
    must(empty.status === 200 && empty.json.note === null, `初始备注应为 null，实际 ${JSON.stringify(empty.json.note)}`);

    const put = await send('/api/friend/usr_alice/note', 'PUT', { note: '  一起看过演唱会  ' });
    must(put.status === 200 && put.json.note === '一起看过演唱会', `PUT note 返回 ${JSON.stringify(put.json)}`);
    const read = await get('/api/friend/usr_alice/note');
    must(read.json.note === '一起看过演唱会' && read.json.updated_at, '写进去读不出来');

    const long = await send('/api/friend/usr_alice/note', 'PUT', { note: 'x'.repeat(3000) });
    must(long.json.note.length === 2000, `note 没截到 2000 字，实际 ${long.json.note.length}`);
    const badBody = await send('/api/friend/usr_alice/note', 'PUT', { note: 123 });
    must(badBody.status === 400, `note 非字符串应 400，实际 ${badBody.status}`);

    const t1 = await send('/api/friend/usr_alice/tag', 'POST', { tag: '常一起', action: 'add' });
    must(t1.status === 200 && t1.json.tags.join(',') === '常一起', `加标签返回 ${JSON.stringify(t1.json)}`);
    const t2 = await send('/api/friend/usr_alice/tag', 'POST', { tag: '常一起', action: 'add' });
    must(t2.json.tags.length === 1, `重复加同一标签应去重，实际 ${JSON.stringify(t2.json.tags)}`);
    await send('/api/friend/usr_alice/tag', 'POST', { tag: '深夜', action: 'add' });
    const tags = await get('/api/friend/usr_alice/tags');
    must(tags.json.tags.length === 2 && tags.json.detail.every((d) => d.created_at), '标签列表/时间戳不对');

    const rm = await send('/api/friend/usr_alice/tag', 'POST', { tag: '常一起', action: 'remove' });
    must(rm.json.tags.join(',') === '深夜', `删标签后应剩「深夜」，实际 ${JSON.stringify(rm.json.tags)}`);
    const noTag = await send('/api/friend/usr_alice/tag', 'POST', { tag: '   ' });
    must(noTag.status === 400, `空 tag 应 400，实际 ${noTag.status}`);

    // 备注清空 = 删除
    const del = await send('/api/friend/usr_alice/note', 'PUT', { note: ' ' });
    must(del.json.deleted === true && del.json.note === null, `清空备注应有 deleted=true，实际 ${JSON.stringify(del.json)}`);
    const after = await get('/api/friend/usr_alice/note');
    must(after.json.note === null, '清空后备注还在');

    // 再写一条给 45 备份用
    await send('/api/friend/usr_alice/note', 'PUT', { note: '备份用备注' });
    const bobTags = await get('/api/friend/usr_bob/tags');
    must(bobTags.json.tags.length === 0, 'Bob 不该有标签，说明按 user_id 串了');
    return 'PUT/GET note（trim、2000 字截断、400 非字符串、清空即删），tag 增/去重/删/空 400，按 user_id 隔离';
  });

  // —— 43 日历：按天聚合 ——
  await check(43, '事件日历 /api/calendar', async () => {
    const month = dayKey(midnight).slice(0, 7);
    const expect = new Map();
    for (const [, , , , , ms] of evs) {
      if (dayKey(ms).slice(0, 7) !== month) continue;
      expect.set(dayKey(ms), (expect.get(dayKey(ms)) ?? 0) + 1);
    }
    const r = await get(`/api/calendar?month=${month}`);
    must(r.status === 200, `HTTP ${r.status}`);

    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    must(r.json.month === month, `month 回显 ${r.json.month}`);
    must(r.json.daysInMonth === daysInMonth, `daysInMonth ${r.json.daysInMonth} != ${daysInMonth}`);
    must(r.json.first_weekday === new Date(Date.UTC(y, m - 1, 1)).getUTCDay(),
      `first_weekday ${r.json.first_weekday}`);
    must(r.json.days.length === daysInMonth, `days 长度 ${r.json.days.length} != ${daysInMonth}`);

    const byDate = new Map(r.json.days.map((d) => [d.date, d.n]));
    for (const [date, n] of expect) {
      must(byDate.get(date) === n, `${date} 应为 ${n}，实际 ${byDate.get(date)}`);
    }
    const total = [...byDate.values()].reduce((a, b) => a + b, 0);
    must(r.json.total === total, `total ${r.json.total} != ${total}`);
    must(r.json.max === Math.max(1, ...byDate.values()), `max ${r.json.max} 不对`);

    const empty = await get('/api/calendar?month=1999-12');
    must(empty.status === 200 && empty.json.days.length === 31 && empty.json.total === 0, '空月份应 31 天 0 条');

    for (const bad of ['2026-13', '2026-1', 'nope', '2026-00']) {
      const b = await get(`/api/calendar?month=${bad}`);
      must(b.status === 400, `${bad} 应 400，实际 ${b.status}`);
    }
    return `${month}: ${daysInMonth} 天、first_weekday=${r.json.first_weekday}、total=${r.json.total}、max=${r.json.max}，每天计数与种子一致；非法月份 400`;
  });

  // —— 44 今日摘要 ——
  await check(44, '今日摘要 /api/summary/today', async () => {
    const r = await get('/api/summary/today');
    must(r.status === 200, `HTTP ${r.status}`);
    const mins = Math.round((startToday + 30 * 60000 - startToday) / 60000);
    must(r.json.date === dayKey(now), `date ${r.json.date} != ${dayKey(now)}`);
    must(r.json.onlineMinutes >= mins && r.json.onlineMinutes <= mins + 360,
      `onlineMinutes ${r.json.onlineMinutes} 不在 ${mins}~${mins + 360}`);
    must(r.json.players === 2, `players ${r.json.players} != 2`);
    must(r.json.friendsTracked === 3, `friendsTracked ${r.json.friendsTracked} != 3`);
    must(r.json.events === evs.filter((e) => e[5] >= midnight).length,
      `events ${r.json.events} != 今天 ${evs.filter((e) => e[5] >= midnight).length}`);
    // 今天第一次去的世界是 wrld_a 吗？wrld_a 3 天前就去了 → 只有今天首访的算新世界
    must(Array.isArray(r.json.newWorldList), '缺 newWorldList');
    must(r.json.newWorlds === 0, `今天没有首访世界，newWorlds 应为 0，实际 ${r.json.newWorlds}`);
    return `date=${r.json.date} onlineMinutes=${r.json.onlineMinutes} players=2 friends=3 events=${r.json.events} newWorlds=0`;
  });

  // —— 44w 首页摘要卡片 + 41w/42w/43w 页面接线 ——
  await check('41w', '世界库页接线', async () => {
    const app = src('web/src/App.jsx');
    must(/worlds:\s*lazy\(\(\) => import\('\.\/pages\/WorldsPage\.jsx'\)\)/.test(app), 'App 没注册世界库页');
    must(/worlds: \['世界库'/.test(app), '世界库页没有标题');
    must(/id: 'worlds'/.test(src('web/src/components/Sidebar.jsx')), '侧栏没有世界库入口');
    const page = src('web/src/pages/WorldsPage.jsx');
    // 查询串由 filterQs 拼（q/sort/dir/fav/min_visits/capacity），不再写死 q=
    must(/api\(`worlds\?\$\{filterQs\(/.test(page) && /`q=\$\{encodeURIComponent\(q\)\}/.test(page), 'WorldsPage 没调 /api/worlds');
    // 排序参数由 sort.key/dir 拼（支持表头升降序），不再固定单值
    must(/sort=\$\{sort\.(key|dir)\}/.test(page) && /offset=\$\{offset\}/.test(page), 'WorldsPage 没传 sort/offset');
    // 第十轮起表头排序走统一 SortCol（col="visits"），不再手写单值按钮
    must(/data-active=\{sort === 'visits'\}/.test(page) || /col="visits"/.test(page), '没有「访问次数」排序按钮');
    must(/openWorld\(w\.id\)/.test(page), '世界行没接详情抽屉');
    const js = asset('.js');
    must(/worlds\?\$\{/.test(js) && /min_visits=/.test(js), '构建产物里没有 worlds? 查询串');
    return 'App/侧栏注册世界库，页面传 q+sort+offset、有访问次数按钮、行可点开详情，已在构建产物里';
  });

  await check('42w', '备注标签接线', async () => {
    const d = src('web/src/components/FriendDrawer.jsx');
    must(/friend\/\$\{enc\}\/note/.test(d), '好友抽屉没接 note 接口');
    must(/friend\/\$\{enc\}\/tag/.test(d) && /friend\/\$\{enc\}\/tags/.test(d), '好友抽屉没接 tag/tags 接口');
    must(/send\(`friend\/\$\{enc\}\/note`, 'PUT'/.test(d), '备注没走 PUT');
    must(/只存本地/.test(d), '备注没有「只存本地」的说明');
    const api = src('web/src/api.js');
    must(/export (async )?function send|export const send/.test(api), 'api.js 没有 send()');
    return '好友抽屉：备注 PUT + 标签增删 + 标签列表，文案标明只存本地';
  });

  await check('43w', '日历页接线', async () => {
    const app = src('web/src/App.jsx');
    must(/calendar:\s*lazy\(\(\) => import\('\.\/pages\/CalendarPage\.jsx'\)\)/.test(app), 'App 没注册日历页');
    must(/id: 'calendar'/.test(src('web/src/components/Sidebar.jsx')), '侧栏没有日历入口');
    const page = src('web/src/pages/CalendarPage.jsx');
    must(/api\(`calendar\?month=\$\{month\}`\)/.test(page), 'CalendarPage 没调 /api/calendar');
    must(/api\(`events\?since=/.test(page), '点某天没去拉当天事件');
    must(/shiftMonth/.test(page), '没有翻月');
    return 'App/侧栏注册日历，按月取计数、点天拉 events、可翻月';
  });

  await check('44w', '首页摘要卡片', async () => {
    const p = src('web/src/pages/FriendsPage.jsx');
    must(/api\('summary\/today'\)/.test(p), '首页没调 /api/summary/today');
    must(/TodaySummary/.test(p) && /<TodaySummary \/>/.test(p), '首页没渲染摘要卡片');
    for (const k of ['onlineMinutes', 'players', 'newWorlds']) {
      must(new RegExp(k).test(p), `摘要卡片没展示 ${k}`);
    }
    must(/refetchInterval/.test(p), '摘要卡片没有轮询刷新');
    return '首页渲染今日在线/遇到的人/新世界三张卡，60 秒刷新';
  });

  // —— 45 全量备份 ——
  await check(45, '备份 /api/export/backup.json', async () => {
    const r = await get('/api/export/backup.json');
    must(r.status === 200, `HTTP ${r.status}`);
    const keys = Object.keys(r.json).sort();
    must(keys.join(',') === 'events,favorites,friends,notes,tags,worlds', `备份键 ${keys.join(',')}`);
    must(r.json.friends.length === 3 && r.json.worlds.length === 3, `friends/worlds ${r.json.friends.length}/${r.json.worlds.length}`);
    must(r.json.events.length === evs.length, `events ${r.json.events.length} != ${evs.length}`);
    must(r.json.notes.length === 1 && r.json.notes[0].note === '备份用备注', '备注没进备份');
    must(r.json.tags.length === 1 && r.json.tags[0].tag === '深夜', '标签没进备份');
    must(/^attachment; filename="vrc-backup-\d{4}-\d{2}-\d{2}\.json"$/.test(r.headers.get('content-disposition') ?? ''),
      `content-disposition ${r.headers.get('content-disposition')}`);
    must(r.json.events.every((e) => /^\d{4}-\d{2}-\d{2}T/.test(String(e.at))), '事件时间不是 ISO');
    const s = src('web/src/pages/SettingsPage.jsx');
    must(/api\/export\/backup\.json/.test(s) && /download/.test(s), '设置页没有导出按钮');
    return `6 键 ${keys.join('/')}，friends=3 worlds=3 events=${r.json.events.length} notes=1 tags=1，附件名含日期，设置页有下载入口`;
  });

  // —— 46 断连告警 ——
  await check(46, '断连告警 + 恢复', async () => {
    const older = at(now - 45 * 60000);
    const db2 = await openDb(url);
    const upd = (sql, p) => db2.query(sql, p);
    try {
      await upd(`update collector_state set last_msg_at = ? where id = 1`, [older]);

    const d1 = await get('/api/diagnostics');
    must(d1.json.stale?.isStale === true, `45 分钟没消息应 isStale=true，实际 ${JSON.stringify(d1.json.stale)}`);
    must(d1.json.stale.thresholdMinutes === 30, `阈值 ${d1.json.stale.thresholdMinutes} != 30`);
    must(d1.json.stale.idleMinutes >= 44, `idleMinutes ${d1.json.stale.idleMinutes}`);
    must(d1.json.stale.recorded === true, '首次判 stale 应写入告警');
    must(d1.json.stale.emitted === false, 'VRC_ALERT_EMIT 为空时不该外发');

    const a1 = await get('/api/alerts');
    must(a1.json.returned === 1, `告警应有 1 条，实际 ${a1.json.returned}`);
    const alert = a1.json.alerts[0];
    must(alert.level === 'P1' && alert.fingerprint === 'vrc-collector-stale:disconnected', `告警字段 ${JSON.stringify(alert)}`);
    must(alert.resolved === false && alert.resolved_at === null, '告警不该是已恢复');
    must(/断连 4[0-9] 分钟/.test(alert.message), `告警正文 ${alert.message}`);

    // 再读一次诊断：去重窗口内不重复落库
    const d2 = await get('/api/diagnostics');
    must(d2.json.stale.recorded === false, '同一 fingerprint 重复落库了');
    const a2 = await get('/api/alerts');
    must(a2.json.returned === 1, `去重失败，现在 ${a2.json.returned} 条`);

    // 恢复：标记 resolved，不新增
      await upd(`update collector_state set last_msg_at = ? where id = 1`, [at(now - 30000)]);
    const d3 = await get('/api/diagnostics');
    must(d3.json.stale.isStale === false, `恢复后仍 isStale=true`);
    const a3 = await get('/api/alerts');
    must(a3.json.returned === 1, `恢复不该新增告警，现在 ${a3.json.returned} 条`);
    must(a3.json.alerts[0].resolved === true && a3.json.alerts[0].resolved_at, '恢复后没标 resolved');

    const s = src('web/src/pages/SettingsPage.jsx');
    must(/stale\.isStale/.test(s), '设置页没展示断连状态');
    must(/告警记录/.test(s), '设置页没展示告警次数');
    const lib = src('server/src/lib/alerts.js');
    must(/insert into/.test(lib) && /VRC_ALERT_EMIT/.test(lib), 'alerts.js 没落库或没接外发');
    return `45 分钟 → isStale/recorded=true、1 条 P1 resolved=false；再读诊断 recorded=false 仍 1 条；恢复后 resolved=true 且不新增`;
    } finally {
      await db2.close();
    }
  });

  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  #${String(r.id).padEnd(3)} ${r.name.padEnd(22)} ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length
    ? `\nPARITY4 FAIL ${failed.length}/${results.length}: #${failed.map((f) => f.id).join(' #')}`
    : `\nPARITY4 OK ${results.length}/${results.length}`);
  exitCode = failed.length ? 1 : 0;
} catch (e) {
  console.error('PARITY4 ERROR', e.message);
} finally {
  srv.kill('SIGTERM');
  try { fs.rmSync(file); } catch {}
  try { fs.rmSync(`${file}-wal`); } catch {}
  try { fs.rmSync(`${file}-shm`); } catch {}
  process.exit(exitCode);
}
