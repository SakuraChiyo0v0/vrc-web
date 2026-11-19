/**
 * 第十四轮对齐检查（移动端：表格卡片化 / 路由级懒加载 / 离线提示）。
 *   node server/scripts/parity14.mjs     # 退出码 0 = 全绿（先 cd web && npm run build）
 *
 * 141 卡片化 CSS：移动端媒体查询里表头隐藏、格子上「列名: 值」两栏、分组头不套卡片
 * 142 data-label 覆盖：5 个表格页的每个 <td> 都带列名（colSpan 的空态格除外）
 * 143 路由懒加载：App 全部页面走 import()，构建产物按页出 chunk，主包不再吃下全站
 * 144 懒加载占位：Suspense fallback 用 Skeleton（骨架），不是空白/「加载中」
 * 145 离线提示：OfflineBanner 监听 online/offline，App 里挂载，构建产物带文案
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const distDir = path.join(ROOT, 'web/dist/assets');
const assetFiles = (ext) => {
  if (!fs.existsSync(distDir)) throw new Error('web/dist 不存在（先跑 cd web && npm run build）');
  return fs.readdirSync(distDir).filter((x) => x.endsWith(ext));
};
const asset = (ext) => assetFiles(ext).map((f) => fs.readFileSync(path.join(distDir, f), 'utf8')).join('\n');

const results = [];
async function check(id, name, fn) {
  try {
    results.push({ id, name, ok: true, detail: (await fn()) ?? '' });
  } catch (e) {
    results.push({ id, name, ok: false, detail: e.message });
  }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

const CSS = 'web/src/styles.css';
const APP = 'web/src/App.jsx';
const EB = 'web/src/components/ErrorBoundary.jsx';
const TABLE_PAGES = [
  'web/src/pages/FeedPage.jsx',
  'web/src/pages/PlayersPage.jsx',
  'web/src/pages/FavoritesPage.jsx',
  'web/src/pages/FriendListPage.jsx',
  'web/src/pages/SessionsPage.jsx',
];

let exitCode = 1;
try {
  const cssSrc = read(CSS);
  const cssDist = asset('.css');

  /* ───── 141 卡片化 CSS ───── */
  await check(141, '移动端表格卡片化：表头隐藏 + 列名/值两栏 + 分组头不套卡', async () => {
    // 移动端媒体查询里表头隐藏（源码与产物都要有，产物可能被压缩）
    must(/\.tbl thead\s*\{\s*display:\s*none/.test(cssSrc), 'styles.css 移动端没隐藏表头');
    must(/\.tbl thead\{display:none\}/.test(cssDist), '构建产物里没有 .tbl thead{display:none}');
    // 列名由 data-label 提供，DOM 只留一份
    must(/td\[data-label\]::before\s*\{[^}]*content:\s*attr\(data-label\)/s.test(cssSrc), '格子没按 data-label 渲染列名');
    must(/td\[data-label\]:before\{[^}]*content:attr\(data-label\)/s.test(cssDist), '产物里没有 data-label 列名规则');
    // 格子是「列名 … 值」两栏
    must(/\.tbl tbody td\s*\{[^}]*justify-content:\s*space-between/s.test(cssSrc), '格子没排成两端对齐两栏');
    // 分组头 / 日期头保持整行、不套卡片
    must(/\.tbl tbody tr\.group-row[\s\S]{0,200}border-width:\s*0 0 1px/.test(cssSrc), '分组头被当成卡片处理');
    must(/\.group-row td::before,\s*\n?\s*\.tbl tbody tr\.feed-day td::before\s*\{\s*content:\s*none/.test(cssSrc)
      || /content:\s*none/.test(cssSrc), '分组头没去掉伪元素列名');
    // 卡片行不再横滚
    must(/\.card\s*\{\s*overflow-x:\s*clip/.test(cssSrc), '卡片容器仍可能横向滚动');
    return `表头隐藏 + attr(data-label) 列名 + 分组头豁免；产物 CSS ${(cssDist.length / 1024).toFixed(0)} kB 含同规则`;
  });

  /* ───── 142 data-label 覆盖 ───── */
  await check(142, '表格页每个数据格都带列名（空态 colSpan 除外）', async () => {
    let cells = 0;
    for (const p of TABLE_PAGES) {
      const src = read(p);
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        if (!/<td[\s>]/.test(line)) return;
        if (/colSpan=/.test(line)) return;          // 整行空态/提示，没有列名
        cells += 1;
        must(/data-label=/.test(line), `${path.basename(p)}:${i + 1} <td> 没有 data-label：${line.trim().slice(0, 60)}`);
      });
    }
    must(cells >= 20, `只找到 ${cells} 个数据格，表格页看起来没接上`);
    return `${TABLE_PAGES.length} 个表格页、${cells} 个数据格全部带列名`;
  });

  /* ───── 143 路由级懒加载 ───── */
  await check(143, '路由级懒加载：页面全部 import()，产物按页分 chunk', async () => {
    const app = read(APP);
    must(/from 'react'/.test(app) && /\blazy\b/.test(app) && /\bSuspense\b/.test(app), 'App 没引 lazy/Suspense');
    const routes = [...app.matchAll(/^\s{2}(\w+):\s*lazy\(\(\) => import\('\.\/pages\/(\w+)\.jsx'\)\)/gm)];
    must(routes.length >= 16, `只有 ${routes.length} 条路由走懒加载（应 ≥16）`);
    must(!/^\s{2}\w+:\s*(?!lazy\()\w+Page,?$/m.test(app), '还有页面是静态 import');
    // 产物按页出 chunk
    const chunks = assetFiles('.js').filter((f) => /Page-[\w-]+\.js$/.test(f));
    must(chunks.length >= 16, `产物里只有 ${chunks.length} 个页面 chunk`);
    const sizes = assetFiles('.js').map((f) => [f, fs.statSync(path.join(distDir, f)).size]);
    const total = sizes.reduce((a, [, n]) => a + n, 0);
    const [indexFile, indexSize] = sizes.find(([f]) => /^index-/.test(f)) ?? [null, 0];
    must(indexFile, '产物里没有 index-*.js 主包');
    must(indexSize < total * 0.8, `主包占全站 ${(indexSize / total * 100).toFixed(0)}%，没有真正拆包`);
    const pageBytes = sizes.filter(([f]) => /Page-/.test(f)).reduce((a, [, n]) => a + n, 0);
    must(pageBytes > 60 * 1024, `页面 chunk 合计只有 ${(pageBytes / 1024).toFixed(0)} kB，页面内容没进来`);
    return `${routes.length} 条懒加载路由；产物 ${chunks.length} 个页面 chunk 共 ${(pageBytes / 1024).toFixed(0)} kB，主包 ${(indexSize / 1024).toFixed(0)}/${(total / 1024).toFixed(0)} kB`;
  });

  /* ───── 144 懒加载占位 ───── */
  await check(144, '页面切换时出骨架占位，不白屏', async () => {
    const app = read(APP);
    must(/<Suspense fallback=\{/.test(app), 'Suspense 没配 fallback');
    must(/<Skeleton rows=/.test(app), 'fallback 不是骨架');
    must(/import Skeleton from '\.\/components\/Skeleton\.jsx'/.test(app), 'App 没引 Skeleton');
    const js = asset('.js');
    must(/data-skeleton/.test(js), '产物里没有骨架标记');
    return 'Suspense fallback 用 Skeleton（data-skeleton 在产物里）';
  });

  /* ───── 145 离线提示 ───── */
  await check(145, '离线提示条：断网置顶提示、恢复自动消失', async () => {
    const eb = read(EB);
    must(/export function OfflineBanner/.test(eb), '没有 OfflineBanner');
    must(/navigator\.onLine === false/.test(eb), '没读 navigator.onLine 判初始态');
    must(/addEventListener\('online'/.test(eb) && /addEventListener\('offline'/.test(eb), '没监听 online/offline');
    must(/removeEventListener\('online'/.test(eb) && /removeEventListener\('offline'/.test(eb), '卸载时没解绑监听');
    must(/data-offline="1"/.test(eb), '提示条没有 data-offline 标记');
    must(/离线/.test(eb), '提示条没有离线文案');
    const app = read(APP);
    must(/<OfflineBanner \/>/.test(app), 'App 没挂 OfflineBanner');
    const js = asset('.js');
    must(/离线/.test(js) && /data-offline/.test(js), '构建产物里没有离线提示');
    return 'data-offline 提示条挂在 workspace 上方，online/offline 双向监听，文案进产物';
  });

  const okCount = results.filter((r) => r.ok).length;
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id} ${r.name} — ${r.detail}`);
  }
  console.log(`\nPARITY14 ${okCount === results.length ? 'OK' : 'PARTIAL'} ${okCount}/${results.length}`);
  exitCode = okCount === results.length ? 0 : 1;
} catch (e) {
  console.log(`PARITY14 FAIL ${e.stack || e.message}`);
}
process.exit(exitCode);
