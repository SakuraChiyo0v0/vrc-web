/**
 * 页面结构对齐：docs/ref/vrcx0-spec.json → pages[*].structure（逐条来自真机截图量测）vs 我们的 DOM。
 *
 *   node scripts/structure_parity.mjs [baseUrl]     # 默认 http://127.0.0.1:8899（server/scripts/demo.mjs）
 *
 * 只比「截图能证明的结构」：表格列数与列名、可见行数、tab/chip/子导航文字、网格列数、空态文案。
 * 每项输出 PASS/DIFF；有 DIFF 就 exit 1。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = pw;

const BASE = (process.argv[2] || 'http://127.0.0.1:8899').replace(/\/$/, '');
const ROOT = process.env.VRC_ROOT || path.resolve(import.meta.dirname, '..');
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/ref/vrcx0-spec.json'), 'utf8'));
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const rows = [];
const check = (page, name, ours, want, ok) => rows.push({ page, name, ours: String(ours), want, ok });

// 只看内容面板（排除侧栏/右栏），避免把导航文字算成页面 tab
const probe = (p) => p.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const main = document.querySelector('main') || document.body;
  const ths = [...main.querySelectorAll('thead th')].map(txt);
  const inView = (el) => {
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0 && r.height > 0;
  };
  // 一屏行数要按「真的一屏装得下的条数」比，表格超出一屏时不能把滚动区的行也算进去
  const trs = [...main.querySelectorAll('tbody tr')]
    .filter((tr) => !tr.classList.contains('group-row') && inView(tr));
  const tabs = [...main.querySelectorAll('[role="tab"], .nav-tab, [data-navtab]')].map(txt);
  const subnav = [...main.querySelectorAll('[data-subnav] button, .settings-subnav button')].map(txt);
  const grid = main.querySelector('.world-grid, .fav-grid, [data-grid]');
  const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : null;
  const cards = main.querySelectorAll('.card').length;
  const listRows = [...main.querySelectorAll('[data-list-row]')];
  const visRows = listRows.filter(inView);
  const cellsOf = (el) => [...el.querySelectorAll('[data-cell]')].map((c) => c.dataset.cell);
  return {
    ths, tabs, subnav, gridCols: cols, cards,
    rows: visRows.length || trs.length,
    rowCells: trs[0]
      ? [...trs[0].children].filter((c) => !c.classList.contains('group-cell')).length
      : cellsOf(visRows[0] || listRows[0] || document.createElement('div')).length,
    cellNames: cellsOf(visRows[0] || listRows[0] || document.createElement('div')),
    leftListW: Math.round((main.querySelector('.sess-list')?.getBoundingClientRect().width ?? 0) * 10) / 10,
    rowH: Math.round(((visRows[0] || listRows[0])?.getBoundingClientRect().height ?? 0) * 10) / 10,
    emptyTitle: txt(main.querySelector('.empty-title, .empty h2, .sess-detail-title')),
    text: main.innerText,
  };
});

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
// 真机截图是 1700x1040 窗口（内窗 1688x1028）；用内窗尺寸量，避开 ≥1700 的大屏 zoom:1.15
const p = await browser.newPage({ viewport: { width: 1688, height: 1028 }, deviceScaleFactor: 1 });

async function go(page) {
  await p.goto(`${BASE}#/${page}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  // 懒加载路由 + 首屏接口：等 main 里出现实际内容再量，否则会把「还在加载」当成空结构
  await p
    .waitForFunction(() => {
      const m = document.querySelector('main');
      if (!m || m.innerText.trim().length <= 20) return false;
      if (/^\s*加载中/.test(m.innerText)) return false;
      return !m.querySelector('.skeleton, [class*=skeleton]');
    }, null, { timeout: 20000 })
    .catch(() => {});
  await p.waitForTimeout(1200);
  let got = await probe(p);
  // 首屏接口偶发慢（本地 sqlite 被并发占住）：空白重载一次再量，避免把「没等到」当结构差异
  for (let i = 0; i < 2 && got.text.trim().length < 40; i += 1) {
    await p.reload({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2000);
    got = await probe(p);
  }
  return got;
}

const PAGES = ['search', 'sessions', 'players', 'favorites', 'insights', 'friendlist', 'friendlog', 'gamelog', 'settings'];
for (const page of PAGES) {
  const want = SPEC.pages?.[page]?.structure;
  if (!want) { check(page, '结构记录', '无', 'spec.pages 有 structure', true); continue; }
  const got = await go(page);

  if (want.columns_n) {
    // 表头存在就比表头列名；无表头的列表按首行列数比
    const n = got.ths.length || got.rowCells;
    check(page, '列数', n, String(want.columns_n), n === want.columns_n);
    if (got.ths.length) {
      const same = want.columns.every((c, i) => got.ths[i] && (got.ths[i] === c || got.ths[i].startsWith(c) || c.startsWith(got.ths[i])));
      check(page, '列名', got.ths.join('/'), want.columns.join('/'), same);
    } else if (want.columns?.length) {
      // 无表头的列表（真机 header_row=false）：用行内单元格语义核对列顺序
      check(page, '列名', (got.cellNames || []).join('/'), want.columns.join('/'),
        JSON.stringify(got.cellNames) === JSON.stringify(want.columns));
    }
  }
  if (want.kind === 'master_detail' && SPEC.pages?.[page]?.row_pitch) {
    // 主从列表：一屏行数取决于数据里有几天（真机 27 条只跨 2 天），改为核对行距
    const want_pitch = SPEC.pages[page].row_pitch;
    check(page, '行距', got.rowH, String(want_pitch), Math.abs(got.rowH - want_pitch) <= 1.5);
  }
  if (want.rows_visible && want.kind !== 'master_detail') {
    // 截图里一屏可见 N 行；我们的行高不必一模一样，但一屏装得下的条数要同量级（±3）
    const screenRows = Math.round((1040 - 47 - 35 - 40) / ((1040 - 122) / want.rows_visible));
    check(page, '一屏行数', got.rows, `≈${want.rows_visible}`, Math.abs(got.rows - want.rows_visible) <= 3);
  }
  if (want.tabs_n !== undefined) check(page, 'tab 数', got.tabs.length, String(want.tabs_n), got.tabs.length === want.tabs_n);
  if (want.nav_tabs) check(page, '主导航 tab 名', got.tabs.slice(0, want.nav_tabs.length).join('/'), want.nav_tabs.join('/'),
    JSON.stringify(got.tabs.slice(0, want.nav_tabs.length)) === JSON.stringify(want.nav_tabs));
  if (want.subnav_n) {
    check(page, '子导航项数', got.subnav.length, String(want.subnav_n), got.subnav.length === want.subnav_n);
    check(page, '子导航文字', got.subnav.join('/'), want.subnav.join('/'), got.subnav.join('/') === want.subnav.join('/'));
  }
  if (want.grid_columns) check(page, '网格列数', got.gridCols, String(want.grid_columns), got.gridCols === want.grid_columns);
  if (want.folder_sidebar !== undefined) {
    const has = /在线收藏夹|本地收藏夹/.test(got.text);
    check(page, '收藏夹侧栏', has, String(want.folder_sidebar), has === want.folder_sidebar);
  }
  if (want.empty_title) check(page, '空态文案', got.emptyTitle || '(无)', want.empty_title, got.emptyTitle === want.empty_title);
  if (want.chips) check(page, 'chip', got.text.includes(want.chips[0]), want.chips.join('/'), want.chips.every((c) => got.text.includes(c)));
  if (want.groups) {
    const ok = want.groups.every((g) => got.text.includes(g));
    check(page, '分组标题', want.groups.filter((g) => got.text.includes(g)).join('/'), want.groups.join('/'), ok);
  }
  if (want.kind === 'master_detail') {
    check(page, '左列表宽度', got.leftListW, String(want.left_list_w), Math.abs(got.leftListW - want.left_list_w) <= 2);
    if (want.detail_empty) {
      check(page, '详情空态标题', got.emptyTitle || '(无)', want.detail_empty[0], got.emptyTitle === want.detail_empty[0]);
      check(page, '详情空态正文', got.text.includes(want.detail_empty[1]), want.detail_empty[1], got.text.includes(want.detail_empty[1]));
    }
  }
  if (want.kind === 'graph_canvas') {
    const hasGraph = got.text.includes('圈子') || got.text.includes('最少连接数');
    check(page, '关系图画布', hasGraph, '圈子/最少连接数', hasGraph);
  }
}

await browser.close();
for (const r of rows) console.log(`${r.ok ? 'PASS' : 'DIFF'}  [${r.page}] ${r.name} — 我们 ${r.ours} / 真机 ${r.want}`);
const pass = rows.filter((r) => r.ok).length;
fs.writeFileSync(path.join(ROOT, 'docs/ref/structure-parity.json'), JSON.stringify({
  _note: '由 scripts/structure_parity.mjs 生成：spec.pages[*].structure（真机截图量测）vs 我们的 DOM',
  at: new Date().toISOString(),
  base: BASE,
  pass, total: rows.length, rows,
}, null, 2));
console.log(`\n结构对齐 ${pass}/${rows.length}（${Math.round((pass / rows.length) * 100)}%）· 基准 docs/ref/vrcx0-spec.json → pages[*].structure`);
process.exit(pass === rows.length ? 0 : 1);
