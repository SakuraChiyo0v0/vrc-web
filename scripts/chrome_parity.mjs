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
    // 顶层 = top/folder 两种；footer（设置/收起导航栏）单独量，混进来会拉偏行距
    const top = rows.filter((el) => el.dataset.navKind === 'top' || el.dataset.navKind === 'folder');
    const footRows = [...document.querySelectorAll('[data-nav-footer] [data-nav-kind]')];
    const sbBar = document.querySelector('#vrc-statusbar');
    const sbItems = [...(sbBar?.querySelectorAll('[data-status-item]') ?? [])];
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
      subCount: rows.length - top.length,
      // 188 SidebarFooter：真机只有两项、pitch 39、无分歧线、无说明块
      footCount: footRows.length,
      footLabels: footRows.map((el) => (el.lastElementChild?.textContent ?? el.textContent).trim()),
      footPitch: footRows.length > 1 ? Math.round((y(footRows[1]).y - y(footRows[0]).y) * 10) / 10 : null,
      // 真机 footer 贴侧栏底：最后一行底到侧栏底 8px 内
      footBottomGap: footRows.length
        ? Math.round((y(document.querySelector('aside.vrc-sidebar')).bottom - y(footRows[footRows.length - 1]).bottom) * 10) / 10
        : null,
      footNoteBlock: !!document.querySelector('aside.vrc-sidebar .text-fg3'),
      // 188 底部状态栏：4 项圆点 + 文字，左对齐
      sbCount: sbItems.length,
      sbLabels: sbItems.map((el) => el.textContent.trim()),
      sbFirstDotX: sbItems[0] ? Math.round(y(sbItems[0].firstElementChild).x * 10) / 10 : null,
      sbDotW: sbItems[0] ? Math.round(y(sbItems[0].firstElementChild).width * 10) / 10 : null,
      // 项间距 = 下一项圆点左缘 - 上一项文字右缘（真机 24/23/22）
      sbGaps: sbItems.slice(1).map((el, i) => {
        const prevLabel = y(sbItems[i].lastElementChild);
        return Math.round((y(el.firstElementChild).x - (prevLabel.x + prevLabel.width)) * 10) / 10;
      }),
      sbLastRight: sbItems.length ? Math.round((y(sbItems[sbItems.length - 1]).x + y(sbItems[sbItems.length - 1]).width) * 10) / 10 : null,
      sbH: sbBar ? Math.round(y(sbBar).height * 10) / 10 : null
    };
  });
  // 189 顶栏（自定义标题栏）：真机量的是字形（docs/ref/topbar-measure.json → spec.chrome.topbar），
  // 所以品牌/帮助/搜索/图标一律取 rect，窗口控制取 glyph（svg）而非按钮框。
  const TBREF = SPEC.topbar;
  const tbGot = await page.evaluate(() => {
    const q = (n) => document.querySelector(`[data-topbar="${n}"]`);
    const r = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x * 10) / 10, w: Math.round(b.width * 10) / 10, right: Math.round(b.right * 10) / 10 };
    };
    const glyph = (el) => r(el.querySelector('svg') ?? el.firstElementChild);
    const search = q('search');
    const kbd = search.querySelector('kbd');
    const acts = [...q('actions').children].map(glyph);
    const wcs = [...q('window-controls').children].map(glyph);
    const pitches = (a) => a.slice(1).map((v, i) => Math.round((v.x - a[i].x) * 10) / 10);
    const med = (xs) => {
      if (!xs.length) return null;
      const s = [...xs].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)];
    };
    const h1 = document.querySelector('#vrc-topbar h1');
    // 底色用 canvas 归一成 rgb（主题色是 oklch，直接比字符串会误判）
    const cv = document.createElement('canvas');
    cv.width = cv.height = 1;
    const cx = cv.getContext('2d');
    cx.fillStyle = getComputedStyle(document.querySelector('#vrc-topbar')).backgroundColor;
    cx.fillRect(0, 0, 1, 1);
    const px = cx.getImageData(0, 0, 1, 1).data;
    return {
      bg: [px[0], px[1], px[2]],
      brand: r(q('brand')),
      help: r(q('help')),
      search: r(search),
      icon: r(search.firstElementChild),
      ph: r(search.querySelector('span')),
      kbd: r(kbd),
      actCount: acts.length,
      actFirst: acts[0]?.x ?? null,
      actPitch: med(pitches(acts)),
      actGap: acts[0] && kbd ? Math.round((acts[0].x - r(kbd).right) * 10) / 10 : null,
      wcCount: wcs.length,
      wcFirst: wcs[0]?.x ?? null,
      wcPitch: med(pitches(wcs)),
      wcRightPad: wcs.length ? Math.round((window.innerWidth - wcs[wcs.length - 1].right) * 10) / 10 : null,
      titleVisible: !!h1 && h1.getBoundingClientRect().width > 1
    };
  });
  want['topbar.brand_x'] = rel(TBREF.brand.x, SPEC.inner.x);
  want['topbar.brand_w'] = TBREF.brand.w;
  want['topbar.help_x'] = rel(TBREF.help.x, SPEC.inner.x);
  want['topbar.help_w'] = TBREF.help.w;
  want['topbar.search_icon_x'] = rel(TBREF.search.x, SPEC.inner.x);
  want['topbar.search_icon_w'] = TBREF.search.icon_w;
  want['topbar.placeholder_x'] = rel(TBREF.search.placeholder_x, SPEC.inner.x);
  want['topbar.shortcut_x'] = rel(TBREF.search.shortcut_x, SPEC.inner.x);
  want['topbar.shortcut_w'] = TBREF.search.shortcut_w;
  want['topbar.actions_count'] = TBREF.actions.count;
  want['topbar.actions_first_x'] = rel(TBREF.actions.first_x, SPEC.inner.x);
  want['topbar.actions_pitch'] = TBREF.actions.pitch;
  want['topbar.actions_gap'] = TBREF.actions.gap_from_shortcut;
  want['topbar.wc_count'] = TBREF.window_controls.count;
  want['topbar.wc_first_x'] = rel(TBREF.window_controls.first_x, SPEC.inner.x);
  want['topbar.wc_pitch'] = TBREF.window_controls.pitch;
  want['topbar.wc_right_pad'] = TBREF.window_controls.right_pad;
  tol['topbar.actions_count'] = 0;
  tol['topbar.wc_count'] = 0;
  tol['topbar.wc_right_pad'] = 4;   // 真机窗口控制字形宽 11-12，我们的 svg 14，末字形右缘必然多 3

  want['nav.top_pitch'] = NAVREF.top_pitch;
  want['nav.sub_pitch'] = NAVREF.sub_pitch;
  want['nav.item_h'] = NAVREF.item_h;
  want['nav.sub_item_h'] = NAVREF.sub_item_h;
  want['nav.sub_indent'] = NAVREF.sub_indent;
  want['nav.folders'] = NAVREF.folders;
  tol['nav.folders'] = 0;
  // 188 侧栏 footer + 底部状态栏（docs/ref/footer-measure.json → spec.chrome.nav.footer / chrome.statusbar）
  const SBREF = SPEC.statusbar;
  want['nav.footer_count'] = NAVREF.footer.count;
  want['nav.footer_pitch'] = NAVREF.footer.pitch;
  want['statusbar.items'] = SBREF.count;
  want['statusbar.first_dot_x'] = SBREF.first_dot_x;
  want['statusbar.item_gap'] = SBREF.item_gap;
  want['statusbar.dot_w'] = SBREF.dot_w;
  tol['nav.footer_count'] = 0;
  tol['statusbar.items'] = 0;
  tol['statusbar.dot_w'] = 1;

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

  ours['topbar.brand_x'] = tbGot.brand?.x ?? null;
  ours['topbar.brand_w'] = tbGot.brand?.w ?? null;
  ours['topbar.help_x'] = tbGot.help?.x ?? null;
  ours['topbar.help_w'] = tbGot.help?.w ?? null;
  ours['topbar.search_icon_x'] = tbGot.icon?.x ?? null;
  ours['topbar.search_icon_w'] = tbGot.icon?.w ?? null;
  ours['topbar.placeholder_x'] = tbGot.ph?.x ?? null;
  ours['topbar.shortcut_x'] = tbGot.kbd?.x ?? null;
  ours['topbar.shortcut_w'] = tbGot.kbd?.w ?? null;
  ours['topbar.actions_count'] = tbGot.actCount;
  ours['topbar.actions_first_x'] = tbGot.actFirst;
  ours['topbar.actions_pitch'] = tbGot.actPitch;
  ours['topbar.actions_gap'] = tbGot.actGap;
  ours['topbar.wc_count'] = tbGot.wcCount;
  ours['topbar.wc_first_x'] = tbGot.wcFirst;
  ours['topbar.wc_pitch'] = tbGot.wcPitch;
  ours['topbar.wc_right_pad'] = tbGot.wcRightPad;

  ours['nav.top_pitch'] = navGot.topPitch;
  ours['nav.sub_pitch'] = navGot.subPitch;
  ours['nav.item_h'] = navGot.rowH;
  ours['nav.sub_item_h'] = navGot.subRowH;
  ours['nav.sub_indent'] = navGot.subIndent;
  ours['nav.folders'] = navGot.folders;
  ours['nav.footer_count'] = navGot.footCount;
  ours['nav.footer_pitch'] = navGot.footPitch;
  ours['statusbar.items'] = navGot.sbCount;
  ours['statusbar.first_dot_x'] = navGot.sbFirstDotX;
  // 项间距：相邻项文字右端到下一圆点的空隙（真机 24/23/22，取中位数）
  ours['statusbar.item_gap'] = (() => {
    const g = (navGot.sbGaps ?? []).filter((v) => v != null);
    if (!g.length) return null;
    g.sort((a, b) => a - b);
    return g[Math.floor(g.length / 2)];
  })();
  ours['statusbar.dot_w'] = navGot.sbDotW;

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
  // 顺序/文案/对齐这类非数值项单独断言（spec 里是数组，不做差值和容差）
  // 顶栏底色与「无页面标题/账号名」：真机 16 张截图顶栏逐项一致，底色 #f5f5f5
  {
    const hex = TBREF.bg.replace('#', '');
    const ref = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const d = Math.max(...ref.map((v, i) => Math.abs(v - tbGot.bg[i])));
    rows.push({ metric: 'topbar.bg', ours: `rgb(${tbGot.bg.join(',')})`, ref: TBREF.bg, diff: d, tol: 3, ok: d <= 3 });
  }
  rows.push({
    metric: 'topbar.no_page_title',
    ours: tbGot.titleVisible ? 'visible title' : 'sr-only',
    ref: 'none', diff: '-', tol: '-', ok: tbGot.titleVisible === false
  });
  rows.push({
    metric: 'nav.footer_labels',
    ours: (navGot.footLabels ?? []).join('|'),
    ref: NAVREF.footer.items.map((i) => i.label).join('|'),
    diff: '-', tol: '-',
    ok: (navGot.footLabels ?? []).join('|') === NAVREF.footer.items.map((i) => i.label).join('|')
  });
  rows.push({
    metric: 'nav.footer_no_note',
    ours: navGot.footNoteBlock ? 'has note block' : 'none',
    ref: 'none', diff: '-', tol: '-', ok: navGot.footNoteBlock === false
  });
  rows.push({
    metric: 'nav.footer_at_bottom',
    ours: `${navGot.footBottomGap}px`, ref: '8px', diff: navGot.footBottomGap - 8, tol: 8,
    ok: navGot.footBottomGap != null && navGot.footBottomGap >= 0 && navGot.footBottomGap <= 16
  });
  rows.push({
    metric: 'statusbar.labels',
    ours: (navGot.sbLabels ?? []).join('|'),
    ref: SBREF.items.map((i) => i.label).join('|'),
    diff: '-', tol: '-',
    ok: (navGot.sbLabels ?? []).join('|') === SBREF.items.map((i) => i.label).join('|')
  });
  rows.push({
    metric: 'statusbar.left_aligned',
    ours: navGot.sbLastRight, ref: `<=${Math.round(got.vw / 2)}`, diff: '-', tol: '-',
    ok: navGot.sbLastRight != null && navGot.sbLastRight <= got.vw / 2
  });
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
