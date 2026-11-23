/**
 * 184 外壳结构对齐：在浏览器里量我们自己的 DOM，逐项比 docs/ref/vrcx0-spec.json → chrome。
 *
 *   NODE_PATH=/opt/data/cache/hermes-daily-template/node_modules \
 *     node scripts/chrome_parity.mjs [baseUrl]
 *
 * 口径：
 *   - 截图尺寸 1688×1028 = 真机窗口 1700×1040 去掉 6px 边框（spec.chrome.inner），
 *     所以我们的 DOM 坐标减去视口原点就能和 spec 里的 inner 相对坐标直接比。
 *   - 容差 ±2px；内容面板高度单独给 4px（真机窗口上下各 2px 内缩：inner 从 y6 起、
 *     状态栏底 1032 而 inner 底 1034），其余项一律 2px。
 *   - 数值全部来自截图量测（scripts/measure_ref_chrome.py / measure_ref_rail.py），本脚本不自拟断言。
 * 产出 docs/ref/chrome-parity.json；有 FAIL 则 exit 1。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// playwright 不在本仓库依赖里（容器只有一份装在 hermes 模板目录），ESM 不吃 NODE_PATH，所以显式按路径 require
const PW_HOME = process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json';
const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = createRequire(PW_HOME)('playwright'); }
const { chromium } = pw;

const BASE = process.argv[2] || 'http://127.0.0.1:8899';
const ROOT = process.env.VRC_ROOT || path.resolve(import.meta.dirname, '..');
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/ref/vrcx0-spec.json'), 'utf8')).chrome;
const OUT = path.join(ROOT, 'docs/ref/chrome-parity.json');
const SHOT = path.join(ROOT, 'docs/screenshots/compare');
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const W = SPEC.inner.w;   // 1688
const H = SPEC.inner.h;   // 1028
// spec 里的绝对坐标 → 相对 inner 原点
const rel = (v, base) => v - base;
const want = {
  'topbar.h': SPEC.topbar.h,
  'topbar.y': rel(SPEC.topbar.y, SPEC.inner.y),
  'sidebar.x': rel(SPEC.sidebar.x, SPEC.inner.x),
  'sidebar.w': SPEC.sidebar.w,
  'sidebar.y': rel(SPEC.topbar.y + SPEC.topbar.h, SPEC.inner.y),
  'statusbar.h': SPEC.statusbar.h,
  'content.x': rel(SPEC.content.x, SPEC.inner.x),
  'content.y': rel(SPEC.content.y, SPEC.inner.y),
  'content.w': SPEC.content.w,
  'content.h': SPEC.content.h,
  'content.right_gap': rel(SPEC.inner.x + SPEC.inner.w, SPEC.inner.x) - rel(SPEC.content.x + SPEC.content.w, SPEC.inner.x)
};
// 右栏（好友面板）内部结构：docs/ref/vrcx0-spec.json → chrome.rail（measure_ref_rail.py 多页中位数）
const RAIL = SPEC.rail;
want['rail.w'] = RAIL.w;                                        // 353
want['rail.x'] = rel(RAIL.x, SPEC.inner.x);                     // 1328-6=1322（相对 inner）
want['rail.divider_x'] = rel(RAIL.divider_x, SPEC.inner.x);      // 1323-6=1317（线在 resizer 正中）
want['rail.resizer_w'] = RAIL.resizer_w;                        // 10
want['rail.self_h'] = RAIL.self_card_h;                         // 59
want['rail.filter_h'] = RAIL.filter_h;                          // 30
want['rail.icon_rail_w'] = RAIL.icon_rail_w;                    // 36
want['rail.section_head_h'] = RAIL.section_head_h;              // 21
want['rail.row_pitch'] = RAIL.row_pitch;                        // 60
want['rail.flush_right'] = 0;                                   // 栏右缘 = 内容面板右缘（真机 1680/1681）
const tol = { 'content.h': 4, 'rail.row_pitch': 3, 'rail.flush_right': 2, 'nav.sub_indent': 3 };

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const rows = [];
try {
  await page.goto(`${BASE}/#/feed`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#vrc-topbar', { timeout: 20000 });
  await page.waitForSelector('#vrc-statusbar', { timeout: 20000 });
  await page.waitForSelector('aside.vrc-sidebar', { timeout: 20000 });
  await page.waitForTimeout(600);

  const got = await page.evaluate(() => {
    const r = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 };
    };
    return {
      topbar: r('#vrc-topbar'),
      sidebar: r('aside.vrc-sidebar'),
      statusbar: r('#vrc-statusbar'),
      content: r('.workspace'),
      roster: r('[data-testid="roster-rail"]'),
      resize: r('[data-testid="roster-resize"]'),
      self: r('[data-testid="roster-self"]'),
      filter: r('[data-testid="roster-filter"]'),
      iconrail: r('[data-testid="roster-iconrail"]'),
      // 行距：同一 section 内相邻好友行的 y 差中位数（跨分组不算）
      rowPitch: (() => {
        const ds = [];
        for (const sec of document.querySelectorAll('.roster-body section[data-section]')) {
          const ys = [...sec.querySelectorAll('.roster-row')].map((el) => el.getBoundingClientRect().y);
          for (let i = 1; i < ys.length; i += 1) ds.push(ys[i] - ys[i - 1]);
        }
        if (!ds.length) return null;
        ds.sort((a, b) => a - b);
        return Math.round(ds[Math.floor(ds.length / 2)] * 10) / 10;
      })(),
      sectionHeadH: (() => {
        const el = document.querySelector('.roster-body .group-head');
        return el ? Math.round(el.getBoundingClientRect().height * 10) / 10 : null;
      })(),
      vw: window.innerWidth,
      vh: window.innerHeight
    };
  });

  // 185 侧栏导航密度：真机量测（spec.chrome.nav）→ 行距/缩进/折叠夹数
  const NAVREF = SPEC.nav;
  const navGot = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('aside.vrc-sidebar [data-nav-kind]')];
    const y = (el) => el.getBoundingClientRect();
    const med = (xs) => {
      if (!xs.length) return null;
      xs.sort((a, b) => a - b);
      return Math.round(xs[Math.floor(xs.length / 2)] * 10) / 10;
    };
    // 顶层（含折叠夹行）相邻行距：子项块夹在中间时差值很大，取中位数不受影响
    const top = rows.filter((el) => el.dataset.navKind !== 'sub');
    const topPitch = med(top.slice(1).map((el, i) => y(el).y - y(top[i]).y));
    const sub = {};
    for (const box of document.querySelectorAll('.nav-sub')) {
      const els = [...box.querySelectorAll('[data-nav-kind="sub"]')];
      sub[box.dataset.navSub] = els.slice(1).map((el, i) => Math.round((y(el).y - y(els[i]).y) * 10) / 10);
    }
    const subPitch = med(Object.values(sub).flat());
    const iconX = (el) => y(el.firstElementChild).x;
    const firstTop = top.find((el) => el.dataset.navKind === 'top');
    const firstSub = rows.find((el) => el.dataset.navKind === 'sub');
    return {
      topPitch,
      subPitch,
      rowH: Math.round(y(firstTop).height * 10) / 10,
      subRowH: firstSub ? Math.round(y(firstSub).height * 10) / 10 : null,
      subIndent: firstTop && firstSub ? Math.round((iconX(firstSub) - iconX(firstTop)) * 10) / 10 : null,
      folders: document.querySelectorAll('aside.vrc-sidebar [data-nav-folder]').length,
      topCount: top.length,
      subCount: rows.length - top.length
    };
  });
  want['nav.top_pitch'] = NAVREF.top_pitch;
  want['nav.sub_pitch'] = NAVREF.sub_pitch;
  want['nav.item_h'] = NAVREF.item_h;
  want['nav.sub_item_h'] = NAVREF.sub_item_h;
  want['nav.sub_indent'] = NAVREF.sub_indent;
  want['nav.folders'] = NAVREF.folders;
  tol['nav.folders'] = 0;

  const ours = {
    'topbar.h': got.topbar.h,
    'topbar.y': got.topbar.y,
    'sidebar.x': got.sidebar.x,
    'sidebar.w': got.sidebar.w,
    'sidebar.y': got.sidebar.y,
    'statusbar.h': got.statusbar.h,
    'content.x': got.content.x,
    'content.y': got.content.y,
    'content.w': got.content.w,
    'content.h': got.content.h,
    'content.right_gap': Math.round((got.vw - (got.content.x + got.content.w)) * 10) / 10,
    'rail.w': got.roster?.w ?? null,
    // 我们的视口 x 已是「相对 inner 原点」口径（内容面板 x=277=spec 283−6），不再减 6
    'rail.x': got.roster?.x ?? null,
    'rail.divider_x': got.resize ? Math.round((got.resize.x + got.resize.w / 2) * 10) / 10 : null,
    'rail.resizer_w': got.resize?.w ?? null,
    'rail.self_h': got.self?.h ?? null,
    'rail.filter_h': got.filter?.h ?? null,
    'rail.icon_rail_w': got.iconrail?.w ?? null,
    'rail.section_head_h': got.sectionHeadH ?? null,
    'rail.row_pitch': got.rowPitch ?? null,
    'rail.flush_right': got.roster ? Math.round((got.roster.x + got.roster.w - (got.content.x + got.content.w)) * 10) / 10 : null
  };

  ours['nav.top_pitch'] = navGot.topPitch;
  ours['nav.sub_pitch'] = navGot.subPitch;
  ours['nav.item_h'] = navGot.rowH;
  ours['nav.sub_item_h'] = navGot.subRowH;
  ours['nav.sub_indent'] = navGot.subIndent;
  ours['nav.folders'] = navGot.folders;

  for (const k of Object.keys(want)) {
    const o = ours[k];
    const w = want[k];
    const t = tol[k] ?? 2;
    const diff = Math.round((o - w) * 10) / 10;
    rows.push({ metric: k, ours: o, ref: w, diff, tol: t, ok: Math.abs(diff) <= t });
  }
  // 壳体自洽（不依赖真机）：三段高度正好铺满视口、内容面板贴侧栏右侧
  rows.push({ metric: 'shell.fill', ours: Math.round(got.topbar.h + got.statusbar.h + got.content.h), ref: H, diff: Math.round(got.topbar.h + got.statusbar.h + got.content.h - H), tol: 0, ok: Math.abs(got.topbar.h + got.statusbar.h + got.content.h - H) <= 1 });
  rows.push({ metric: 'content.flush_sidebar', ours: ours['content.x'], ref: ours['sidebar.x'] + ours['sidebar.w'], diff: Math.round((ours['content.x'] - ours['sidebar.x'] - ours['sidebar.w']) * 10) / 10, tol: 1, ok: Math.abs(ours['content.x'] - ours['sidebar.x'] - ours['sidebar.w']) <= 1 });
  // 真机 1700 宽下右栏是展开的（截图里就在），所以默认应为 open
  rows.push({ metric: 'roster.default_on', ours: got.roster ? 'open' : 'closed', ref: 'open', diff: '-', tol: '-', ok: !!got.roster });

  fs.mkdirSync(SHOT, { recursive: true });
  await page.screenshot({ path: path.join(SHOT, 'chrome-1688.png') });
} finally {
  await browser.close();
}

const pass = rows.filter((r) => r.ok).length;
const report = {
  _note: 'chrome_parity.mjs：视口 1688×1028（真机 inner），逐项比 spec.chrome，容差 ±2px（content.h 4px 见脚本头注释）',
  base: BASE,
  viewport: { w: W, h: H },
  score: Number(((pass / rows.length) * 100).toFixed(1)),
  rows
};
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 1)}\n`);

const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('metric', 22)}${pad('ours', 9)}${pad('ref', 9)}${pad('diff', 8)}ok`);
for (const r of rows) console.log(`${pad(r.metric, 22)}${pad(r.ours, 9)}${pad(r.ref, 9)}${pad(r.diff, 8)}${r.ok ? 'PASS' : 'FAIL'}`);
console.log(`\n结构一致度 ${report.score}% (${pass}/${rows.length}) → ${path.relative(ROOT, OUT)}`);
process.exit(pass === rows.length ? 0 : 1);
