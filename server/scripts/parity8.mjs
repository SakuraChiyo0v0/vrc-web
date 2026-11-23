/**
 * 第八轮对齐检查（docs/vrcx0-parity.md 82~91）。
 *   node server/scripts/parity8.mjs      # 读构建产物 + 源码，退出码 0 为全绿
 *
 * 前端项断言构建产物（先 `cd web && npm run build`）；接口项后续起临时 SQLite 服务。
 * 未实现的项不注册 check，结束时按 IMPLEMENTED 计数输出 PARTIAL，全部 10 项齐了才是 PARITY8 OK。
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

/* 已实现的项数：每轮补齐后改这个数（10 = 全部） */
const TOTAL_ITEMS = 10;

/* ───────── 临时 SQLite 服务（89 接口项要实测翻页；不碰线上 PG / VRChat） ───────── */
const file = path.join(os.tmpdir(), `vrc-parity8-${Date.now()}.db`);
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
  env: { ...process.env, VRC_DB_URL: dbUrl, PORT: String(port), VRC_INGEST_TOKEN: 'parity8-token', VRC_ALERT_EMIT: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
let exited = null;
srv.stdout.on('data', (d) => { log += d; });
srv.stderr.on('data', (d) => { log += d; });
srv.on('error', (e) => { log += `[spawn error] ${e.message}\n`; exited = `spawn ${e.message}`; });
srv.on('exit', (code, sig) => { exited = `exit code=${code} sig=${sig ?? ''}`; log += `[exit] ${exited}\n`; });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (p) => {
  const r = await fetch(base + p);
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
};
const HOUR = 3600_000;
const now = Date.now();
const isoAt = (ms) => new Date(ms).toISOString();

let exitCode = 1;
try {
  const css = asset('.css');
  const js = asset('.js');

  // 等服务起来 + 种子（14 条流水：12 事件 / 1 资料 / 1 状态）
  let ready = false;
  // 容器 IO 压力大时 node 冷启动可能 >30s（实测同一镜像 3.8s ~ 40s 都有），
  // 等到 90s 再判死，避免把「机器慢」误报成「接口挂了」
  const startAt = Date.now();
  for (let i = 0; i < 450; i++) {
    if (exited) break;
    try { if ((await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; } } catch {}
    await wait(200);
  }
  must(ready, `临时服务未起来（${exited ?? `timeout ${Math.round((Date.now() - startAt) / 1000)}s`}）：${log.slice(0, 400)}`);
  {
    const db = await openDb(dbUrl);
    const ins = (sql, p) => db.query(sql, p);
    await ins(`insert into friend (user_id, display_name, trust_level, trust_rank, platform, status, location, icon_url, is_favorite, updated_at)
               values (?,?,?,?,?,?,?,?,?,?)`,
      ['usr_alice', 'Alice', 'system_trust_trusted', 4, 'pc', 'active', 'wrld_a:1~region(jp)', 'av_1', 1, isoAt(now - 60_000)]);
    await ins(`insert into friend (user_id, display_name, trust_level, trust_rank, status, is_favorite, updated_at)
               values (?,?,?,?,?,?,?)`, ['usr_bob', 'Bob', 'system_trust_known', 3, 'offline', 0, isoAt(now - HOUR)]);
    const kinds = ['online', 'location', 'offline'];
    for (let i = 0; i < 12; i++) {
      const uid = i % 2 ? 'usr_bob' : 'usr_alice';
      const kind = kinds[i % 3];
      const loc = kind === 'offline' ? 'offline' : `wrld_a:${i + 1}~region(jp)`;
      await ins(`insert into friend_event (user_id, display_name, kind, location, world_id, world_name, at)
                 values (?,?,?,?,?,?,?)`,
        [uid, i % 2 ? 'Bob' : 'Alice', kind, loc, kind === 'offline' ? null : 'wrld_a', kind === 'offline' ? null : 'Alpha Club', isoAt(now - (i + 1) * 60_000)]);
    }
    await ins(`insert into friend_change (user_id, field, old_value, new_value, at) values (?,?,?,?,?)`,
      ['usr_alice', 'display_name', 'Alice', 'Alice2', isoAt(now - 20 * 60_000)]);
    await ins(`insert into friend_status_history (user_id, status, description, at) values (?,?,?,?)`,
      ['usr_bob', 'active', 'gaming', isoAt(now - 10 * 60_000)]);
    await db.close();
  }

  /* ───── 82 今日摘要：全 0 折叠成一行 ───── */
  await check(82, '今日摘要全 0 折叠成一行，不再占三张卡', async () => {
    const src = read('web/src/pages/FriendsPage.jsx');
    must(js.includes('今天还没有活动记录'), '构建产物缺「今天还没有活动记录」空态文案');
    must(js.includes('summary-empty'), '空态没用 .summary-empty');
    must(css.includes('.summary-empty'), 'CSS 缺 .summary-empty');
    must(js.includes('summary-grid'), '有数据时的三卡网格丢了');
    must(/onlineMinutes[\s\S]{0,200}newWorlds[\s\S]{0,200}=== 0|=== 0[\s\S]{0,200}=== 0/.test(src) || src.includes('blank'),
      '源码没有「三项全 0」判定');
    must(/if \(data && blank\)[\s\S]{0,160}summary-empty/.test(src), '全 0 分支没有渲染单行空态');
    return '三项全 0 → 一行提示；有数据 → summary-grid 三卡';
  });

  /* ───── 83 好友行六列 grid ───── */
  await check(83, '好友行六列 grid 对齐，长名字截断', async () => {
    const row = (css.match(/\.friend-row\{display:grid;[^}]*\}/) || [])[0];
    must(row, '构建产物里 .friend-row 不是 grid');
    const cols = (row.match(/grid-template-columns:([^;]+);/) || [])[1] ?? '';
    must(/22px/.test(cols) && /minmax\(0,1fr\)/.test(cols) && /16%/.test(cols) && /26%/.test(cols),
      `列定义不符：${cols}`);
    must(/40px/.test(cols) && /44px/.test(cols) && /72px/.test(cols), `区域/平台/时长列宽不符：${cols}`);
    for (const c of ['fr-name', 'fr-status', 'fr-world', 'fr-reg', 'fr-plat', 'fr-dur']) {
      must(js.includes(c), `行内缺 .${c}`);
    }
    must(/\.fr-name,\.fr-status,\.fr-world\{[^}]*text-overflow:ellipsis/.test(css), '长名字没截断');
    const src = read('web/src/pages/FriendsPage.jsx');
    must(!src.includes('max-w-[26%]'), '还留着旧的 26% 限宽写法');
    return cols.trim();
  });

  /* ───── 84 active / join me / ask me 语义色 ───── */
  await check(84, '状态三态语义色，与 dot 同源变量', async () => {
    const pairs = [
      ['active', '--status-active'],
      ['join me', '--status-joinme'],
      ['ask me', '--status-askme'],
      ['busy', '--status-busy'],
      ['offline', '--status-offline']
    ];
    for (const [k, v] of pairs) {
      const re = new RegExp(`\\.st\\[data-s=["']?${k}["']?\\]\\{color:var\\(${v}\\)\\}`);
      must(re.test(css), `.st[data-s=${k}] 没绑定 ${v}`);
    }
    const src = read('web/src/pages/FriendsPage.jsx');
    must(src.includes('className="fr-status st"') && src.includes('data-s='), '行内状态没挂 .st / data-s');
    const roster = read('web/src/components/RosterPanel.jsx');
    for (const v of ['--status-active', '--status-joinme', '--status-askme']) {
      must(roster.includes(v) && src.includes(v), `dot 与文字没共用 ${v}`);
    }
    return 'active 黄 / join me 蓝 / ask me 橙 / busy 红 / offline 灰，均取 --status-*';
  });

  /* ───── 85 概览页空数据不画空轴 ───── */
  await check(85, '概览页 0 数据出空态文案，不画空柱/空轴', async () => {
    const src = read('web/src/pages/OverviewPage.jsx');
    // 第九轮 98 把空态统一成 <Empty> 组件，概览空态不再直接用 .ov-empty class
    // 第九轮 98 把空态统一成 <Empty>（.empty / .empty-compact），不再直接用 .ov-empty
    must(js.includes('empty-compact') || js.includes('data-empty'), '构建产物缺空态实现');

    must(js.includes('这个范围内还没有停留时长'), '每日时长空态文案没进构建产物');
    must(js.includes('这个范围内还没有活跃时段数据'), '活跃时段空态文案没进构建产物');
    for (const fn of ['DailyBars', 'HourBars']) {
      must(new RegExp(`function ${fn}\\([^)]*\\)\\s*\\{[\\s\\S]{0,260}total === 0[\\s\\S]{0,120}(?:ov-empty|<Empty)`).test(src),
        `${fn} 没有「全 0 → 空态」早返回`);
    }
    const axis = src.indexOf('ov-haxis');
    must(axis > 0, '活跃时段的 0–21 轴不见了');
    must(src.slice(0, axis).includes('hasHourly ?'), '活跃时段没按 hasHourly 分支');
    must(/hasHourly \?[\s\S]{0,700}ov-haxis/.test(src), '无数据时仍会渲染 0–21 轴');
    return '每日柱/24h 柱均为 0 时只留一行说明，轴与峰值数字不渲染';
  });

  /* ───── 87 动态页四类图标色固定 ───── */
  await check(87, '动态类型图标四色固定，颜色收进 CSS 变量', async () => {
    const want = [
      ['online', '--ev-online'],
      ['offline', '--ev-offline'],
      ['location', '--ev-location'],
      ['profile', '--ev-profile']
    ];
    for (const [k, v] of want) {
      const re = new RegExp(`\\.ek\\[data-kind=['"]?${k}['"]?\\][^{]*\\{color:var\\(${v}\\)`);
      must(re.test(css), `.ek[data-kind=${k}] 没绑定 ${v}`);
      must(new RegExp(`${v}:\\s*#[0-9a-f]{6}`, 'i').test(css), `变量 ${v} 没定义成固定色`);
    }
    const src = read('web/src/pages/FeedPage.jsx');
    must(!/#[0-9a-f]{6}/i.test(src.slice(src.indexOf('const KIND'), src.indexOf('const KINDS'))),
      'KIND 表里还留着手写十六进制色');
    must(!/style=\{\{ color/.test(src), '行内仍写死 style={{ color }}');
    must(/data-kind=\{e\.kind\}/.test(src), '图标没挂 data-kind');
    return '上线绿 #3fb950 / 下线灰 #8b949e / 换房青 #2fb6a8 / 改资料紫 #a371f7，全部走 --ev-*';
  });

  /* ───── 88 手机端好友行两行布局 ───── */
  await check(88, '<768px 好友行改两行，无横向溢出', async () => {
    // 取自 dist：定位 @media (max-width:767px) 的花括号块
    const at = css.search(/@media\s*\(max-width:\s*767px\)/);
    must(at >= 0, '构建产物里没有 <768px 媒体查询');
    let i = css.indexOf('{', at);
    let depth = 0;
    let end = -1;
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) { end = i; break; }
    }
    must(end > at, '媒体查询块不闭合');
    const mobile = css.slice(at, end);
    const row = (mobile.match(/\.friend-row\{[^}]*\}/) || [])[0];
    must(row, '<768px 没有 .friend-row 覆盖规则');
    must(/grid-template-areas:[^;]*av name dur[^;]*av world status/.test(row),
      `没铺两行网格：${row}`);
    must(/grid-template-columns:[^;]*minmax\(0,42%\)/.test(row), '第三列没用百分比，390px 会溢出');
    must(/height:auto/.test(row), '手机端行高仍锁死 32px');
    must(/\.fr-reg[^{}]*\{display:none/.test(mobile), '区域/平台徽章没在手机端隐藏');
    const src = read('web/src/pages/FriendsPage.jsx');
    for (const c of ['fr-name', 'fr-world', 'fr-status', 'fr-dur']) must(src.includes(c), `行内缺 .${c}`);
    return '第1行 名字+时长 / 第2行 世界+状态，头像跨两行；区域与平台徽章 <768px 隐藏';
  });

  /* ───── 86 好友列表筛选联动地址栏 ───── */
  await check(86, '好友列表筛选进 URL，切换即同步列表与计数', async () => {
    const hook = read('web/src/lib/hashQuery.js');
    must(/export function useHashState/.test(hook), 'lib/hashQuery.js 没导出 useHashState');
    must(/URLSearchParams/.test(hook) && /replaceState/.test(hook), 'hash 读写没用 URLSearchParams/replaceState');
    must(!/history\.pushState|location\.hash\s*=/.test(hook), '推历史或用 hash 赋值会触发 hashchange 重挂页面');
    const src = read('web/src/pages/FriendListPage.jsx');
    must(/useHashState\(\{[^}]*trust[^}]*tag[^}]*fav/.test(src), 'FriendListPage 没把 trust/tag/fav 交给 useHashState');
    for (const k of ['q', 'trust', 'tag', 'fav', 'sort']) must(src.includes(k), `筛选 ${k} 丢了`);
    must(src.includes('data-count') && src.includes('data-reset'), '计数/清空筛选按钮不在');
    const app = read('web/src/App.jsx');
    must(/\.split\('\?'\)\[0\]/.test(app), 'App 读 hash 没剥掉 ?query，深链会掉回默认页');
    must(js.includes('#/'), '构建产物没有 hash 路由');
    return 'trust/tag/fav/sort/q ⇄ #/friendlist?…；默认值不写地址，同页不覆盖 query';
  });

  /* ───── 90 世界库缩略图紧凑网格 ───── */
  await check(90, '世界库缩略图网格：3 列，4:3 缩略图', async () => {
    must(/\.world-grid\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(css),
      '.world-grid 不是 3 列等宽');
    must(/@media\(max-width:1023px\)\{\.world-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/.test(css),
      '窄屏没有降到 2 列');
    const thumb = (css.match(/\.world-card \.thumb\{[^}]*\}/) || [])[0] ?? '';
    must(/aspect-ratio:4\s*\/\s*3/.test(thumb) && /object-fit:cover/.test(thumb), '缩略图不是 4:3 铺满（真机量测 316×237）');
    const src = read('web/src/pages/WorldsPage.jsx');
    must(src.includes('className="world-grid"') && src.includes('className="world-card"'), '页面没换成卡片网格');
    must(!src.includes('className="tbl"'), '世界库还留着宽表格');
    // 缩略图必须走代理，且 2 倍档要挂在 <source media> 上（4K 不放大发虚，1700/1920 不加带宽）
    must(/imgUrl\(w\.thumbnail,\s*512\)/.test(src), '缩略图没走图片代理 imgUrl(…,512)');
    must(/<source[^>]*media=\{`\(min-width: \$\{BIG_THUMB_MIN_W\}px\)`\}[^>]*imgUrl\(w\.thumbnail,\s*1024\)/.test(src),
      '缺 ≥2560 视口的 2 倍档 <source>（4K 缩略图会放大发虚）');
    must(/\.world-card picture\{display:block\}/.test(css), '<picture> 没设 block，img 的 100% 撑不满卡片');
    return '3 列（≤1023px 2 列）4:3 缩略图卡；圆角/列距/内边距见 docs/ref/worlds-measure.json';
  });

  /* ───── 91 收藏页三类分 tab ───── */
  await check(91, '收藏页 世界 / 好友 / 分组 三 tab，切换数据不同', async () => {
    const src = read('web/src/pages/FavoritesPage.jsx');
    must(/role="tablist"/.test(src), '没有 tablist');
    must(src.includes('data-tab={k}'), 'tab 按钮没挂 data-tab');
    for (const k of ['world', 'friend', 'group']) {
      must(src.includes("['" + k + "',"), `缺 ${k} tab`);
    }
    must(/favorites\.filter\(\(f\) => f\.kind === tab\)/.test(src), '列表没按 tab 的 kind 过滤');
    must(/className="fav-groups"/.test(src), '分组 tab 没有独立视图');
    must(/\.fav-groups\{[^}]*display:grid/.test(css), 'CSS 缺 .fav-groups 网格');
    must(js.includes('所有收藏都分了组') || js.includes('这个分组还是空的'), '分组空态文案没进产物');
    return '世界 / 好友 / 分组三 tab，各自数据源独立；分组 tab 是卡片网格';
  });


  /* ───── 89 好友历史：倒序 + 类型多选 + 游标分页 ───── */
  await check(89, '好友历史倒序流水：类型多选 + 游标翻页不重复', async () => {
    const seen = new Set();
    const all = [];
    let cursor = null;
    let pages = 0;
    do {
      const r = await get(`/api/friend-log?hours=24&limit=5${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      must(r.status === 200, `HTTP ${r.status} ${r.text.slice(0, 120)}`);
      must(r.json.total === 14, `total 应为 14，实际 ${r.json.total} counts=${JSON.stringify(r.json.counts)} people=${r.json.people}`);
      must(r.json.items.length <= 5, `单页超过 limit：${r.json.items.length}`);
      for (const i of r.json.items) {
        must(!seen.has(i.id), `翻页重复了 ${i.id}`);
        seen.add(i.id);
        all.push(i);
      }
      pages++;
      cursor = r.json.next_cursor;
      must(pages < 10, '翻页没有收敛');
    } while (cursor);

    must(all.length === 14, `翻完只有 ${all.length} 条（应 14）`);
    const times = all.map((i) => i.at);
    must(times.join('|') === [...times].sort().reverse().join('|'), '流水不是时间倒序');
    must(pages === 3, `14 条 / 每页 5 应翻 3 页，实际 ${pages}`);

    const multi = await get('/api/friend-log?hours=24&limit=100&kinds=online,location');
    must(multi.json.items.every((i) => i.kind === 'online' || i.kind === 'location'),
      `kinds 多选失效：${JSON.stringify([...new Set(multi.json.items.map((i) => i.kind))])}`);
    must(multi.json.items.length === 8, `online+location 应 8 条，实际 ${multi.json.items.length}`);
    must(multi.json.total === 8, `kinds 过滤后 total 应 8，实际 ${multi.json.total}`);
    must(multi.json.counts.offline === 4 && multi.json.counts.profile === 1,
      `counts 应保持全量：${JSON.stringify(multi.json.counts)}`);

    const src = read('web/src/pages/FriendLogPage.jsx');
    must(/useInfiniteQuery/.test(src), '页面没用 useInfiniteQuery');
    must(/kinds\.join\(','\)/.test(src) && /setKinds/.test(src), '类型多选没接 kinds');
    must(src.includes('data-kind={k}') && src.includes('aria-pressed'), '类型按钮没挂 data-kind/aria-pressed');
    must(src.includes('data-more="1"') && src.includes('fetchNextPage'), '没有「加载更多」翻页入口');
    must(/seen\.has\(i\.id\)/.test(src), '拼接多页时没按 id 去重');
    must(js.includes('加载更多') && js.includes('kind-chip'), '构建产物缺「加载更多」/kind-chip');
    must(/\.kind-chip\[data-on=['"]?1['"]?\]/.test(css), 'CSS 缺选中态 .kind-chip[data-on=1]');
    return `3 页 14 条无重复且严格倒序；kinds=online,location → 8 条，计数仍全量`;
  });

} catch (e) {
  console.error('PARITY8 ERROR', e.message);
} finally {
  srv.kill('SIGTERM');
  try { fs.rmSync(file, { force: true }); } catch {}
}

const ok = results.filter((r) => r.ok).length;
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.id} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
const fail = results.filter((r) => !r.ok).length;
if (results.length < TOTAL_ITEMS) {
  console.log(`PARITY8 PARTIAL ${ok}/${results.length}（目标 ${TOTAL_ITEMS} 项，剩 ${TOTAL_ITEMS - results.length} 项未做）`);
  if (fail === 0) exitCode = 0;
} else {
  console.log(fail === 0 ? `PARITY8 OK ${ok}/${results.length}` : `PARITY8 FAIL ${ok}/${results.length}`);
  if (fail === 0) exitCode = 0;
}
process.exit(exitCode);
