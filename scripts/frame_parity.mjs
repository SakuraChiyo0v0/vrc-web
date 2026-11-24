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
 *      展开态逐页再量外壳：顶栏 39 / 状态栏 35 / workspace y=顶栏高、h=视口−顶栏−状态栏（±1），
 *      侧栏在位且宽恒 214|277（换页不该改侧栏宽）。收起态同一套在 checkCollapsedPages 里。
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
 *  13) 展开态收放折叠夹（收藏 / 社交）：子项归 0 时侧栏宽、内容列宽、顶栏 39、状态栏 35、
 *      内容区 y·h 一律不变、无溢出，展开回来复原；feed / friends 两页 × 浅/深色各一遍。
 *      另验「夹子真的省高度」：首项→末项实际内容高至少减掉子项高一半，<nav> 本溢出的视口上
 *      scrollHeight 也必须跟着降（内容矮于视口时 scrollHeight 恒等于 clientHeight，不作要求）。
 *  14) 矮窗（600 高）展开态 <nav> 滚到底：window.scrollY 仍 0、顶栏仍 y0、内容区 y/h 不变、
 *      末项整行在 nav 可视区内、内容区顶部 elementFromPoint 仍命中 .workspace（不被粘性顶盖住）。
 *  15) 右栏拖宽（1600 / 1700 两档，浅/深各一遍）：手柄中心 elementFromPoint 必须落在手柄上
 *      （回归：轨道曾放在 left:-11，被栏上的 overflow-x:clip 整条裁掉，拖宽完全失效）；拖窄
 *      后右栏变窄、内容列正好加同样差值、无溢出、松手落 localStorage、reload 保持、拖回 353
 *      复原、双击复位到 353。
 *  16) 右栏自身折成 36px 竖条（⋯ 按钮，≥1440 三档 × 浅/深）：竖条宽恒 36、拖宽手柄消失、
 *      内容列正好接过让出的 353−36、面板总宽不变、无溢出；在竖条左缘按下左拖也不改宽/不写盘，
 *      点 ‹ 展开回来宽度=折叠前且手柄回来。
 *
 * 任一 FAIL 退出码 1；全 PASS 打印 FRAME OK，并把结果写 docs/ref/frame-parity.json。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { normBase, pageBase, assertVrcPage, gotoVrc, reloadVrcHard } from './lib/page_structure.mjs';

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
// 表格内容是接口回来才渲染的，量早了会量到半截列表（基线行数偏小）或干脆量到 no table
// （feed 收起态曾 5 条假红）。量前先等「表出现 + 行数/列数两次读数一致」；没有表格的页
// （settings 等）最多等 tableTimeout 就放弃，别白等。
const waitDensity = async (tab, want = null, tableTimeout = 3000, timeout = 15000) => {
  const t0 = Date.now();
  let seenTable = false;
  let last = null;
  while (Date.now() - t0 < timeout) {
    const m = await tab.evaluate(measureTable);
    if (m) {
      seenTable = true;
      const ok = want
        ? m.rows === want.rows && m.cols === want.cols
        : last && last.rows === m.rows && last.cols === m.cols;
      if (ok) return m;
    } else if (!want && !seenTable && Date.now() - t0 > tableTimeout) {
      return null;
    }
    last = m;
    await tab.waitForTimeout(250);
  }
  return tab.evaluate(measureTable);
};

const collectDensity = async (tab) => {
  const density = {};
  for (const p of PAGES) {
    await gotoVrc(tab, `${PAGE}#/${p}`);
    await tab.waitForTimeout(600);
    density[p] = await waitDensity(tab);
  }
  return density;
};

// 收起态逐页：6 个页面都必须无横向溢出、内容面板仍 ≥720（收起是为了让宽，不是把内容挤窄）；
// 表格页列数不变、首列不变窄、行数不变（内容变宽不该靠牺牲密度换）。浅色收起 / 深色收起共用这一套。
const checkCollapsedPages = async (tab, view, prefix, baseline) => {
  for (const p of PAGES) {
    await gotoVrc(tab, `${PAGE}#/${p}`);
    await tab.waitForTimeout(600);
    const o = await tab.evaluate(() => {
      const tb = document.querySelector('#vrc-topbar').getBoundingClientRect();
      const sb = document.querySelector('#vrc-statusbar').getBoundingClientRect();
      const ws = document.querySelector('.workspace').getBoundingClientRect();
      return {
        vw: window.innerWidth,
        vh: window.innerHeight,
        w: document.documentElement.scrollWidth,
        ws: Math.round(ws.width),
        wsY: Math.round(ws.y * 10) / 10,
        wsH: Math.round(ws.height * 10) / 10,
        tbH: Math.round(tb.height * 10) / 10,
        sbH: Math.round(sb.height * 10) / 10
      };
    });
    check(view, `${prefix}coll.overflow.${p}`, o.w, `≤${o.vw + 1}`, o.w <= o.vw + 1);
    // 逐页外壳高度：换页不该让顶栏/状态栏变高，内容区必须正好填满中间那段
    // （workspace.y=顶栏高、height=视口−顶栏−状态栏，±1）。此前这两项只在 settings 量一次。
    check(view, `${prefix}coll.topbar_h.${p}`, o.tbH, '39±1', Math.abs(o.tbH - 39) <= 1);
    check(view, `${prefix}coll.statusbar_h.${p}`, o.sbH, '35±1', Math.abs(o.sbH - 35) <= 1);
    const fillWant = Math.round(o.vh - o.tbH - o.sbH - 0.5);
    check(view, `${prefix}coll.fill.${p}`, `y${o.wsY} h${o.wsH}`, `y${o.tbH} h${fillWant}±1`,
      Math.abs(o.wsY - o.tbH) <= 1 && Math.abs(o.wsH - (o.vh - o.tbH - o.sbH)) <= 1);
    // 收起态每一页的内容列都得留得住 ≥720（此前只有 settings/friends 量过宽度）
    check(view, `${prefix}coll.content.${p}`, o.ws, '≥720', o.ws >= 720);
    const before = baseline[p];
    if (before) {
      // 收起态同样等接口渲染到与基线同一规模（行/列对得上）再量
      const after = await waitDensity(tab, before);
      check(view, `${prefix}coll.density.${p}`,
        after ? `${after.cols}col 首列${after.firstW}/${before.firstW} 行${after.rows}/${before.rows} 表${after.tableW}` : 'no table',
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

// 右栏自身折叠成 36px 竖条（RosterPanel 里的 ⋯ 折叠按钮）时，拖宽手柄必须消失、也不许被误拖：
// 竖条分支（RosterPanel collapsed）根本不渲染 roster-resize，但折叠/展开切换若不重建元素，
// 残留手柄会让竖条仍可拖、把宽度写进 localStorage，破坏「展开回来还是 353」。
// 展开回来还要复原到展开前宽度（浅/深各一遍，只在 ≥1600 有拖宽能力的档位跑）。
const checkRosterDragCollapsed = async (tab, view, p, baseW) => {
  const probe = () => tab.evaluate(() => {
    const rail = document.querySelector('[data-testid="roster-rail"]');
    const b = rail?.getBoundingClientRect();
    return {
      present: !!rail,
      collapsed: rail?.dataset.collapsed,
      w: Math.round(b?.width ?? 0), x: Math.round(b?.x ?? 0),
      y: Math.round(b?.y ?? 0), h: Math.round(b?.h ?? b?.height ?? 0),
      handle: !!document.querySelector('[data-testid="roster-resize"]'),
      stored: localStorage.getItem('vrc-roster-w'),
      content: Math.round(document.querySelector('.workspace > div')?.getBoundingClientRect().width ?? 0),
      ws: Math.round(document.querySelector('.workspace').getBoundingClientRect().width),
      ovf: document.documentElement.scrollWidth - window.innerWidth
    };
  });
  const a = await probe();
  await tab.evaluate(() => document.querySelector('.roster-self-menu')?.click());
  await tab.waitForTimeout(350);
  const c = await probe();
  // 折成竖条是「让宽」不是「压窄」：内容列必须正好接过右栏让出的那一截（353−36），
  // 面板总宽不变、也不撑出横向溢出——只看竖条宽 36 量不到「内容列被吃掉」这类回归。
  check(view, `${p}rs_coll.gone`,
    `w${a.w}→${c.w} collapsed=${c.collapsed} handle=${c.handle ? 'present' : 'none'} content ${a.content}→${c.content} ws${c.ws}/${a.ws} ovf${c.ovf}`,
    `折成 36px 竖条、拖宽手柄消失、内容列 += ${a.w - 36}`,
    a.handle && c.present && c.collapsed === 'true' && Math.abs(c.w - 36) <= 1 && !c.handle
      && Math.abs((c.content - a.content) - (a.w - 36)) <= 2 && c.ws === a.ws && c.ovf <= 0);
  // 在「手柄本该在的位置」（竖条左缘）按下向左拖 120px：宽度/落盘都不许动
  const gy = c.y + Math.round(c.h / 2);
  await tab.mouse.move(c.x + 4, gy);
  await tab.waitForTimeout(100);
  await tab.mouse.down();
  await tab.waitForTimeout(120);
  await tab.mouse.move(c.x + 4 - 120, gy, { steps: 5 });
  await tab.waitForTimeout(120);
  await tab.mouse.up();
  await tab.waitForTimeout(300);
  const d = await probe();
  check(view, `${p}rs_coll.inert`, `w${c.w}→${d.w} ws${c.ws}→${d.ws} stored ${c.stored}→${d.stored}`,
    `拖不动：竖条宽/内容列不变、落盘仍是 ${baseW}`,
    d.w === c.w && d.ws === c.ws && d.ovf <= 0 && d.stored === c.stored
      && (d.stored === null || d.stored === String(baseW)));
  // 点竖条上的 ‹ 展开：回到展开前宽度、手柄回来
  await tab.evaluate(() => document.querySelector('.roster-rail [aria-label="展开好友面板"]')?.click());
  await tab.waitForTimeout(350);
  const e = await probe();
  check(view, `${p}rs_coll.restore`, `w${d.w}→${e.w}/${a.w} handle=${e.handle ? 'present' : 'none'}`,
    '展开回来宽度=展开前、手柄回来',
    e.present && e.collapsed === 'false' && e.w === a.w && e.handle && e.ovf <= 0);
};

// 右栏宽度是用户可写的 localStorage（vrc-roster-w），RosterPanel 在挂载时读一次就定死：
// 脏值 / 越界值必须回落到 353 默认（Number('abc')=NaN、'99999' 会把内容列挤成负宽），
// 合法值（264 底 / 280 常用 / 770 顶）必须原样生效。只在 ≥1440（有右栏的档位）浅色跑，
// 逻辑在 React state 里、与主题无关。
const checkRosterDirtyW = async (tab, view, p) => {
  await gotoVrc(tab, `${PAGE}#/settings`);
  await tab.waitForTimeout(400);
  const CASES = [['abc', 353], ['99999', 353], ['-5', 353], ['0', 353], ['264', 264], ['280', 280], ['770', 770]];
  for (const [stored, want] of CASES) {
    await tab.evaluate((v) => localStorage.setItem('vrc-roster-w', v), stored);
    // reloadVrcHard 会验「文档真的换新了」，静默失败（超时 + goto 兜底也没成）时再硬刷一次：
    // 否则 DOM 还是上一条用例的，读出来的宽度会假 PASS/假 FAIL（第 30 轮 exp.dirty.264/280 就这么红过）。
    const ok = await reloadVrcHard(tab, `dirty.${stored}`);
    await tab.waitForSelector('[data-testid="roster-resize"]', { timeout: 30_000 }).catch(() => {});
    await tab.waitForTimeout(500);
    const m = await tab.evaluate(() => {
      const r = document.querySelector('[data-testid="roster-rail"]');
      return {
        w: Math.round(r?.getBoundingClientRect().width ?? 0),
        handle: !!document.querySelector('[data-testid="roster-resize"]'),
        content: Math.round(document.querySelector('.workspace > div')?.getBoundingClientRect().width ?? 0),
        ws: Math.round(document.querySelector('.workspace').getBoundingClientRect().width),
        ovf: document.documentElement.scrollWidth - window.innerWidth
      };
    });
    check(view, `${p}dirty.${stored}`,
      `w${m.w}/${want} 内容${m.content} ws${m.ws} ovf${m.ovf} 手柄${m.handle ? 'present' : 'none'} reload${ok ? 'fresh' : 'STALE'}`,
      `右栏 ${want}、内容列 = ws−${want}、无溢出、手柄在`,
      ok && m.w === want && m.handle && m.ws === m.content + want && m.ovf <= 0);
  }
  // 复位成默认 353，不给后面的收起轮留脏值
  await tab.evaluate(() => localStorage.setItem('vrc-roster-w', '353'));
  await reloadVrcHard(tab, 'dirty.reset');
  await tab.waitForTimeout(600);
  await tab.evaluate(installChrome);
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

// 展开态折叠夹收放：侧栏里的折叠夹（收藏 / 社交）只该改 <nav> 内部的内容高，不该改侧栏宽、
// 内容面板宽或外壳高度，也不该撑出横向溢出 —— 侧栏是独立列，收放夹子触发的重排最容易把内容
// 列挤窄、或把整页推宽（这类回归只看「子项 N→0→N」是量不到的）。浅色 / 深色展开各跑一遍。
const checkFoldImpact = async (tab, view, p) => {
  for (const p2 of ['feed', 'friends']) {
    await gotoVrc(tab, `${PAGE}#/${p2}`);
    await tab.waitForTimeout(650);
    const r = await tab.evaluate(async () => {
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      const me = () => {
        const as = document.querySelector('aside.vrc-sidebar')?.getBoundingClientRect();
        const ws = document.querySelector('.workspace').getBoundingClientRect();
        const tb = document.querySelector('#vrc-topbar').getBoundingClientRect();
        const sb = document.querySelector('#vrc-statusbar').getBoundingClientRect();
        // 侧栏内容真的变短了吗：<nav> 的 scrollHeight 只在溢出时才反映内容高（内容比视口矮时
        // 会被拉到 clientHeight），所以同时量「首项 top → 末项 bottom」的实际高度，任何视口都成立。
        const nav = document.querySelector('aside.vrc-sidebar nav');
        nav.scrollTop = 0;
        const items = [...nav.querySelectorAll('[data-nav-kind]')];
        const firstR = items[0].getBoundingClientRect();
        const lastR = items[items.length - 1].getBoundingClientRect();
        return {
          asideW: as ? Math.round(as.width) : 0,
          ws: Math.round(ws.width),
          wsY: Math.round(ws.y * 10) / 10,
          wsH: Math.round(ws.height * 10) / 10,
          tbH: Math.round(tb.height * 10) / 10,
          sbH: Math.round(sb.height * 10) / 10,
          subs: document.querySelectorAll('aside.vrc-sidebar [data-nav-kind="sub"]').length,
          navSh: nav.scrollHeight,
          navCh: nav.clientHeight,
          extent: Math.round(lastR.bottom - firstR.top),
          subH: Math.round([...nav.querySelectorAll('[data-nav-kind="sub"]')]
            .reduce((s, el) => s + el.getBoundingClientRect().height, 0)),
          ovf: document.documentElement.scrollWidth - window.innerWidth
        };
      };
      const heads = [...document.querySelectorAll('aside.vrc-sidebar [data-nav-kind="folder"]')];
      const a = me();
      for (const h of heads) { h.click(); await wait(120); }
      await wait(250);
      const off = me();
      for (const h of heads) { h.click(); await wait(120); }
      await wait(250);
      const on = me();
      return { n: heads.length, a, off, on };
    });
    check(view, `${p}fold.${p2}.open`, `${r.n} 夹 sub ${r.a.subs}→${r.off.subs}→${r.on.subs}`,
      '夹子收起后 sub=0，展开回来是原数', r.n >= 1 && r.a.subs > 0 && r.off.subs === 0 && r.on.subs === r.a.subs);
    // 夹子全收起来 → 侧栏宽/内容列/顶栏/状态栏/内容区 y·h 一律不变，且不撑宽
    check(view, `${p}fold.${p2}.layout`,
      `aside ${r.a.asideW}→${r.off.asideW} ws ${r.a.ws}→${r.off.ws} y${r.off.wsY} h${r.off.wsH} ovf${r.off.ovf}`,
      '侧栏宽/内容列/外壳高度不变、无溢出',
      r.off.asideW === r.a.asideW && r.off.ws === r.a.ws
        && Math.abs(r.off.wsY - r.a.wsY) <= 1 && Math.abs(r.off.wsH - r.a.wsH) <= 1
        && Math.abs(r.off.tbH - r.a.tbH) <= 1 && Math.abs(r.off.sbH - r.a.sbH) <= 1
        && r.off.ovf <= 0);
    // 夹子收起来必须真的省下侧栏高度（此前只验「几何不变」，可折叠却没折叠住内容也量不到）：
    // 首项→末项的实际内容高至少减掉「子项高之和的一半」；在 <nav> 本来溢出的视口上，
    // scrollHeight 也必须跟着变小（内容矮于视口时 scrollHeight 恒等于 clientHeight，不作要求）。
    const shrink = r.a.extent - r.off.extent;
    check(view, `${p}fold.${p2}.shrink`,
      `extent ${r.a.extent}→${r.off.extent} (−${shrink}，子项 ${r.a.subH}) sh ${r.a.navSh}→${r.off.navSh} ch${r.a.navCh}`,
      '内容高减 ≥ 子项高一半；溢出时 scrollHeight 也降',
      r.a.subs > 0 && shrink >= r.a.subH / 2 && (r.a.navSh <= r.a.navCh || r.off.navSh < r.a.navSh));
    check(view, `${p}fold.${p2}.restore`, `ws ${r.on.ws}/${r.a.ws} aside ${r.on.asideW}/${r.a.asideW} sub${r.on.subs} extent ${r.on.extent}/${r.a.extent}`,
      `ws 回 ${r.a.ws}、侧栏宽回 ${r.a.asideW}、内容高回 ${r.a.extent}`,
      r.on.ws === r.a.ws && r.on.asideW === r.a.asideW && r.on.ovf <= 0 && r.on.subs === r.a.subs
        && r.on.extent === r.a.extent && r.on.navSh === r.a.navSh);
  }
};

// 矮窗（600 高）展开态：侧栏装不下只能靠 <nav> 内部滚动。滚到底之后页面本身不许跟着滚
// （window.scrollY 仍是 0）、顶栏仍在 y0、内容区 y/h 不变、末项整行落在 <nav> 可视区内，
// 内容区顶部那一小块点的还是内容区里的东西（没被「粘性顶」盖住）。
const checkNavScroll = async (tab, view, p) => {
  await gotoVrc(tab, `${PAGE}#/settings`);
  await tab.waitForTimeout(500);
  const r = await tab.evaluate(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const nav = document.querySelector('aside.vrc-sidebar nav');
    const me = () => {
      const ws = document.querySelector('.workspace').getBoundingClientRect();
      const tb = document.querySelector('#vrc-topbar').getBoundingClientRect();
      return {
        wsY: Math.round(ws.y * 10) / 10,
        wsH: Math.round(ws.height * 10) / 10,
        tbY: Math.round(tb.y),
        scrollY: Math.round(window.scrollY),
        navTop: Math.round(nav.scrollTop)
      };
    };
    const a = me();
    nav.scrollTop = nav.scrollHeight;
    await wait(300);
    const b = me();
    const last = [...nav.querySelectorAll('[data-nav-kind]')].pop();
    const lastR = last.getBoundingClientRect();
    const navR = nav.getBoundingClientRect();
    const t = document.elementFromPoint(navR.right + 30, b.wsY + 10);
    const wsEl = document.querySelector('.workspace');
    return {
      a, b,
      overflow: nav.scrollHeight - nav.clientHeight,
      lastBottom: Math.round(lastR.bottom),
      navBottom: Math.round(navR.bottom),
      inWs: !!t && wsEl.contains(t),
      hitEl: t ? String(t.className ?? t.tagName).slice(0, 40) : ''
    };
  });
  check(view, `${p}navscroll.moved`, `${r.a.navTop}→${r.b.navTop} overflow${r.overflow}`, '>0 且溢出 ≥0',
    r.b.navTop > 0 && r.overflow >= 0);
  check(view, `${p}navscroll.chrome`,
    `ws y${r.a.wsY}→${r.b.wsY} h${r.a.wsH}→${r.b.wsH} tbY${r.b.tbY} scrollY${r.b.scrollY}`,
    '页面不跟滚（scrollY=0）、顶栏 y0、内容区 y/h 不变',
    r.b.scrollY === 0 && r.b.tbY === 0 && r.a.wsY === r.b.wsY && r.a.wsH === r.b.wsH);
  check(view, `${p}navscroll.last`, `${r.lastBottom} ≤ ${r.navBottom}`, '末项整行在 nav 可视区内',
    r.lastBottom <= r.navBottom + 1);
  check(view, `${p}navscroll.no_cover`, r.inWs ? 'inside workspace' : `covered by ${r.hitEl}`,
    '内容区顶部仍点到内容区（不被顶栏盖住）', r.inWs === true);
};

// 右栏拖宽（≥1600 两档）：手柄必须真的点得到（此前 left:-11 被栏上的 overflow-x:clip 整条裁掉，
// elementFromPoint 命中的是内容列，拖宽完全失效）；拖窄后右栏变窄、内容列正好加上这个差值、无溢出，
// 松手落 localStorage 且 reload 后宽度保持；再拖回 353 复原；双击手柄复位到 353。
const checkRosterDrag = async (tab, view, p) => {
  await gotoVrc(tab, `${PAGE}#/settings`);
  await tab.waitForTimeout(800);
  const probe = () => tab.evaluate(() => {
    const rail = document.querySelector('.roster-rail').getBoundingClientRect();
    const h = document.querySelector('[data-testid="roster-resize"]').getBoundingClientRect();
    const tip = document.elementFromPoint(h.x + h.width / 2, h.y + h.height / 2);
    return {
      rail: Math.round(rail.width),
      content: Math.round(document.querySelector('.workspace > div').getBoundingClientRect().width),
      hx: h.x + h.width / 2, hy: h.y + h.height / 2,
      wsRight: Math.round(document.querySelector('.workspace').getBoundingClientRect().right),
      hitHandle: !!tip && (tip.dataset?.testid === 'roster-resize' || tip.closest?.('[data-testid="roster-resize"]') !== null),
      stored: localStorage.getItem('vrc-roster-w'),
      ovf: document.documentElement.scrollWidth - window.innerWidth
    };
  });
  // 按「目标右栏宽」拖动：宽度公式是 workspaceRight − 指针 x，直接算落点，免去每拖一次差几像素
  const dragTo = async (want) => {
    const h = await probe();
    const dx = (h.wsRight - want) - h.hx;
    await tab.mouse.move(h.hx, h.hy);
    await tab.waitForTimeout(120);
    await tab.mouse.down();
    await tab.waitForTimeout(160); // 等 React 装上 pointermove 监听（太快会整段漏掉）
    await tab.mouse.move(h.hx + dx / 2, h.hy, { steps: 4 });
    await tab.waitForTimeout(90);
    await tab.mouse.move(h.hx + dx, h.hy, { steps: 4 });
    await tab.waitForTimeout(90);
    await tab.mouse.up();
    await tab.waitForTimeout(400);
    return probe();
  };
  const a = await probe();
  check(view, `${p}rs.handle`, a.hitHandle ? 'handle' : 'covered', '手柄中心 elementFromPoint 落在手柄上', a.hitHandle);
  const off = await dragTo(280); // 收窄到 280
  check(view, `${p}rs.narrow`,
    `${a.rail}→${off.rail}，内容 ${a.content}→${off.content}（+${off.content - a.content}）stored ${off.stored}`,
    '右栏 <353−50，内容列 += 右栏差值(±2)，无溢出，宽度已落盘',
    off.rail < a.rail - 50 && Math.abs((off.content - a.content) - (a.rail - off.rail)) <= 2
      && off.ovf <= 0 && off.stored === String(off.rail));
  await reloadVrcHard(tab, 'rs.persist');
  await tab.waitForSelector('[data-testid="roster-resize"]', { timeout: 30_000 });
  await tab.waitForTimeout(800);
  const rl = await probe();
  check(view, `${p}rs.persist`, `${rl.rail}/${off.rail} 内容 ${rl.content}/${off.content}`, '宽与内容列宽度保持',
    rl.rail === off.rail && rl.content === off.content && rl.ovf <= 0);
  // 拖回 353：手柄中心在栏左内 5px，一次拖动的落点会差几个像素，按实测误差再补一次
  let back = await dragTo(a.rail);
  if (back.rail !== a.rail) back = await dragTo(a.rail);
  check(view, `${p}rs.restore`, `${back.rail}/${a.rail} 内容 ${back.content}/${a.content}`,
    '回到 353、内容列回到基线', back.rail === a.rail && back.content === a.content && back.ovf <= 0);
  const h = await probe();
  await tab.mouse.dblclick(h.hx, h.hy);
  await tab.waitForTimeout(350);
  const dbl = await probe();
  check(view, `${p}rs.dblclick_reset`, `${dbl.rail}/${a.rail} stored ${dbl.stored}`, '双击复位到 353 并落盘',
    dbl.rail === a.rail && dbl.stored === '353');
  // reload 会清掉注入的 window.__chrome（下面 assertFrame 还要用），补装一次
  await tab.evaluate(installChrome);
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
    // 展开态逐页外壳：换页不该让顶栏/状态栏变高、内容区必须正好填满中间那段，侧栏宽度也不该
    // 跟着页面变（此前展开态这套只在 settings 量过一次，收起态才逐页量）。
    const sh = await tab.evaluate(() => {
      const tb = document.querySelector('#vrc-topbar').getBoundingClientRect();
      const sb = document.querySelector('#vrc-statusbar').getBoundingClientRect();
      const ws = document.querySelector('.workspace').getBoundingClientRect();
      const as = document.querySelector('aside.vrc-sidebar')?.getBoundingClientRect() ?? null;
      return {
        vh: window.innerHeight,
        tbH: Math.round(tb.height * 10) / 10,
        sbH: Math.round(sb.height * 10) / 10,
        wsY: Math.round(ws.y * 10) / 10,
        wsH: Math.round(ws.height * 10) / 10,
        aside: !!as,
        asideW: as ? Math.round(as.width) : 0
      };
    });
    const colWant = width >= 1280 ? 277 : 214;
    check(view, `exp.topbar_h.${p}`, sh.tbH, '39±1', Math.abs(sh.tbH - 39) <= 1);
    check(view, `exp.statusbar_h.${p}`, sh.sbH, '35±1', Math.abs(sh.sbH - 35) <= 1);
    check(view, `exp.fill.${p}`, `y${sh.wsY} h${sh.wsH}`, `y${sh.tbH} h${Math.round(sh.vh - sh.tbH - sh.sbH)}±1`,
      Math.abs(sh.wsY - sh.tbH) <= 1 && Math.abs(sh.wsH - (sh.vh - sh.tbH - sh.sbH)) <= 1);
    check(view, `exp.aside.${p}`, `${sh.aside ? 'present' : 'missing'} w${sh.asideW}`, `${colWant}±1`,
      sh.aside && Math.abs(sh.asideW - colWant) <= 1);
  }

  await tab.evaluate(installChrome);
  const got = await tab.evaluate(measureFrame);
  assertFrame(view, got, width, '');
  // 展开态右栏宽基线（收起态要跟它比：收起只该让宽，不该改右栏）
  const expRosterW = Math.round(got.roster?.w ?? 0);

  // 展开态密度基线：表格页记录列数/首列宽/表宽（收起后要逐页对比）
  const density = await collectDensity(tab);

  // 展开态：侧栏折叠夹收放不该动内容列/外壳（浅色）；矮窗还要验「nav 滚到底不带动整页」
  await checkFoldImpact(tab, view, 'exp.');
  if (height <= 600) await checkNavScroll(tab, view, 'exp.');
  if (width >= 1600) await checkRosterDrag(tab, view, 'exp.');
  // 右栏宽度记忆的脏值/越界值回落（用户手改 localStorage 也不许把布局撑坏）
  if (width >= 1440) await checkRosterDirtyW(tab, view, 'exp.');

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
  if (width >= 1440) await checkRosterDragCollapsed(tab, view, 'lcoll.', expRosterW);
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
  // 深色展开：折叠夹收放同样不动内容列/外壳；矮窗 nav 滚到底也不带动整页
  await checkFoldImpact(tab, view, 'dark.exp.');
  if (height <= 600) await checkNavScroll(tab, view, 'dark.exp.');
  if (width >= 1600) await checkRosterDrag(tab, view, 'dark.exp.');
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
  if (width >= 1440) await checkRosterDragCollapsed(tab, view, 'dcoll.', expDarkRosterW);
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
