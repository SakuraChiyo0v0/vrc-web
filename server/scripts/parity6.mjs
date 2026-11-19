/**
 * 第六轮视觉/交互/信息架构对齐检查（docs/vrcx0-parity.md 61~75）。
 *   node server/scripts/parity6.mjs            # 读构建产物 + 源码 + 临时 SQLite 服务，退出码 0 为全绿
 *
 * 前端项（61~65、71w~75w 等）断言构建产物：先 `cd web && npm run build`。
 * 接口项（73~75）起临时 SQLite 服务，种子数据不碰线上。
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
  const f = fs.readdirSync(distDir).find((x) => x.endsWith(ext));
  if (!f) throw new Error(`web/dist/assets 里没有 ${ext}`);
  return fs.readFileSync(path.join(distDir, f), 'utf8');
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
const cssBlocks = (css, sel) => {
  const out = [];
  let i = css.indexOf(sel + '{');
  while (i >= 0) {
    out.push(css.slice(i, css.indexOf('}', i)));
    i = css.indexOf(sel + '{', i + 1);
  }
  must(out.length, `构建产物里没有 ${sel}`);
  return out;
};
// 取第一条规则（特定选择器只在自定义层出现）
const cssBlock = (css, sel) => cssBlocks(css, sel)[0];

/* ───────── 临时服务（只读种子，不碰线上 PG / VRChat） ───────── */
const file = path.join(os.tmpdir(), `vrc-parity6-${Date.now()}.db`);
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
  env: { ...process.env, VRC_DB_URL: dbUrl, PORT: String(port), VRC_INGEST_TOKEN: 'parity6-token', VRC_ALERT_EMIT: '' },
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

const HOUR = 3600_000;
const now = Date.now();
const at = (ms) => new Date(ms).toISOString();

let exitCode = 1;
try {
  // 1) 等服务起来
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (exited) break;
    try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; } } catch {}
    await wait(200);
  }
  must(ready, `服务未起来（${exited ?? 'timeout 30s'}）：${log.slice(0, 400)}`);

  // 2) 种子：好友 / 事件 / 变更 / 状态 / 标签 / 会话 / 游戏日志
  const db = await openDb(dbUrl);
  const ins = (sql, p) => db.query(sql, p);
  await ins(`insert into world (id, name, author_name, capacity) values (?,?,?,?)`, ['wrld_a', 'Alpha Club', 'Creator A', 32]);
  await ins(`insert into world (id, name, author_name, capacity) values (?,?,?,?)`, ['wrld_b', 'Beta Lounge', 'Creator B', 16]);
  await ins(`insert into friend (user_id, display_name, trust_level, trust_rank, platform, status, status_description, location, world_id, world_name, icon_url, is_favorite, updated_at)
             values (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ['usr_alice', 'Alice', 'system_trust_trusted', 4, 'pc', 'active', 'working', 'wrld_a:1~region(jp)', 'wrld_a', 'Alpha Club', 'av_1', 1, at(now - 60_000)]);
  await ins(`insert into friend (user_id, display_name, trust_level, trust_rank, platform, status, location, icon_url, is_favorite, updated_at)
             values (?,?,?,?,?,?,?,?,?,?)`,
    ['usr_bob', 'Bob', 'system_trust_new_user', 1, 'android', 'offline', 'offline', 'av_2', 0, at(now - HOUR)]);
  await ins(`insert into friend (user_id, display_name, trust_level, trust_rank, status, is_favorite, updated_at)
             values (?,?,?,?,?,?,?)`, ['usr_carol', 'Carol', 'system_trust_known', 3, 'offline', 0, at(now - 3 * HOUR)]);

  await ins(`insert into friend_tag (id, user_id, tag, created_at) values (?,?,?,?)`, ['tag_1', 'usr_alice', '老友', at(now - 5 * HOUR)]);
  await ins(`insert into friend_note (user_id, note, updated_at) values (?,?,?)`, ['usr_alice', '一起玩很久了', at(now)]);
  await ins(`insert into notification (id, type, sender_user_id, message, link, created_at, seen) values (?,?,?,?,?,?,?)`,
    ['nt_1', 'invite', 'usr_alice', 'Alice 邀请你去 Alpha Club', null, at(now - 30 * 60_000), 0]);

  const evs = [
    ['usr_alice', 'Alice', 'online', 'wrld_a:1~region(jp)', 'wrld_a', 'Alpha Club', now - 4 * HOUR],
    ['usr_alice', 'Alice', 'location', 'wrld_b:2~region(us)', 'wrld_b', 'Beta Lounge', now - 3 * HOUR],
    ['usr_alice', 'Alice', 'offline', 'offline', null, null, now - 2 * HOUR],
    ['usr_bob', 'Bob', 'online', 'wrld_b:3~region(us)', 'wrld_b', 'Beta Lounge', now - 90 * 60_000],
  ];
  for (const [uid, name, kind, loc, wid, wname, ms] of evs) {
    await ins(`insert into friend_event (user_id, display_name, kind, location, world_id, world_name, at)
               values (?,?,?,?,?,?,?)`, [uid, name, kind, loc, wid, wname, at(ms)]);
  }
  await ins(`insert into friend_change (user_id, field, old_value, new_value, at) values (?,?,?,?,?)`,    ['usr_alice', 'display_name', 'Alice', 'Alice2', at(now - 5 * HOUR)]);
  await ins(`insert into friend_status_history (user_id, status, description, at) values (?,?,?,?)`,
    ['usr_alice', 'active', 'gaming', at(now - 30 * 60_000)]);

  await ins(`insert into friend_session (id, user_id, started_at, ended_at, minutes, location, world_id, world_name, status)
             values (?,?,?,?,?,?,?,?,?)`,
    ['sess_1', 'usr_bob', at(now - 6 * HOUR), at(now - 5 * HOUR), 60, 'wrld_b:2', 'wrld_b', 'Beta Lounge', 'offline']);

  await ins(`insert into game_event (kind, display_name, user_id, location, world_name, detail, at) values (?,?,?,?,?,?,?)`,
    ['join', '我', 'usr_me', 'wrld_a:1~region(jp)', 'Alpha Club',
      JSON.stringify({ world_id: 'wrld_a', world_name: 'Alpha Club', players: ['Alice', 'Bob'] }), at(now - 2 * HOUR)]);
  await ins(`insert into game_event (kind, display_name, user_id, location, world_name, detail, at) values (?,?,?,?,?,?,?)`,
    ['leave', '我', 'usr_me', 'wrld_a:1~region(jp)', 'Alpha Club', JSON.stringify({ world_id: 'wrld_a' }), at(now - HOUR)]);
  await ins(`insert into game_event (kind, display_name, user_id, location, world_name, detail, at) values (?,?,?,?,?,?,?)`,
    ['join', '我', 'usr_me', 'wrld_b:9~region(us)', 'Beta Lounge', JSON.stringify({ world_id: 'wrld_b' }), at(now - 30 * 60_000)]);
  await db.close();

  const css = asset('.css');
  const js = asset('.js');

  // —— 61 好友页单列 32px 行 ——
  await check(61, '好友页 单列 32px 行', async () => {
    const b = cssBlock(css, '.friend-row');
    must(/height:\s*32px/.test(b), `.friend-row 行高不是 32px：${b.slice(0, 120)}`);
    must(/border:\s*1px solid transparent/.test(b), '.friend-row 不该常态描边（只在 hover）');
    must(js.includes('friend-row'), '构建产物没有 friend-row 类');
    const src = read('web/src/pages/FriendsPage.jsx');
    // 只断好友列表块：今日摘要之类的小卡片用 grid 不算「3 列卡片网格」
    must(!/grid-cols-[23]/.test(src), '好友页仍在用 grid-cols-2/3 卡片网格');
    must(/friend-row/.test(src), '好友页没接 friend-row');
    // 每行四段信息：昵称 / 状态签名 / 世界·访问级别 / 在线时长（+区域徽标）
    for (const seg of ['display_name', 'status_description', 'world_name', 'access_label', 'dur(']) {
      must(src.includes(seg), `好友行缺「${seg}」段`);
    }
    // 手机 640 以下只剩昵称，640/1024 以上逐列展开（构建产物里是 min-width 数值断点）
    must(/@media\s*\(min-width:\s*640px\)/.test(css), '缺少 640px 断点');
    must(/@media\s*\(min-width:\s*1024px\)/.test(css), '缺少 1024px 断点');
    return '行高 32px ≤34，无 grid-cols-2/3，四段信息齐全';
  });

  // —— 62 表头去后台味 ——
  await check(62, '表头 12px 无 uppercase / 同面背景', async () => {
    const b = cssBlock(css, '.tbl thead th');
    must(!/text-transform:\s*uppercase/.test(b), '表头仍有 uppercase');
    must(/font-size:\s*12px/.test(b), `表头字号不是 12px：${b}`);
    must(/letter-spacing:\s*0/.test(b), '表头仍有 letter-spacing');
    must(/background:\s*var\(--surface-panel\)/.test(b), '表头背景不是 surface-panel');
    return 'font-size:12px / letter-spacing:0 / background:surface-panel';
  });

  // —— 63 字号阶梯 14/12/11 + tabular-nums ——
  await check(63, '字号三档 + body tabular-nums', async () => {
    const bodies = cssBlocks(css, 'body');
    must(bodies.some((b) => /font-variant-numeric:\s*tabular-nums/.test(b)), 'body 没有 tabular-nums');
    for (const bad of ['text-[9px]', 'text-[10px]', 'text-[10.5px]', 'text-[11.5px]', 'text-[12.5px]']) {
      must(!js.includes(bad), `构建产物仍有 ${bad}`);
    }
    const files = fs.readdirSync(path.join(ROOT, 'web/src/pages')).map((f) => ['web/src/pages/' + f, f]);
    files.push(['web/src/App.jsx', 'App'], ['web/src/components/Sidebar.jsx', 'Sidebar'], ['web/src/components/FriendDrawer.jsx', 'FriendDrawer']);
    const badSrc = files.filter(([p]) => /text-\[(9|9\.5|10|10\.5|11\.5|12\.5|13|15)px\]/.test(read(p))).map(([, n]) => n);
    must(!badSrc.length, `源码仍有非三档字号：${badSrc.join(',')}`);
    const lbl = cssBlock(css, '.label-xs');
    must(/font-size:\s*11px/.test(lbl) && !/uppercase/.test(lbl), '.label-xs 未收敛到 11px/无 uppercase');
    return 'body 12px + tabular-nums，标签 11px，无 9/10.5/11.5px 混用';
  });

  // —— 64 状态点与平台徽章 ——
  await check(64, '状态点 10px + 平台徽章品牌色', async () => {
    for (const [k, v] of [['--status-active', '#f4e05e'], ['--status-offline', '#737f8d'], ['--platform-pc', '#0078d4'], ['--platform-quest', '#3ddc84']]) {
      must(new RegExp(`${k}:\\s*${v}`).test(css), `缺 token ${k}: ${v}`);
    }
    must(/width:\s*10px/.test(cssBlock(css, '.dot')), '.dot 不是 10px');
    for (const p of ['pc', 'quest']) {
      // 压缩后 CSS 的属性选择器可能去掉引号或改单引号
      const hit = [`.plat[data-p=${p}]`, `.plat[data-p='${p}']`, `.plat[data-p="${p}"]`].some((sel) => css.includes(sel));
      must(hit, `缺平台徽章样式 ${p}`);
    }
    must(js.includes('plat'), '构建产物没有平台徽章');
    return 'active #f4e05e / offline #737f8d / PC #0078d4 / Quest #3ddc84，点 10px';
  });

  // —— 65 workspace 描边层 ——
  await check(65, 'workspace 1px 描边 + 顶部内高光', async () => {
    const b = cssBlock(css, '.workspace');
    must(/inset 0 1px 0/.test(b), '缺顶部内高光');
    must(/0 0 0 1px/.test(b), '缺 1px ring');
    must(/border-radius:\s*12px/.test(b), 'workspace 圆角不是 12px');
    must(js.includes('workspace'), '主内容没接 workspace 类');
    return 'inset 0 1px 0 高光 + 0 0 0 1px ring，圆角 12px';
  });

  // —— 72w 侧栏五分组 + 新页面接线 ——
  await check('72w', '侧栏重分组 + 三张新页面接线', async () => {
    const src = read('web/src/components/Sidebar.jsx');
    for (const g of ['实况', '社交', '分析', '档案', '系统']) must(src.includes(`title: '${g}'`), `侧栏缺分组「${g}」`);
    must(!src.includes("title: '历史'"), '侧栏仍有「历史」大杂烩分组');
    for (const id of ['friendlist', 'friendlog', 'gamelog']) must(src.includes(`id: '${id}'`), `侧栏缺条目 ${id}`);
    for (const token of ['好友列表', '好友历史', '游戏日志', 'friend-log', 'game-log', 'friend-list']) {
      must(js.includes(token), `构建产物缺「${token}」`);
    }
    return '实况/社交/分析/档案/系统，三页已接路由与侧栏';
  });

  // —— 66w 用户悬浮卡（500ms 延迟） ——
  await check('66w', '头像悬停 500ms 出迷你卡', async () => {
    const card = read('web/src/components/UserHoverCard.jsx');
    must(/HOVER_DELAY_MS = 500/.test(card), '延迟不是 500ms');
    must(/setTimeout\(/.test(card) && /clearTimeout/.test(card), '没有延迟/移开取消');
    must(/onMouseEnter/.test(card) && /onMouseLeave/.test(card), '缺 hover 进/出');
    must(/pointer-events-none/.test(card), '迷你卡应不挡鼠标（否则移开不消失）');
    for (const p of ['FriendsPage', 'FeedPage', 'PlayersPage']) {
      must(/UserHoverCard/.test(read(`web/src/pages/${p}.jsx`)), `${p} 没接悬浮卡`);
    }
    must(js.includes('data-hovercard') || js.includes('hovercard'), '构建产物没打进去');
    return '好友/动态/玩家页头像悬停 500ms 出卡，移开消失';
  });

  // —— 71w 抽屉 Tab 化：四个 tab + 数量 + 懒加载 ——
  await check('71w', '好友抽屉 4 tab + 数量 + 懒加载', async () => {
    const src = read('web/src/components/FriendDrawer.jsx');
    for (const [key, label] of [['overview', '概览'], ['trips', '足迹'], ['data', '数据'], ['notes', '备注']]) {
      must(src.includes(`['${key}', '${label}']`), `抽屉缺 tab「${label}」`);
    }
    must(/data-tab=/.test(src) && /role="tab"/.test(src), 'tab 没留 role/data-tab（不好验证）');
    must(/counts\[key\]/.test(src) && /data\?\.counts\?\.events/.test(src), 'tab 徽标没接接口 counts');
    must(/seen\.has\('trips'\)/.test(src) && /setSeen/.test(src), '面板没有懒加载（一次全挂）');
    must(/hidden=\{tab !== 'notes'\}/.test(src), '面板切换不是隐藏而是重挂');

    const a = await get('/api/friend/usr_alice');
    must(a.status === 200, `HTTP ${a.status}`);
    must(a.json.counts && a.json.counts.events === 3 && a.json.counts.worlds === 2 && a.json.counts.tags === 1,
      `alice counts=${JSON.stringify(a.json.counts)}`);
    const b2 = await get('/api/friend/usr_bob');
    must(b2.json.counts?.sessions === 1, `bob sessions=${b2.json.counts?.sessions}`);
    return '概览/行程/常去/备注 + 数量（events=3 worlds=2 tags=1），首次点开才挂载';
  });

  // —— 67w 动态/通知人名可点 ——
  await check('67w', '动态行与通知发件人名可点开抽屉', async () => {
    const feed = read('web/src/pages/FeedPage.jsx');
    must(/onClick=\{\(\) => \(e\.user_id \? openFriend\(e\.user_id\)/.test(feed), '动态页人名没接 openFriend');
    must(/UserHoverCard id=\{e\.user_id\}/.test(feed), '动态页人名没接悬浮卡');
    const notif = read('web/src/pages/NotificationsPage.jsx');
    must(/openFriend/.test(notif) && /sender_user_id/.test(notif), '通知页发件人不可点');
    must(/data-sender=/.test(notif), '发件人按钮没留 data-sender（不好验证）');
    const r = await get('/api/notifications?unread=1');
    must(r.status === 200, `HTTP ${r.status}`);
    const n = r.json.notifications?.[0];
    must(n && n.sender_user_id === 'usr_alice', `sender_user_id=${n?.sender_user_id}`);
    must(n.sender_name === 'Alice', `sender_name=${n?.sender_name}`);
    return '动态行 openFriend + 通知发件人 Alice（sender_name 取自 friend 表）';
  });

  // —— 68w 快捷键：Ctrl/⌘+数字跳页 + ? 表 ——
  await check('68w', '快捷键：⌘/Ctrl+数字跳页 + ? 快捷键表', async () => {
    const app = read('web/src/App.jsx');
    must(/resolveShortcut/.test(app), 'App.jsx 没接 resolveShortcut');
    // PAGE_ORDER 第九轮抽到 lib/shortcuts.js，面板只管渲染
    const help = read('web/src/components/ShortcutHelp.jsx');
    const sc = read('web/src/lib/shortcuts.js');
    must(/SHORTCUT_GROUPS|PAGE_ORDER/.test(sc) && /键盘快捷键/.test(help), 'ShortcutHelp 缺快捷键表');
    for (const t of ['键盘快捷键', 'Ctrl K']) must(js.includes(t), `构建产物缺「${t}」`);
    for (const p of ['friendlog', 'gamelog', 'insights']) must(js.includes(`"${p}"`) || js.includes(`'${p}'`), `构建产物缺页面 id ${p}`);
    return '页面最前 9 项绑定 1~9 键，? 打开表（逻辑有 node 单测）';
  });

  // —— 69w 粘贴 ID/链接直达 ——
  await check('69w', '搜索框粘贴 usr_/wrld_ 链接直达抽屉', async () => {
    const pal = read('web/src/components/CommandPalette.jsx');
    must(/parseVrcTarget/.test(pal), 'CommandPalette 没接 parseVrcTarget');
    must(/直接打开/.test(pal), '缺「直接打开」条目');
    for (const t of ['直接打开', 'wrld_']) must(js.includes(t), `构建产物缺「${t}」`);
    return 'usr_/wrld_ 裸 ID、vrchat.com/home、launch?worldId=、vrchat://、vrcx:// 均可';
  });

  // —— 70w 洞察时段柱状图 ——
  await check('70w', '洞察「最常遇到的时段」柱子用 px 高度 + 空态', async () => {
    const p = read('web/src/pages/InsightsPage.jsx');
    must(/hourBars/.test(p), 'InsightsPage 没用 hourBars()');
    must(!/height:\s*`\$\{[^}]*\}%`/.test(p), '柱子仍是百分比高度（auto 父容器里会塌成 0）');
    must(/bars\.empty/.test(p), '缺空态分支');
    must(/data-n=/.test(p) && js.includes('data-n'), '柱子没留 data-n（不好验证）');
    return 'px 高度（最矮 2px）+ 无数据空态，不再画空轴';
  });

  // —— 73 好友历史：跨好友流水 ——
  await check(73, 'friend-log 跨好友流水 + 过滤', async () => {
    const r = await get('/api/friend-log');
    must(r.status === 200, `HTTP ${r.status} ${r.text.slice(0, 120)}`);
    must(r.json.total >= 3, `total=${r.json.total}`);
    must(r.json.returned === r.json.items.length && r.json.returned <= 300, `returned=${r.json.returned}`);
    must(r.json.counts.location === 1 && r.json.counts.online === 2 && r.json.counts.offline === 1,
      `counts=${JSON.stringify(r.json.counts)}`);
    must(r.json.counts.profile === 1 && r.json.counts.status === 1, `缺 profile/status：${JSON.stringify(r.json.counts)}`);
    must(r.json.people === 2, `people=${r.json.people}`);
    const times = r.json.items.map((i) => i.at);
    must(times.join('|') === [...times].sort().reverse().join('|'), '流水不是时间倒序');
    must(r.json.items.every((i) => i.display_name && i.user_id), '有项缺人名/用户 id');

    const prof = await get('/api/friend-log?kind=profile');
    must(prof.json.returned === 1 && prof.json.items[0].src === 'change' && /display_name/.test(prof.json.items[0].text),
      `kind=profile 不对：${JSON.stringify(prof.json.items[0])}`);

    const bob = await get('/api/friend-log?user_id=usr_bob');
    must(bob.json.returned >= 1 && bob.json.items.every((i) => i.user_id === 'usr_bob'), `user_id 过滤失效：${bob.json.returned}`);

    const narrow = await get('/api/friend-log?hours=1');
    must(narrow.json.hours === 1 && narrow.json.items.every((i) => i.at >= narrow.json.since), 'hours 窗口失效');
    return `total=${r.json.total} counts=${JSON.stringify(r.json.counts)} people=2`;
  });

  // —— 74 游戏日志：自己进出实例明细 ——
  await check(74, 'game-log 进出明细 + 世界过滤', async () => {
    const all = await get('/api/game-log');
    must(all.status === 200, `HTTP ${all.status} ${all.text.slice(0, 120)}`);
    must(all.json.returned === 3 && all.json.worlds === 2, `returned=${all.json.returned} worlds=${all.json.worlds}`);
    must(all.json.items.every((i) => i.at), '有项缺 at');

    const a = await get('/api/game-log?world=wrld_a');
    must(a.json.returned === 2, `wrld_a 应 2 条，实际 ${a.json.returned}`);
    must(a.json.items.every((i) => i.world_id === 'wrld_a' && i.instance === '1~region(jp)'),
      `world/instance 解析不对：${JSON.stringify(a.json.items[0])}`);
    must(a.json.items[0].world_name === 'Alpha Club', `world_name=${a.json.items[0].world_name}`);
    must(Array.isArray(a.json.items.find((i) => i.kind === 'join').players) && a.json.items.find((i) => i.kind === 'join').players.length === 2,
      'detail.players 没解析');

    const byName = await get('/api/game-log?world=Beta');
    must(byName.json.returned === 1 && byName.json.items[0].world_id === 'wrld_b', `按世界名过滤失败 ${byName.json.returned}`);

    const leave = await get('/api/game-log?kind=leave');
    must(leave.json.returned === 1 && leave.json.items[0].kind === 'leave', `kind=leave ${leave.json.returned}`);
    return `3 条 / 2 世界；wrld_a 2 条，instance=1~region(jp)，players=2`;
  });

  // —— 75 好友列表：全量 + 筛选 ——
  await check(75, 'friend-list 全量 + 信任/标签/收藏筛选', async () => {
    const all = await get('/api/friend-list');
    must(all.status === 200, `HTTP ${all.status} ${all.text.slice(0, 120)}`);
    must(all.json.total === 3 && all.json.returned === 3, `total=${all.json.total} returned=${all.json.returned}`);
    must(all.json.online === 1, `online=${all.json.online}`);
    must(all.json.tags.includes('老友'), `tags=${JSON.stringify(all.json.tags)}`);
    const alice = all.json.friends.find((f) => f.user_id === 'usr_alice');
    must(alice && alice.favorite && alice.tags.includes('老友') && alice.note === '一起玩很久了',
      `alice 字段不全：${JSON.stringify(alice)}`);
    must(alice.last_seen && alice.last_seen >= at(now - 5 * 60_000), `在线 last_seen 应是心跳：${alice.last_seen}`);

    const tag = await get('/api/friend-list?tag=' + encodeURIComponent('老友'));
    must(tag.json.returned === 1 && tag.json.friends[0].user_id === 'usr_alice', `tag 过滤 ${tag.json.returned}`);

    const fav = await get('/api/friend-list?favorite=1');
    must(fav.json.returned === 1 && fav.json.friends[0].user_id === 'usr_alice', `favorite 过滤 ${fav.json.returned}`);

    const trust = await get('/api/friend-list?trust=system_trust_new_user');
    must(trust.json.returned === 1 && trust.json.friends[0].user_id === 'usr_bob', `trust 名过滤 ${trust.json.returned}`);
    const rank = await get('/api/friend-list?trust=4');
    must(rank.json.returned === 1 && rank.json.friends[0].user_id === 'usr_alice', `trust rank 过滤 ${rank.json.returned}`);

    const bob = all.json.friends.find((f) => f.user_id === 'usr_bob');
    must(bob.last_seen && bob.last_seen === at(now - 5 * HOUR), `离线 last_seen 应取会话结束时间：${bob.last_seen}`);

    const byName = await get('/api/friend-list?sort=name');
    must(byName.json.friends.map((f) => f.display_name).join(',') === 'Alice,Bob,Carol',
      `sort=name 顺序：${byName.json.friends.map((f) => f.display_name).join(',')}`);

    const none = await get('/api/friend-list?q=zzz');
    must(none.json.returned === 0, `q 无命中应为 0，实际 ${none.json.returned}`);
    return '3 人；标签/收藏/信任名+rank/排序/last_seen 均正确';
  });
} catch (e) {
  console.error('PARITY6 ERROR', e.message);
} finally {
  srv.kill('SIGTERM');
  try { fs.rmSync(file, { force: true }); } catch {}
}

const ok = results.filter((r) => r.ok).length;
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.id} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
const fail = results.filter((r) => !r.ok).length;
const EXPECTED = 15;
console.log(fail === 0 && results.length === EXPECTED ? `PARITY6 OK ${ok}/${results.length}` : `PARITY6 FAIL ${ok}/${results.length}`);
if (fail === 0 && results.length === EXPECTED) exitCode = 0;
process.exit(exitCode);