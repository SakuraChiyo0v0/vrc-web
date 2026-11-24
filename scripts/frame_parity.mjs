/**
 * 主框架（外壳）＋导航密度回归：把「窗口多大都长什么样」变成可量数字。
 *
 *   node scripts/frame_parity.mjs [baseUrl]
 *
 * 覆盖 9 个桌面视口 1024×600 / 1024×768 / 1100×800 / 1280×600 / 1280×800 / 1366×768 /
 * 1440×900 / 1600×900 / 1700×1040（600 高两档专测「装不下时靠滚动、行高不被压扁」）。
 *
 * 断言（全部是本仓库对外壳的既定契约，数来自真机量测 docs/ref/vrcx0-spec.json chrome 与实测）：
 *   1) 侧栏宽度分两档：1024–1279 → 214；≥1280 → 277（真机）。顶栏 39 / 状态栏 35。
 *   2) 导航行高恒为顶层 36、二级 31：窗口装不下时是 <nav> 滚动，绝不能被 flex 压扁
 *      （回归：1366×768 曾压到 23）。文本列（图标列 14 + gap 8 + 行内 padding 8）同为 30。
 *   3) 导航能滚到底：scrollTop=max 后最后一项完整落在 <nav> 可视区内。
 *   4) 页脚两项（设置 / 收起导航栏）在侧栏可视区内、不被状态栏盖住。
 *   5) 状态栏恒 4 项：首项 x=10、项间距 23（真机 footer-measure.json）。
 *   6) 内容面板 ≥720：右栏（353）只在 ≥1440 出现，且顶栏右栏开关与之一致显隐。
 *   7) 6 个密度最高的页面（好友位置 / 动态 / 好友列表 / 游戏日志 / 世界库 / 设置）
 *      在以上视口都无横向溢出（documentElement.scrollWidth ≤ innerWidth+1）；收起态也逐页跑一遍。
 *   7b) 收起态密度：有表格的页面列数不变、首列不变窄、行数不变（内容变宽不靠牺牲密度换）——
 *       浅色收起与深色收起各跑一遍（主题不该改密度）；收起态逐页内容列仍 ≥720（收起是让宽，
 *       不是把内容挤窄），右栏宽恒 353 且与展开态基线相等、关掉再开回来不变。
 *   7c) 新 context（无 localStorage）必须默认展开：侧栏在、无顶栏展开按钮、vrc-nav-collapsed ≠ 1。
 *   7d) 收起态 friends 页：右栏不渲染（App.jsx roster && page!=='friends'），内容仍 ≥720、无溢出。
 *   8) 顶栏右簇（快速搜索/Ctrl K → 图标组 → 3 窗口控制）的簇内间距恒定：
 *      kbd 宽 34、kbd→图标组 22、图标组→窗口控制 15、窗口控制 3×24 pitch 40、末项距右缘 8。
 *      注：真机 Ctrl K 绝对 x=1307 是在 1689 宽的截图上量的，契约视口是 1700，
 *      差 11px 属窗口宽度差（不是布局差），所以这里只锁间距不锁绝对 x。
 *
 * 断言按「与侧栏无关的外壳」和「侧栏本身」两段写（assertChrome / assertNav）：
 *   9) 深色主题（vrc-theme=dark）：跑与浅色**同一套** assertFrame。
 *  10) 收起侧栏（vrc-nav-collapsed）：侧栏整列消失、顶栏出现展开按钮、内容区让出整列（214|277）、
 *      无横向溢出；且**收起态也跑整套 assertChrome** —— 顶栏右簇/状态栏 4 项项距/右栏显隐/内容宽
 *      与展开态同口径（此前收起轮只量了 4 个高度，收起后顶栏簇错位也量不到）。
 *      收起态跑两遍：浅色收起 + 深色收起（组合态），主题与折叠互不影响几何。
 *  11) 收起 × 右栏开关（≥1440）：右栏是 .workspace 内部的 flex 列，关掉它面板本身不变宽，
 *      内容列必须正好多出右栏宽（353）、无横向溢出，再开回来内容列/右栏宽度复原。
 *      浅色收起与深色收起各跑一遍；收起态 friends 页则要右栏不渲染、内容 ≥720、无溢出。
 *  12) 主题不改宽度：同一视口浅色收起与深色收起的面板宽、右栏宽必须相等。
 *
 * 任一 FAIL 退出码 1；全 PASS 打印 FRAME OK，并把结果写 docs/ref/frame-parity.json。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { normBase, pageBase, assertVrcPage, gotoVrc } from './lib/page_structure.mjs';

const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;

const BASE = normBase(process.argv[2]?.startsWith('http') ? process.argv[2] : (process.env.VRC_BASE || 'http://127.0.0.1:8891'));
const PAGE = pageBase(BASE);
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs/ref/frame-parity.json');
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

// 矮窗两档（600 高）单列：导航 21 行 × 40 = 840 远超可用高，必须靠 <nav> 滚动而不是压扁行高。
// 这是 1366×768 行高 36→23 那类回归最容易复发的区间。
const VIEWS = [[1024, 600], [1024, 768], [1100, 800], [1280, 600], [1280, 800], [1366, 768], [1440, 900], [1600, 900], [1700, 1040]];
const PAGES = ['friends', 'feed', 'friendlist', 'gamelog', 'worlds', 'settings'];

const rows = [];
// 浅色收起态的内容宽/右栏宽（深色收起轮要用它比「主题不改宽度」）
const lightColl = new Map();
const check = (view, name, ours, want, ok) => {
  rows.push({ view, name, ours, want, ok });
  if (!ok) console.log(`  ✗ ${view} ${name}: 我们 ${ours} / 期望 ${want}`);
};

// ── 共享取样：装一次 window.__chrome，展开态 / 收起态共用（收起后 aside 不存在，
//    这些量测必须与侧栏解耦，否则收起轮只能另写一份精简版，顶栏簇/状态栏就漏掉了）。
const installChrome = () => {
  const box = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return null;
    return { x: b.x, y: b.y, w: b.width, h: b.height, bottom: b.bottom };
  };
  const vis = (el) => {
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 1;
  };
  window.__chrome = () => {
    const sbEl = document.querySelector('#vrc-statusbar');
    const sb = box(sbEl);
    // 状态栏 4 项：真机 footer-measure.json → 首项 x=10、项间距（下一项左端 − 上一项右端）=23
    const sbItems = sbEl ? [...sbEl.children].map((e) => {
      const b = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return (cs.display === 'none' || cs.visibility === 'hidden') ? null
        : { x: Math.round(b.x), w: Math.round(b.width) };
    }).filter(Boolean) : [];
    const tbEl = document.querySelector('#vrc-topbar');
    const tbKids = [...tbEl.children].map((e) => {
      const b = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return (cs.display === 'none' || cs.visibility === 'hidden' || b.width < 1) ? null : b.right;
    }).filter((v) => v !== null);
    const searchBtn = [...tbEl.querySelectorAll('button')].find((e) => /快速搜索/.test(e.textContent || ''));
    // 顶栏右簇（快速搜索/Ctrl K → 图标组 → 3 窗口控制）：只量簇内可见元素之间的间距，
    // 不量绝对 x。原因：真机 topbar-measure.json 是字形坐标、且截图宽 1689（我们契约视口 1700），
    // 绝对 x 会随窗口宽整体平移、随 roster-toggle 显隐整体让位；间距才是布局契约。
    const tbRight = tbEl.getBoundingClientRect().right;
    const relRight = (el) => Math.round((tbRight - el.getBoundingClientRect().right) * 10) / 10;
    const relLeft = (el) => Math.round((tbRight - el.getBoundingClientRect().left) * 10) / 10;
    const kbd = document.querySelector('[data-topbar="search"] kbd');
    const actEls = [...(document.querySelector('[data-topbar="actions"]')?.children ?? [])].filter(vis);
    const winEls = [...(document.querySelector('[data-topbar="window-controls"]')?.children ?? [])].filter(vis);
    const winRects = winEls.map((e) => e.getBoundingClientRect());
    return {
      theme: document.documentElement.dataset.theme ?? '',
      topbar: box(tbEl),
      statusbar: sb,
      workspace: box(document.querySelector('.workspace')),
      roster: box(document.querySelector('.roster-rail')),
      toggle: box(document.querySelector('.roster-toggle')),
      tbRight: {
        kbdRel: kbd ? relRight(kbd) : null,
        kbdW: kbd ? Math.round(kbd.getBoundingClientRect().width * 10) / 10 : null,
        actCount: actEls.length,
        gapSearchActions: actEls.length && kbd ? Math.round(relRight(kbd) - relLeft(actEls[0])) : null,
        gapActionsWin: winEls.length && actEls.length ? Math.round(relRight(actEls[actEls.length - 1]) - relLeft(winEls[0])) : null,
        winCount: winEls.length,
        winW: winRects.length ? Math.round(winRects[0].width) : null,
        winPitch: winRects.length > 1 ? Math.round(winRects[1].left - winRects[0].left) : null,
        winLastRel: winEls.length ? relRight(winEls[winEls.length - 1]) : null
      },
      sbItems,
      tbRightPad: tbKids.length ? Math.round(window.innerWidth - Math.max(...tbKids)) : null,
      searchW: searchBtn ? Math.round(searchBtn.getBoundingClientRect().width) : null
    };
  };
};

// 展开态：外壳 + 侧栏（导航行高/文本列/滚动/页脚）
const measureFrame = () => {
  const c = window.__chrome();
  const box = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return null;
    return { x: b.x, y: b.y, w: b.width, h: b.height, bottom: b.bottom };
  };
  const aside = document.querySelector('aside.vrc-sidebar');
  const nav = aside.querySelector('nav');
  const kinds = [...nav.querySelectorAll('[data-nav-kind]')];
  const tops = kinds.filter((el) => ['top', 'folder'].includes(el.dataset.navKind));
  const subs = kinds.filter((el) => el.dataset.navKind === 'sub');
  const foot = aside.querySelector('[data-nav-footer]');
  const footRows = [...(foot?.querySelectorAll('[data-nav-kind]') ?? [])];
  const last = kinds[kinds.length - 1];
  nav.scrollTop = nav.scrollHeight;
  const navRect = nav.getBoundingClientRect();
  const lastRect = last.getBoundingClientRect();
  // 文本列：行内第二个 span 的左端相对行左端（顶层/二级同为 30 = 图标列 14 + gap 8 + 行内 padding 8）
  const textCol = (el) => {
    const b = el?.querySelectorAll('span')?.[1]?.getBoundingClientRect();
    return b ? Math.round(b.left - el.getBoundingClientRect().left) : null;
  };
  return {
    ...c,
    sidebar: box(aside),
    topH: tops.length ? [...new Set(tops.map((el) => Math.round(el.getBoundingClientRect().height)))] : [],
    subH: subs.length ? [...new Set(subs.map((el) => Math.round(el.getBoundingClientRect().height)))] : [],
    textTop: textCol(tops[0]),
    textSub: textCol(subs[0]),
    navOverflow: nav.scrollHeight - nav.clientHeight,
    navItems: kinds.length,
    lastBottom: Math.round(lastRect.bottom),
    navBottom: Math.round(navRect.bottom),
    footCount: footRows.length,
    footBottom: foot && footRows.length ? Math.round(Math.max(...footRows.map((el) => el.getBoundingClientRect().bottom))) : null,
    sidebarBottom: Math.round(aside.getBoundingClientRect().bottom)
  };
};

// 收起态：外壳 + 折叠结果（aside 已不存在，只能量顶栏里的展开按钮与让出的整列）
const measureCollapsed = () => {
  const c = window.__chrome();
  const asideGone = !document.querySelector('aside.vrc-sidebar');
  const ex = document.querySelector('[data-testid="nav-expand"]');
  const exR = ex?.getBoundingClientRect();
  return {
    ...c,
    asideGone,
    expand: !!exR && exR.width > 1,
    overflow: document.documentElement.scrollWidth - window.innerWidth
  };
};

// 表格密度：表头列数 + 首列宽（展开/收起同页面同口径比对，收起后内容变宽但列不能少/首列不能变窄）
const measureTable = () => {
  const th = [...document.querySelectorAll('table thead th')];
  if (!th.length) return null;
  const b = th[0].getBoundingClientRect();
  return {
    cols: th.length,
    firstW: Math.round(b.width),
    tableW: Math.round(document.querySelector('table').getBoundingClientRect().width),
    rows: document.querySelectorAll('table tbody tr').length
  };
};

// ── 外壳断言（与侧栏无关，展开/收起共用）：p 为行名前缀 ─────────────────────
const assertChrome = (view, got, width, p = '') => {
  // 顶栏右侧留白：搜索簇右边还有 3 个装饰性窗口按钮（真机形态），只锁「我们自己内容右端距窗口边 8px」
  // 与簇内间距（见下 topbar.win），绝对 x 随视口宽平移不进 FAIL。
  check(view, `${p}topbar.right_pad`, got.tbRightPad, '8±1', got.tbRightPad !== null && Math.abs(got.tbRightPad - 8) <= 1);
  check(view, `${p}topbar.search_w`, got.searchW, '200–240', got.searchW !== null && got.searchW >= 200 && got.searchW <= 240);
  check(view, `${p}topbar.h`, Math.round(got.topbar.h), 39, Math.abs(got.topbar.h - 39) <= 1);
  check(view, `${p}statusbar.h`, Math.round(got.statusbar.h), 35, Math.abs(got.statusbar.h - 35) <= 1);
  const sbGaps = got.sbItems.slice(1).map((it, i) => it.x - (got.sbItems[i].x + got.sbItems[i].w));
  check(view, `${p}statusbar.item_count`, got.sbItems.length, 4, got.sbItems.length === 4);
  check(view, `${p}statusbar.first_x`, got.sbItems[0]?.x, '10±1', Math.abs((got.sbItems[0]?.x ?? -99) - 10) <= 1);
  check(view, `${p}statusbar.gap`, sbGaps.join(','), '23±1', sbGaps.length === 3 && sbGaps.every((g) => Math.abs(g - 23) <= 1));
  const wantRoster = width >= 1440;
  check(view, `${p}roster.visible`, got.roster ? 'yes' : 'no', wantRoster ? 'yes' : 'no', !!got.roster === wantRoster);
  check(view, `${p}roster.toggle_visible`, got.toggle ? 'yes' : 'no', wantRoster ? 'yes' : 'no', !!got.toggle === wantRoster);
  // 顶栏右簇：间距是布局契约（真机 topbar-measure.json 的 pitch/gap 同口径）。窗口控制 3 项、宽 24、
  // pitch 40（真机 pitch 40）、末项距右缘 8（真机 9）；图标组 5 项（<1440 无好友栏开关）/ 6 项（≥1440）。
  const tb = got.tbRight;
  check(view, `${p}topbar.kbd_w`, tb.kbdW, '34±1', tb.kbdW !== null && Math.abs(tb.kbdW - 34) <= 1);
  check(view, `${p}topbar.gap_search_actions`, tb.gapSearchActions, '22±1', tb.gapSearchActions !== null && Math.abs(tb.gapSearchActions - 22) <= 1);
  check(view, `${p}topbar.gap_actions_win`, tb.gapActionsWin, '15±1', tb.gapActionsWin !== null && Math.abs(tb.gapActionsWin - 15) <= 1);
  check(view, `${p}topbar.actions_count`, tb.actCount, wantRoster ? '6' : '5', tb.actCount === (wantRoster ? 6 : 5));
  check(view, `${p}topbar.win`, `${tb.winCount}×${tb.winW} pitch${tb.winPitch} @${tb.winLastRel}`,
    '3×24 pitch40，末项距右缘 8±1',
    tb.winCount === 3 && tb.winW === 24 && tb.winPitch === 40 && Math.abs(tb.winLastRel - 8) <= 1);
  check(view, `${p}content.w`, Math.round(got.workspace.w), '≥720', got.workspace.w >= 720);
};

// ── 侧栏断言（只在展开态成立）────────────────────────────────────────────────
const assertNav = (view, got, width, p = '') => {
  const wide = width >= 1280;
  check(view, `${p}sidebar.w`, Math.round(got.sidebar.w), wide ? 277 : 214, Math.abs(got.sidebar.w - (wide ? 277 : 214)) <= 1);
  check(view, `${p}nav.top_h`, got.topH.join(','), '36', got.topH.length === 1 && got.topH[0] === 36);
  check(view, `${p}nav.sub_h`, got.subH.join(','), '31', got.subH.length === 1 && got.subH[0] === 31);
  check(view, `${p}nav.text_col`, `top+${got.textTop} / sub+${got.textSub}`, '30±1 / 30±1',
    got.textTop !== null && Math.abs(got.textTop - 30) <= 1 && got.textSub !== null && Math.abs(got.textSub - 30) <= 1);
  // 装不下时必须靠滚动（scrollHeight > clientHeight），且滚到底最后一项完整可见
  check(view, `${p}nav.scrollable`, `${got.navOverflow}px`, '≥0 且滚到底可见末项',
    got.navOverflow >= 0 && got.lastBottom <= got.navBottom + 1);
  check(view, `${p}nav.footer_count`, got.footCount, 2, got.footCount === 2);
  check(view, `${p}nav.footer_visible`, `${got.footBottom} / ${Math.min(got.sidebarBottom, got.statusbar.y)}`,
    '页脚在侧栏内且高于状态栏', got.footBottom !== null && got.footBottom <= Math.min(got.sidebarBottom, got.statusbar.y) + 1);
};

// 展开态整套（浅色 / 深色共用）
const assertFrame = (view, got, width, p = '') => {
  assertChrome(view, got, width, p);
  assertNav(view, got, width, p);
};

// 收起态整套：外壳同口径 + 折叠结果
const assertCollapsed = (view, got, width, p = '', freed = null) => {
  assertChrome(view, got, width, p);
  const col = width >= 1280 ? 277 : 214;
  check(view, `${p}aside_gone`, got.asideGone ? 'gone' : 'still there', 'gone', got.asideGone);
  check(view, `${p}expand_btn`, got.expand ? 'visible' : 'missing', 'visible', got.expand);
  check(view, `${p}content_freed`, `${freed}px`, `${col}±1`, freed !== null && Math.abs(freed - col) <= 1);
  check(view, `${p}overflow`, got.overflow, '≤0', got.overflow <= 0);
};

const collapse = async (tab) => tab.evaluate(() => {
  document.querySelector('[data-testid="nav-collapse"]')?.click();
  return true;
});

// 展开态表格密度基线：逐页记列数/首列宽/表宽（收起后逐页比对，浅/深色共用一个取样器）
const collectDensity = async (tab) => {
  const density = {};
  for (const p of PAGES) {
    await gotoVrc(tab, `${PAGE}#/${p}`);
    await tab.waitForTimeout(600);
    density[p] = await tab.evaluate(measureTable);
  }
  return density;
};

// 收起态逐页：6 个页面都必须无横向溢出、内容面板仍 ≥720（收起是为了让宽，不是把内容挤窄）；
// 表格页列数不变、首列不变窄、行数不变（内容变宽不该靠牺牲密度换）。浅色收起 / 深色收起共用这一套。
const checkCollapsedPages = async (tab, view, prefix, baseline) => {
  for (const p of PAGES) {
    await gotoVrc(tab, `${PAGE}#/${p}`);
    await tab.waitForTimeout(600);
    const o = await tab.evaluate(() => ({
      vw: window.innerWidth,
      w: document.documentElement.scrollWidth,
      ws: Math.round(document.querySelector('.workspace').getBoundingClientRect().width)
    }));
    check(view, `${prefix}coll.overflow.${p}`, o.w, `≤${o.vw + 1}`, o.w <= o.vw + 1);
    // 收起态每一页的内容列都得留得住 ≥720（此前只有 settings/friends 量过宽度）
    check(view, `${prefix}coll.content.${p}`, o.ws, '≥720', o.ws >= 720);
    const before = baseline[p];
    if (before) {
      const after = await tab.evaluate(measureTable);
      check(view, `${prefix}coll.density.${p}`,
        after ? `${after.cols}col 首列${after.firstW}/${before.firstW} 表${after.tableW}` : 'no table',
        `${before.cols}col 首列≥${before.firstW}`,
        !!after && after.cols === before.cols && after.firstW >= before.firstW - 1 && after.rows === before.rows);
    }
  }
};

// 收起 × 右栏开关（≥1440 才有右栏）：右栏是 .workspace 内部的 flex 列，所以关掉它
// .workspace 本身不变宽（仍是整块面板），让出来的是**内容列**——内容列必须正好多出一个右栏宽、
// 且不撑出横向溢出；再开回来内容列/右栏宽度复原（收起/右栏两个开关不该互相打架）。
// 浅色收起 / 深色收起共用这一套（主题不该改变让宽结果）。
const checkRosterCombo = async (tab, view, p, expRosterW = null) => {
  const combo = await tab.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const me = () => ({
      ws: Math.round(document.querySelector('.workspace').getBoundingClientRect().width),
      content: Math.round(document.querySelector('.workspace > div')?.getBoundingClientRect().width ?? 0),
      roster: !!document.querySelector('.roster-rail'),
      rosterW: Math.round(document.querySelector('.roster-rail')?.getBoundingClientRect().width ?? 0),
      ovf: document.documentElement.scrollWidth - window.innerWidth
    });
    const btn = document.querySelector('#vrc-topbar .roster-toggle');
    if (!btn) return { btn: false };
    const a = me();
    btn.click();
    await wait(350);
    const off = me();
    btn.click();
    await wait(350);
    const on = me();
    return { btn: true, a, off, on, asideGone: !document.querySelector('aside.vrc-sidebar') };
  });
  check(view, `${p}roster.btn`, combo.btn ? 'present' : 'missing', 'present', combo.btn === true);
  if (!combo.btn) return;
  // 收起侧栏不该顺手改右栏宽度：收起态右栏恒 353，且与展开态基线相等（关掉再开回来也不变）
  check(view, `${p}roster.w`, `${combo.a.rosterW}/${expRosterW} → ${combo.on.rosterW}`,
    '353 且与展开态相等（开回来不变）',
    combo.a.rosterW === 353 && combo.a.rosterW === expRosterW && combo.on.rosterW === combo.a.rosterW);
  check(view, `${p}roster.off`,
    `${combo.off.roster ? 'shown' : 'hidden'} content ${combo.a.content}→${combo.off.content} / roster${combo.a.rosterW} ws${combo.off.ws} ovf${combo.off.ovf}`,
    'hidden 且内容列 += 右栏宽、workspace 不变、无溢出',
    !combo.off.roster && Math.abs(combo.off.content - (combo.a.content + combo.a.rosterW)) <= 2
      && combo.off.ws === combo.a.ws && combo.off.ovf <= 0);
  check(view, `${p}roster.restore`,
    `content ${combo.on.content}/${combo.a.content} ${combo.on.roster ? 'shown' : 'hidden'} w${combo.on.rosterW}`,
    `content 回${combo.a.content} 且右栏${combo.a.rosterW} 回来`,
    combo.on.roster && combo.on.content === combo.a.content && combo.on.rosterW === combo.a.rosterW);
  check(view, `${p}roster.aside_gone`, combo.asideGone ? 'gone' : 'back', 'gone', combo.asideGone);
};

// 收起态 friends 页：右栏本身就不该渲染（App.jsx roster && page!=='friends'），
// 内容也不能因为没了侧栏而宽度塌掉（≥720 是外壳契约，9 视口全跑）。
const checkCollapsedFriends = async (tab, view, p) => {
  await gotoVrc(tab, `${PAGE}#/friends`);
  await tab.waitForTimeout(700);
  const fd = await tab.evaluate(() => ({
    roster: !!document.querySelector('.roster-rail'),
    ws: Math.round(document.querySelector('.workspace').getBoundingClientRect().width),
    asideGone: !document.querySelector('aside.vrc-sidebar'),
    ovf: document.documentElement.scrollWidth - window.innerWidth
  }));
  check(view, `${p}friends.roster`, fd.roster ? 'rendered' : 'not rendered', 'not rendered', !fd.roster);
  check(view, `${p}friends.content_w`, fd.ws, '≥720', fd.ws >= 720 && fd.asideGone && fd.ovf <= 0);
};

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

// ── 第一轮：浅色 + 侧栏展开 → 收起（同一页面顺序做，收起态不必重载）──────────
for (const [width, height] of VIEWS) {
  const view = `${width}x${height}`;
  const tab = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: false });
  const overflow = [];

  // 新用户默认态：这个 page 是新 context（无 localStorage），必须展开 —— 侧栏在、无展开按钮、
  // 也没有 vrc-nav-collapsed 键。防「默认收起」这类回归（收起只该由用户点出来）。
  await gotoVrc(tab, `${PAGE}#/settings`);
  await tab.waitForSelector('aside.vrc-sidebar [data-nav-id]', { timeout: 30_000 });
  const fresh = await tab.evaluate(() => ({
    aside: !!document.querySelector('aside.vrc-sidebar'),
    expand: !!document.querySelector('[data-testid="nav-expand"]'),
    stored: localStorage.getItem('vrc-nav-collapsed')
  }));
  check(view, 'fresh.aside', fresh.aside ? 'present' : 'missing', 'present', fresh.aside);
  check(view, 'fresh.no_expand_btn', fresh.expand ? 'visible' : 'absent', 'absent', !fresh.expand);
  // App.jsx 挂载时会写一次 '0'（useEffect 落盘），所以「默认态」的判据是键值≠'1' 而不是键不存在
  check(view, 'fresh.stored', fresh.stored, '≠1', fresh.stored !== '1');

  for (const p of PAGES) {
    await gotoVrc(tab, `${PAGE}#/${p}`);
    await tab.waitForTimeout(900);
    await assertVrcPage(tab, `${p}@${view}`);
    await tab.waitForFunction(() => {
      const th = document.querySelector('thead');
      return !th || !!document.querySelector('tbody tr');
    }, { timeout: 6000 }).catch(() => {});
    const o = await tab.evaluate(() => ({ vw: window.innerWidth, w: document.documentElement.scrollWidth }));
    const ok = o.w <= o.vw + 1;
    check(view, `overflow.${p}`, o.w, `≤${o.vw + 1}`, ok);
    if (!ok) overflow.push(p);
  }

  await tab.evaluate(installChrome);
  const got = await tab.evaluate(measureFrame);
  assertFrame(view, got, width, '');
  // 展开态右栏宽基线（收起态要跟它比：收起只该让宽，不该改右栏）
  const expRosterW = Math.round(got.roster?.w ?? 0);

  // 展开态密度基线：表格页记录列数/首列宽/表宽（收起后要逐页对比）
  const density = await collectDensity(tab);

  // 浅色 + 收起：外壳同一套断言 + 整列让宽（此前收起态只在深色轮量 4 个高度）
  await gotoVrc(tab, `${PAGE}#/settings`);
  await tab.waitForTimeout(300);
  await collapse(tab);
  await tab.waitForTimeout(350);

  await checkCollapsedPages(tab, view, '', density);
  // 停回 settings：展开态那次量测也是 settings，两轮同页面同口径
  await gotoVrc(tab, `${PAGE}#/settings`);
  await tab.waitForTimeout(400);
  const lc = await tab.evaluate(measureCollapsed);
  assertCollapsed(view, lc, width, 'lcoll.', got.workspace.x - lc.workspace.x);

  if (width >= 1440) await checkRosterCombo(tab, view, 'lcoll.', expRosterW);
  await checkCollapsedFriends(tab, view, 'lcoll.');
  lightColl.set(view, { ws: Math.round(lc.workspace.w), rosterW: Math.round(lc.roster?.w ?? 0) });
  await tab.close();
}

// ── 第二轮：深色主题（展开）→ 深色 + 收起（组合态）──────────────────────────
// 深色轮跑 assertFrame 全套：主题只改色，侧栏宽/行高/文本列/状态栏项距/顶栏右簇/页脚/
// 右栏显隐都该与浅色一致；收起轮验证「主题 + 折叠」互不影响几何。
for (const [width, height] of VIEWS) {
  const view = `${width}x${height}`;
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  // 主题存 localStorage（vrc-theme），导航收起态存 vrc-nav-collapsed
  await ctx.addInitScript(() => { try { localStorage.setItem('vrc-theme', 'dark'); } catch {} });
  const tab = await ctx.newPage();
  // 量测页用 settings：右栏（roster）在 friends 页刻意不渲染（App.jsx: roster && page !== 'friends'），
  // 浅色轮最后一页也是 settings，两轮同页面同口径。
  await gotoVrc(tab, `${PAGE}#/settings`);
  await tab.waitForSelector('aside.vrc-sidebar [data-nav-id]', { timeout: 30_000 });
  await tab.waitForTimeout(400);
  await assertVrcPage(tab, `dark@${view}`);

  await tab.evaluate(installChrome);
  const got = await tab.evaluate(measureFrame);
  check(view, 'dark.theme', got.theme, 'dark', got.theme === 'dark');
  assertFrame(view, got, width, 'dark.');
  const darkOverflow = await tab.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(view, 'dark.overflow', darkOverflow, '≤0', darkOverflow <= 0);

  // 深色展开态密度基线 → 深色收起逐页（主题不影响密度：列数/首列/行数与深色展开态比）
  const darkDensity = await collectDensity(tab);
  await gotoVrc(tab, `${PAGE}#/settings`);
  await tab.waitForTimeout(300);
  await collapse(tab);
  await tab.waitForTimeout(350);
  await checkCollapsedPages(tab, view, 'dark.', darkDensity);
  await gotoVrc(tab, `${PAGE}#/settings`);
  await tab.waitForTimeout(400);

  const expDarkRosterW = Math.round(got.roster?.w ?? 0);
  const dc = await tab.evaluate(measureCollapsed);
  check(view, 'dcoll.theme', dc.theme, 'dark', dc.theme === 'dark');
  assertCollapsed(view, dc, width, 'dcoll.', got.workspace.x - dc.workspace.x);

  // 主题不该改宽度：同一视口浅色收起与深色收起的内容面板宽必须一致（右栏宽同理）
  const light = lightColl.get(view);
  check(view, 'dcoll.same_width_as_light',
    `${Math.round(dc.workspace.w)}/${light?.ws} roster${Math.round(dc.roster?.w ?? 0)}/${light?.rosterW}`,
    '面板宽与右栏宽均等于浅色收起态',
    !!light && Math.round(dc.workspace.w) === light.ws && Math.round(dc.roster?.w ?? 0) === light.rosterW);

  // 深色收起也跑「收起 × 右栏开关」与 friends 页（此前只有浅色轮有，主题+折叠组合态没量过）
  if (width >= 1440) await checkRosterCombo(tab, view, 'dcoll.', expDarkRosterW);
  await checkCollapsedFriends(tab, view, 'dcoll.');
  await ctx.close();
}

await browser.close();
const pass = rows.filter((r) => r.ok).length;
const result = { at: new Date().toISOString(), base: BASE, pass, total: rows.length, rows };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
console.log(`主框架/导航密度 ${pass}/${rows.length} ${pass === rows.length ? '→ FRAME OK' : '→ 有 FAIL'}`);
if (pass !== rows.length) process.exit(1);
