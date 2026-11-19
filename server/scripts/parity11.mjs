/**
 * 第十一轮对齐检查（docs/vrcx0-parity.md 111~118：可用性与移动体验）。
 *   node server/scripts/parity11.mjs      # 退出码 0 = 全绿
 *
 * 先 `cd web && npm run build`。断言源码 + 构建产物，其中 114/116 另跑真函数
 * （组合筛选计数、200MB 上限删最旧），不是只查字符串。
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createImgCache, DEFAULT_MAX_BYTES } from '../src/lib/imgCache.js';
import { filterWorlds } from '../src/lib/worldFilter.js';

const ROOT = new URL('../../', import.meta.url).pathname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const distDir = path.join(ROOT, 'web/dist');
const distAssets = path.join(distDir, 'assets');
function asset(ext) {
  if (!fs.existsSync(distAssets)) throw new Error('web/dist 不存在（先跑 cd web && npm run build）');
  const f = fs.readdirSync(distAssets).find((x) => x.endsWith(ext));
  if (!f) throw new Error(`web/dist/assets 里没有 ${ext}`);
  return fs.readFileSync(path.join(distAssets, f), 'utf8');
}

const results = [];
async function check(id, name, fn) {
  try {
    results.push({ id, name, ok: true, detail: (await fn()) ?? '' });
  } catch (e) {
    results.push({ id, name, ok: false, detail: e.message });
  }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

const TOTAL_ITEMS = 8;
let exitCode = 1;

try {
  const js = asset('.js');
  const css = asset('.css');

  /* ───── 111 独立搜索页三区 ───── */
  await check(111, '搜索页 friends/worlds/players 三区，命中数进 DOM', async () => {
    const page = read('web/src/pages/SearchPage.jsx');
    must(page.includes('data-zone={zone}'), 'SearchPage 缺 data-zone');
    for (const z of ['friends', 'worlds', 'players']) {
      must(new RegExp(`zone=\\{?['"]${z}['"]`).test(page) || page.includes(`'${z}'`), `缺分区 ${z}`);
    }
    must(page.includes('data-count={count'), '分区没挂命中计数');
    must(page.includes('openFriend') || page.includes('openWorld'), '点条目没接抽屉');
    must(js.includes('data-zone') || js.includes('search-zone'), '构建产物缺搜索分区标记（没 build？）');
    return '三区 data-zone + counts + 抽屉';
  });

  /* ───── 112 PWA ───── */
  await check(112, 'manifest + 图标 + sw.js 都在 dist', async () => {
    for (const f of ['manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'icon-maskable.png', 'apple-touch-icon.png']) {
      must(fs.existsSync(path.join(distDir, f)), `dist 缺 ${f}`);
    }
    const m = JSON.parse(read('web/dist/manifest.webmanifest'));
    must(m.display === 'standalone', 'display 不是 standalone');
    must(Array.isArray(m.icons) && m.icons.length >= 3, '图标少于 3 个');
    must(m.icons.some((i) => String(i.purpose ?? '').includes('maskable')), '缺 maskable 图标');
    must(/start_url|scope/.test(JSON.stringify(m)), '缺 start_url/scope');
    const theme = m.theme_color ?? m.themeColor;
    must(theme, '缺主题色');
    const index = read('web/dist/index.html');
    must(index.includes('manifest'), 'index.html 没引 manifest');
    must(index.includes('apple-touch-icon'), 'index.html 没引 apple-touch-icon');
    return `display=${m.display}、图标 ${m.icons.length} 个、theme=${theme}`;
  });

  /* ───── 113 备份导入 ───── */
  await check(113, '备份导入只写备注/标签/收藏，32MB 体量上限', async () => {
    const lib = read('server/src/lib/restore.js');
    must(/export (async )?function restoreBackup/.test(lib) && /export function normalizeBackup/.test(lib), 'restore.js 缺导出');
    for (const t of ['friend_note', 'friend_tag', 'favorite']) must(lib.includes(t), `restore 没写 ${t}`);
    must(!/friend_event|self_event/.test(lib.split(/export (async )?function restoreBackup/)[1] ?? ''), 'restore 不应碰事件流');
    must(/on conflict do nothing/.test(lib), '缺幂等写法');
    const route = read('server/src/routes/round4.js');
    must(route.includes("app.post('/api/import/backup'"), '缺 POST /api/import/backup');
    must(route.includes('bodyLimit: 32 * 1024 * 1024'), '缺 32MB bodyLimit');
    const settings = read('web/src/pages/SettingsPage.jsx');
    must(settings.includes('data-import-input="backup"'), '设置页缺导入文件选择');
    return 'restore.js + 路由 + 设置页入口';
  });

  /* ───── 114 世界库筛选（真函数断言） ───── */
  await check(114, '收藏 / 去过次数 / 容量可组合，计数正确', async () => {
    const W = (id, visits, capacity, fav) => ({ id, name: id, author_name: null, visits, capacity, fav });
    const list = [W('a', 5, 8, true), W('b', 2, 32, false), W('c', 1, 4, true), W('d', 9, null, false), W('e', 12, 64, false)];
    must(filterWorlds(list, { fav: true }).length === 2, '收藏筛选计数错');
    must(filterWorlds(list, { minVisits: 3 }).length === 3, '去过≥3 计数错');
    must(filterWorlds(list, { capacity: 'small' }).length === 2, '容量≤8 计数错');
    const combo = filterWorlds(list, { fav: true, minVisits: 3, capacity: 'small' });
    must(combo.length === 1 && combo[0].id === 'a', `组合筛选计数错：${combo.length}`);
    must(new Set(filterWorlds(list, { capacity: 'any' })).size === 5, '容量不限不该丢行');

    const route = read('server/src/routes/round4.js');
    must(route.includes('filterWorlds('), '路由没接 filterWorlds');
    for (const p of ['fav', 'min_visits', 'capacity']) must(route.includes(p), `路由缺参数 ${p}`);
    must(route.includes('filters: { fav: favOnly'), '响应缺 filters 回显');

    const page = read('web/src/pages/WorldsPage.jsx');
    for (const f of ['fav', 'visits', 'capacity']) must(page.includes(`data-filter="${f}"`), `页面缺筛选控件 ${f}`);
    must(page.includes('min_visits='), '前端没把次数带进请求');
    must(js.includes('去过 ≥3 次') || js.includes('次数不限'), '构建产物缺筛选文案（没 build？）');
    return '组合筛选 a=1 条；控件 3 个';
  });

  /* ───── 115 错误边界 ───── */
  await check(115, '整页兜底 + 动态页重试卡 + 离线提示', async () => {
    const eb = read('web/src/components/ErrorBoundary.jsx');
    must(eb.includes('export default class ErrorBoundary'), '缺 ErrorBoundary 类');
    must(eb.includes('componentDidCatch') || eb.includes('getDerivedStateFromError'), '错误边界没接生命周期');
    must(eb.includes('export function ErrorCard'), '缺 ErrorCard');
    must(eb.includes('export function OfflineBanner'), '缺 OfflineBanner');
    must(eb.includes("'online'") && eb.includes("'offline'"), '没监听 online/offline');
    const app = read('web/src/App.jsx');
    must(app.includes('ErrorBoundary'), 'App 没挂错误边界');
    must(js.includes('这个页面出错了') || js.includes('页面出错了'), '构建产物缺兜底文案');
    must(js.includes('离线'), '构建产物缺离线提示');
    return 'ErrorBoundary + ErrorCard + OfflineBanner';
  });

  /* ───── 116 图片缓存 200MB 上限（真函数断言） ───── */
  await check(116, '缓存 200MB 上限删最旧，设置页显示占用', async () => {
    must(DEFAULT_MAX_BYTES === 200 * 1024 * 1024, `默认上限不是 200MB：${DEFAULT_MAX_BYTES}`);

    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'vrc-parity11-cache-'));
    try {
      const cache = createImgCache(dir, { maxBytes: 1000 });
      const now = Date.now();
      for (const [key, bytes, ago] of [['old', 600, 5000], ['mid', 600, 3000], ['new', 600, 1000]]) {
        await fsp.writeFile(path.join(dir, `${key}.bin`), Buffer.alloc(bytes, 1));
        await fsp.writeFile(path.join(dir, `${key}.json`), JSON.stringify({ ct: 'image/png', bytes }));
        const t = new Date(now - ago);
        await fsp.utimes(path.join(dir, `${key}.bin`), t, t);
      }
      const r = await cache.enforce();
      must(r.removed === 2 && r.bytes === 600, `清理结果不对：removed=${r.removed} bytes=${r.bytes}`);
      const left = (await fsp.readdir(dir)).sort();
      must(left.length === 2 && left[0].startsWith('new'), `留下的不是最新那份：${left.join(',')}`);
      const s = await cache.stats();
      must(s.maxBytes === 1000 && s.bytes === 600, 'stats 数字不对');
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }

    const route = read('server/src/routes/round3.js');
    must(route.includes('createImgCache'), '图片代理没用 imgCache');
    must(route.includes('cache.put(') && route.includes('cache.get('), '代理没走 cache.get/put');
    must(route.includes('cache: await cache.stats()'), '诊断接口没回 cache stats');
    const settings = read('web/src/pages/SettingsPage.jsx');
    must(settings.includes('cache.human') && settings.includes('maxHuman'), '设置页没显示占用/上限');
    must(js.includes('超出自动删最旧'), '构建产物缺缓存说明（没 build？）');
    return '200MB 上限删最旧；设置页显示 X MB / 200MB';
  });

  /* ───── 117 通知分组折叠 ───── */
  await check(117, '同类型折叠成组，可展开', async () => {
    const lib = read('web/src/lib/notifGroups.js');
    must(lib.includes('export function groupByType'), '缺 groupByType');
    must(lib.includes('export function groupSummary'), '缺 groupSummary');
    const page = read('web/src/pages/NotificationsPage.jsx');
    must(page.includes('data-notif-groups'), '通知页没接分组');
    must(page.includes('data-group-toggle'), '缺折叠开关');
    must(page.includes('data-group-open'), '缺展开状态');
    must(js.includes('data-group-toggle') || js.includes('组'), '构建产物缺分组（没 build？）');
    return 'groupByType + 组头折叠';
  });

  /* ───── 118 时间线分段 ───── */
  await check(118, '动态按 今天/昨天/更早 分段', async () => {
    const lib = read('web/src/lib/timeSections.js');
    for (const f of ['dayKey', 'sectionOf', 'splitSections']) must(lib.includes(`export function ${f}`), `timeSections 缺 ${f}`);
    must(lib.includes("today: '今天'") && lib.includes("earlier: '更早'"), '缺中文段名');

    const now = new Date('2026-11-19T10:00:00+08:00');
    const { splitSections } = await import(pathToFileURL(path.join(ROOT, 'web/src/lib/timeSections.js')).href);
    const secs = splitSections([
      { at: '2026-11-19T01:00:00.000Z' }, // 09:00 +08 今天
      { at: '2026-11-18T12:00:00.000Z' }, // 20:00 +08 昨天
      { at: '2026-11-01T00:00:00.000Z' },
    ], (x) => x.at, now);
    must(secs.map((s) => s.key).join(',') === 'today,yesterday,earlier', `分段顺序不对：${secs.map((s) => s.key)}`);

    const feed = read('web/src/pages/FeedPage.jsx');
    must(feed.includes('data-day={s.key}'), 'FeedPage 段头没挂 data-day');
    must(css.includes('.feed-day'), 'styles.css 缺 .feed-day');
    must(js.includes('更早'), '构建产物缺「更早」');
    return '3 段顺序 today,yesterday,earlier';
  });

  const okCount = results.filter((r) => r.ok).length;
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id} ${r.name}${r.detail ? ` — ${r.detail}` : ''}${r.ok ? '' : `\n     ${r.detail}`}`);
  }
  console.log(`\nPARITY11 ${okCount === TOTAL_ITEMS ? 'OK' : 'PARTIAL'} ${okCount}/${TOTAL_ITEMS}`);
  exitCode = okCount === TOTAL_ITEMS ? 0 : 1;
} catch (e) {
  console.log(`PARITY11 FAIL ${e.stack || e.message}`);
}
process.exit(exitCode);
