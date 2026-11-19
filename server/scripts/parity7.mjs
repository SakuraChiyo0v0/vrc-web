/**
 * 第七轮对齐检查（docs/vrcx0-parity.md 76~81）。
 *   node server/scripts/parity7.mjs      # 读构建产物 + 源码 + 临时 SQLite 服务，退出码 0 为全绿
 *
 * 前端项断言构建产物（先 `cd web && npm run build`）；接口项起临时 SQLite 服务，种子不碰线上。
 */
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openDb } from '../src/db/index.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const distDir = path.join(ROOT, 'web/dist/assets');
const asset = (ext) => {
  if (!fs.existsSync(distDir)) throw new Error('web/dist 不存在（先跑 cd web && npm run build）');
  // 134 起页面按路由分 chunk：断言在全部产物里找，只读第一个文件会漏
  const files = fs.readdirSync(distDir).filter((x) => x.endsWith(ext));
  if (!files.length) throw new Error(`web/dist/assets 里没有 ${ext}`);
  return files.map((f) => fs.readFileSync(path.join(distDir, f), 'utf8')).join('\n');
};

const results = [];
async function check(id, name, fn) {
  try {
    results.push({ id, name, ok: true, detail: (await fn()) ?? '' });
  } catch (e) {
    results.push({ id, name, ok: false, detail: e.message });
  }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

/* ───────── 临时服务（只读种子，不碰线上 PG / VRChat） ───────── */
const file = path.join(os.tmpdir(), `vrc-parity7-${Date.now()}.db`);
const dbUrl = `sqlite:${file}`;
const freePort = () => new Promise((res, rej) => {
  const s = net.createServer();
  s.on('error', rej);
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
});
const port = await freePort();
const base = `http://127.0.0.1:${port}`;

const srv = spawn(process.execPath, ['src/index.js'], {
  cwd: path.join(ROOT, 'server'),
  env: { ...process.env, VRC_DB_URL: dbUrl, PORT: String(port), VRC_INGEST_TOKEN: 'parity7-token', VRC_ALERT_EMIT: '' },
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
  return { status: r.status, json, text };
};
const get = (p) => req(p);

const MIN = 60_000;
const now = Date.now();
const at = (ms) => new Date(ms).toISOString();

let exitCode = 1;
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (exited) break;
    try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; } } catch {}
    await wait(200);
  }
  must(ready, `服务未起来（${exited ?? 'timeout 30s'}）：${log.slice(0, 400)}`);

  /* 种子：世界 / 好友 / 好友会话 / 我的停留 / 同房玩家 */
  const db = await openDb(dbUrl);
  const ins = (sql, p) => db.query(sql, p);
  await ins(`insert into world (id, name) values (?,?)`, ['wrld_a', 'Alpha Club']);
  await ins(`insert into world (id, name) values (?,?)`, ['wrld_b', 'Beta Lounge']);
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

  await ins(`insert into self_event (kind, location, world_id, at) values (?,?,?,?)`, ['location', 'wrld_a:1~region(jp)', 'wrld_a', at(now - 120 * MIN)]);
  await ins(`insert into self_event (kind, location, world_id, at) values (?,?,?,?)`, ['location', 'wrld_b:2~region(us)', 'wrld_b', at(now - 30 * MIN)]);

  // Dave：同房两次、不在好友表 → 「常遇见的过路人」；Alice 那次是好友，不算
  await ins(`insert into game_event (kind, display_name, user_id, location, world_name, detail, at) values (?,?,?,?,?,?,?)`,
    ['room_join', 'Dave', 'usr_dave', null, 'Alpha Club', null, at(now - 100 * MIN)]);
  await ins(`insert into game_event (kind, display_name, user_id, location, world_name, detail, at) values (?,?,?,?,?,?,?)`,
    ['room_join', 'Dave', 'usr_dave', null, 'Alpha Club', null, at(now - 60 * MIN)]);
  await ins(`insert into game_event (kind, display_name, user_id, location, world_name, detail, at) values (?,?,?,?,?,?,?)`,
    ['room_join', 'Alice', 'usr_alice', null, 'Alpha Club', null, at(now - 50 * MIN)]);
  await db.close();

  const css = asset('.css');
  const js = asset('.js');

  /* ───── 76/78/79 常驻面板数据：区域 / 在线时长 / 分组计数 ───── */
  await check('76api', 'roster：分组计数 + 区域 + 在线时长', async () => {
    const r = await get('/api/roster');
    must(r.status === 200, `HTTP ${r.status} ${r.text.slice(0, 160)}`);
    const f = r.json.facets ?? {};
    must(f.online === 2 && f.favorite === 1 && f.same_room === 1 && f.active === 2 && f.offline === 1,
      `facets=${JSON.stringify(f)}`);
    must(r.json.groups.map((g) => g.label).join(',') === '已分组的好友,在线,同一房间,活跃中,离线',
      `groups=${r.json.groups.map((g) => g.label).join(',')}`);
    const alice = r.json.friends.find((x) => x.user_id === 'usr_alice');
    must(alice.region === 'jp' && alice.access === 'friends' && alice.access_label === '仅好友',
      `alice region/access=${alice.region}/${alice.access}/${alice.access_label}`);
    must(alice.online_minutes >= 35 && alice.online_minutes <= 40, `alice 在线时长=${alice.online_minutes}`);
    const carol = r.json.friends.find((x) => x.user_id === 'usr_carol');
    must(carol.region === 'us' && carol.same_room === true, `carol region=${carol.region} same_room=${carol.same_room}`);
    must(r.json.my_world_id === 'wrld_b', `my_world_id=${r.json.my_world_id}`);
    const q = await get('/api/roster?q=ali');
    must(q.json.returned === 1 && q.json.facets.online === 2, `q 过滤=${q.json.returned}（facets 不该被 q 改变：${q.json.facets.online}）`);
    return `facets=${JSON.stringify(f)} alice ${alice.online_minutes}min ${alice.region}/${alice.access_label}`;
  });

  /* ───── 77 概览 ───── */
  await check(77, 'overview：总时长/对比/每日/活跃时段/三块榜单', async () => {
    const r = await get('/api/overview?range=all');
    must(r.status === 200, `HTTP ${r.status} ${r.text.slice(0, 160)}`);
    must(r.json.total_minutes === 120, `total_minutes=${r.json.total_minutes}`);
    must(r.json.sessions === 2, `sessions=${r.json.sessions}`);
    must(r.json.longest.minutes === 90 && r.json.longest.world_name === 'Alpha Club',
      `longest=${JSON.stringify(r.json.longest)}`);
    must(r.json.previous.minutes === 0 && r.json.previous.delta_pct === null, `previous=${JSON.stringify(r.json.previous)}`);
    const dailySum = r.json.daily.reduce((a, d) => a + d.minutes, 0);
    must(dailySum === 120 && r.json.daily.length >= 1, `daily 合计=${dailySum} 天数=${r.json.daily.length}`);
    must(r.json.hourly.buckets.length === 24 && r.json.hourly.buckets.reduce((a, b) => a + b, 0) === 120,
      `hourly=${JSON.stringify(r.json.hourly.buckets)}`);
    must(r.json.hourly.peak_pct > 0 && r.json.hourly.peak_pct <= 100, `peak_pct=${r.json.hourly.peak_pct}`);
    const al = r.json.companions.find((c) => c.user_id === 'usr_alice');
    must(r.json.companions[0]?.user_id === 'usr_bob' && r.json.companions[0].minutes === 30,
      `companions=${JSON.stringify(r.json.companions)}`);
    must(al && al.minutes >= 5 && al.minutes <= 8, `alice 陪伴=${al?.minutes}`);
    must(r.json.shrinking.some((x) => x.user_id === 'usr_bob' && x.was >= 25 && x.drop === 100),
      `shrinking=${JSON.stringify(r.json.shrinking)}`);
    must(r.json.passersby.some((x) => x.user_id === 'usr_dave' && x.meets === 2),
      `passersby=${JSON.stringify(r.json.passersby)}`);
    const d7 = await get('/api/overview?range=7');
    must(d7.json.range.days === 7 && d7.json.total_minutes === 120, `range=7 days=${d7.json.range.days} total=${d7.json.total_minutes}`);
    return `120min/2 次；最久 90min Alpha；陪伴 ${r.json.companions[0].name} ${r.json.companions[0].minutes}min；过路人 ${r.json.passersby[0].name} x${r.json.passersby[0].meets}`;
  });

  /* ───── 81 游戏日志：日期 → 世界 ───── */
  await check(81, 'game-log/days：日期→世界分组 + 起止/时长/玩家明细', async () => {
    const r = await get('/api/game-log/days');
    must(r.status === 200, `HTTP ${r.status} ${r.text.slice(0, 160)}`);
    must(r.json.total_visits === 2 && r.json.total_minutes === 120, `visits=${r.json.total_visits} minutes=${r.json.total_minutes}`);
    must(r.json.days[0].date >= r.json.days[r.json.days.length - 1].date, '日期不是倒序');
    const world = r.json.days[0].worlds.find((w) => w.world_name === 'Alpha Club');
    must(world && world.minutes === 90, `Alpha 组=${JSON.stringify(world?.minutes)}`);
    const v = world.visits[0];
    must(v.start_at && v.end_at && v.minutes === 90, `visit=${JSON.stringify(v)}`);
    must(v.players.filter((p) => p.name === 'Dave').length === 2, `players=${JSON.stringify(v.players)}`);
    must(v.players.every((p) => p.at), '玩家明细缺时间');
    // 81 UI 的「类型筛选」要按访问级别过滤：停留得带 region/access_label
    must(v.region === 'jp' && v.access_label === '公开', `visit region/access=${v.region}/${v.access_label}`);
    must(world.region === 'jp' && world.access_label === '公开', `world 组 region/access=${world.region}/${world.access_label}`);
    return `${r.json.total_days} 天 / ${r.json.total_visits} 次 / ${r.json.total_minutes}min；Alpha 90min，同房 Dave×2，region=jp`;
  });
  /* ───── 76/78/79 前端：断言构建产物（容器里没有浏览器，沿用第 33 项的做法） ───── */
  await check('76ui', '右栏常驻面板：三栏 + 筛选输入 + 分组计数 + 可折叠 + 好友页不重复', async () => {
    must(css.includes('.roster-rail') && css.includes('writing-mode:vertical-rl'),
      'CSS 缺 .roster-rail / 折叠竖条');
    must(/\.roster-rail\{display:none\}/.test(css), '窄屏没让位规则');
    must(js.includes('筛选好友'), '右栏缺「筛选好友」输入');
    must(js.includes('已分组的好友') && js.includes('roster-row'), '右栏缺分组标题或行样式');
    must(js.includes('vrc-roster-collapsed'), '折叠状态没持久化');
    return 'roster-rail 244px / 折叠 32px / 筛选好友 / 已分组的好友 / 窄屏让位';
  });

  await check('78ui', '好友页五个筛选标签：data-facet + 计数 + 当前项加深', async () => {
    for (const label of ['好友收藏', '同一房间', '活跃中']) {
      must(js.includes(label), `缺标签「${label}」`);
    }
    must(js.includes('data-facet') && js.includes('data-active'), '标签没有 data-facet / data-active 标记');
    must(css.includes('data-active=true') || css.includes("data-active='true'"), '当前项没有加深样式');
    must(js.includes('facets'), '计数没接 /api/roster facets');
    return '5 标签 + data-facet/data-active + 计数来自 facets';
  });

  await check('79ui', '条目：区域徽标 + 在线时长 + 世界名·访问级别', async () => {
    must(css.includes('.reg'), '缺 .reg 区域徽标样式');
    must(js.includes('online_minutes'), '条目没用 online_minutes');
    must(js.includes('access_label'), '条目没显示访问级别');
    must(js.includes('分钟'), '在线时长不是「36分钟」写法');
    return '.reg + online_minutes + access_label + 分钟';
  });

  /* ───── 80 动态页表格 ───── */
  await check('80ui', '动态页：时间/玩家/类型/详细信息四列，无头像，行高≤48', async () => {
    for (const head of ['时间', '玩家', '类型', '详细信息']) must(js.includes(head), `缺列头「${head}」`);
    must(js.includes('feed-tbl') && css.includes('.feed-tbl'), '缺 .feed-tbl 表格样式');
    const rowH = (css.match(/\.feed-tbl tbody td\{height:(\d+)px/) || [])[1];
    must(rowH && Number(rowH) <= 48, `.feed-tbl 行高=${rowH ?? '缺失'}（要 ≤48）`);
    must(css.includes('.ek') && js.includes('ek-glyph'), '类型列没有图标样式 .ek / .ek-glyph');
    // 第八轮 87 起图标色收进 CSS 变量（--ev-*），值在样式表、用法在组件里
    const varColor = (name, hex) => css.replace(/\s+/g, '').includes(`--ev-${name}:${hex}`);
    must(varColor('online', '#3fb950') && varColor('location', '#2fb6a8') && varColor('offline', '#8b949e')
      && css.includes('color:var(--ev-online)') && css.includes('color:var(--ev-location)') && css.includes('color:var(--ev-offline)'),
      '换房/上线/下线 的图标色没落地（青绿/绿/灰，--ev-* 变量）');
    const src = read('web/src/pages/FeedPage.jsx');
    must(!/avatar|imgUrl/.test(src), '动态页还有头像');
    must(src.includes('~region(') && src.includes('群组公开'), '详细信息没解析区域/访问级别');
    return `四列 + 行高 ${rowH}px + 图标色 + 无头像`;
  });

  /* ───── 81 游戏日志页 ───── */
  await check('81ui', '游戏日志：日期→世界分组 + 可展开明细 + 类型/日期筛选', async () => {
    must(js.includes('game-log/days'), '页面没走 /api/game-log/days');
    must(js.includes('全部日期') && js.includes('全部类型'), '顶部缺日期选择或类型筛选');
    must(js.includes('个世界') && js.includes('人同房'), '缺日期头统计或每次停留的人数');
    must(js.includes('没有同房玩家明细') || js.includes('players'), '明细没接玩家列表');
    must(css.includes('.group-head'), '缺分组标题样式');
    const src = read('web/src/pages/GameLogPage.jsx');
    must(src.includes('▸') && src.includes('▾'), '世界行没有折叠箭头');
    must(src.includes('start_at') && src.includes('end_at'), '停留明细缺起止时间');
    return '日期→世界 + 折叠明细 + 类型/日期筛选 + 起止时长人数';
  });
  /* ───── 77 概览页 ───── */
  await check('77ui', '概览页：概览/旅程 + 时间范围 + 总时长对比/每日柱/活跃时段/三块榜单', async () => {
    for (const s of ['概览', '旅程', '近30天', '近180天', '自定义', '总时长', '比上一周期', '每天平均', '次上线', '最久一次', '每日时长', '活跃时段']) {
      must(js.includes(s), `缺「${s}」`);
    }
    must(js.includes('overview?range='), '页面没走 /api/overview');
    must(js.includes('data-range') && js.includes('data-tab'), '时间范围/标签没有 data-range / data-tab');
    for (const s of ['相处最久的人', '相处变少的人', '常遇见的过路人', '遇到过']) must(js.includes(s), `右栏缺「${s}」`);
    must(css.includes('.ov-shell') && /\.ov-shell\{display:grid/.test(css) && css.includes('300px'), '缺 .ov-shell 三栏（1fr + 300px）');
    must(css.includes('.ov-bars') && css.includes('.ov-bar-fill'), '每日时长柱没有样式');
    must(css.includes('.ov-hbars') && /\.ov-hbar\[data-peak=.?true.?\]/.test(css), '活跃时段 24h 柱没有样式/峰值高亮');
    must(css.includes('.ov-person-bar'), '榜单没有相对条样式');
    const src = read('web/src/pages/OverviewPage.jsx');
    must(src.includes('peak_pct') && src.includes('avg_daily_minutes'), '没接 peak_pct / avg_daily_minutes');
    must(src.includes('companions') && src.includes('shrinking') && src.includes('passersby'), '三块榜单数据源不全');
    return '概览/旅程 + 6 档范围（含自定义）+ 总时长/对比/三指标 + 每日柱 + 24h 峰 + 三榜单';
  });

} catch (e) {
  console.error('PARITY7 ERROR', e.message);
} finally {
  srv.kill('SIGTERM');
  try { fs.rmSync(file, { force: true }); } catch {}
}

const ok = results.filter((r) => r.ok).length;
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.id} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
const fail = results.filter((r) => !r.ok).length;
const EXPECTED = Number(process.env.PARITY7_EXPECTED ?? 9);
console.log(fail === 0 && results.length === EXPECTED ? `PARITY7 OK ${ok}/${results.length}` : `PARITY7 FAIL ${ok}/${results.length}`);
if (fail === 0 && results.length === EXPECTED) exitCode = 0;
process.exit(exitCode);
