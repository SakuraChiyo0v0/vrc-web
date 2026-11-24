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
 *      （回归：1366×768 曾压到 23）。
 *   3) 导航能滚到底：scrollTop=max 后最后一项完整落在 <nav> 可视区内。
 *   4) 页脚两项（设置 / 收起导航栏）在侧栏可视区内、不被状态栏盖住。
 *   5) 状态栏恒 4 项：首项 x=10、项间距 23（真机 footer-measure.json）。
 *   6) 内容面板 ≥720：右栏（353）只在 ≥1440 出现，且顶栏右栏开关与之一致显隐。
 *   7) 6 个密度最高的页面（好友位置 / 动态 / 好友列表 / 游戏日志 / 世界库 / 设置）
 *      在以上视口都无横向溢出（documentElement.scrollWidth ≤ innerWidth+1）。
 *   8) 顶栏右簇（快速搜索/Ctrl K → 图标组 → 3 窗口控制）的簇内间距恒定：
 *      kbd 宽 34、kbd→图标组 22、图标组→窗口控制 15、窗口控制 3×24 pitch 40、末项距右缘 8。
 *      注：真机 Ctrl K 绝对 x=1307 是在 1689 宽的截图上量的，契约视口是 1700，
 *      差 11px 属窗口宽度差（不是布局差），所以这里只锁间距不锁绝对 x。
 *
 * 9) 深色主题（vrc-theme=dark）下几何与浅色一致：顶栏 39 / 状态栏 35 / 侧栏 214|277 /
 *    顶层 36 / 二级 31 / 文本列 30（顶层与二级相同）、无横向溢出。
 * 10) 收起侧栏（vrc-nav-collapsed）后：侧栏整列消失、顶栏出现展开按钮、顶栏/状态栏不变高、
 *    内容区让出整列（214|277）、无横向溢出。
 *    9/10 是框架的另外两种状态：此前只量「浅色 + 展开」，切主题或收起后布局塌了也量不到。
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
const check = (view, name, ours, want, ok) => {
  rows.push({ view, name, ours, want, ok });
  if (!ok) console.log(`  ✗ ${view} ${name}: 我们 ${ours} / 期望 ${want}`);
};

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

for (const [width, height] of VIEWS) {
  const view = `${width}x${height}`;
  const tab = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: false });
  const overflow = [];

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

  const got = await tab.evaluate(() => {
    const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return null; return { x: b.x, y: b.y, w: b.width, h: b.height, bottom: b.bottom }; };
    const aside = document.querySelector('aside.vrc-sidebar');
    const nav = aside.querySelector('nav');
    const kinds = [...nav.querySelectorAll('[data-nav-kind]')];
    const tops = kinds.filter((el) => ['top', 'folder'].includes(el.dataset.navKind));
    const subs = kinds.filter((el) => el.dataset.navKind === 'sub');
    const foot = aside.querySelector('[data-nav-footer]');
    const footRows = [...(foot?.querySelectorAll('[data-nav-kind]') ?? [])];
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
    const last = kinds[kinds.length - 1];
    nav.scrollTop = nav.scrollHeight;
    const navRect = nav.getBoundingClientRect();
    const lastRect = last.getBoundingClientRect();
    // 顶栏右簇（快速搜索/Ctrl K → 图标组 → 3 窗口控制）：只量簇内可见元素之间的间距，
    // 不量绝对 x。原因：真机 topbar-measure.json 是字形坐标、且截图宽 1689（我们契约视口 1700），
    // 绝对 x 会随窗口宽整体平移、随 roster-toggle 显隐整体让位；间距才是布局契约。
    const tbRight = tbEl.getBoundingClientRect().right;
    const relRight = (el) => Math.round((tbRight - el.getBoundingClientRect().right) * 10) / 10;
    const relLeft = (el) => Math.round((tbRight - el.getBoundingClientRect().left) * 10) / 10;
    const vis = (el) => {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 1;
    };
    const kbd = document.querySelector('[data-topbar="search"] kbd');
    const actEls = [...(document.querySelector('[data-topbar="actions"]')?.children ?? [])].filter(vis);
    const winEls = [...(document.querySelector('[data-topbar="window-controls"]')?.children ?? [])].filter(vis);
    const winRects = winEls.map((e) => e.getBoundingClientRect());
    return {
      sidebar: box(aside),
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
      topH: tops.length ? [...new Set(tops.map((el) => Math.round(el.getBoundingClientRect().height)))] : [],
      subH: subs.length ? [...new Set(subs.map((el) => Math.round(el.getBoundingClientRect().height)))] : [],
      navOverflow: nav.scrollHeight - nav.clientHeight,
      navItems: kinds.length,
      lastBottom: Math.round(lastRect.bottom),
      navBottom: Math.round(navRect.bottom),
      footCount: footRows.length,
      footBottom: foot && footRows.length ? Math.round(Math.max(...footRows.map((el) => el.getBoundingClientRect().bottom))) : null,
      sidebarBottom: Math.round(aside.getBoundingClientRect().bottom),
      sbItems,
      tbRightPad: tbKids.length ? Math.round(window.innerWidth - Math.max(...tbKids)) : null,
      searchW: searchBtn ? Math.round(searchBtn.getBoundingClientRect().width) : null
    };
  });

  // 顶栏右侧留白：搜索簇右边还有 3 个装饰性窗口按钮（真机形态），只锁「我们自己内容右端距窗口边 8px」
  // 与簇内间距（见下 topbar.win），绝对 x 随视口宽平移不进 FAIL。
  check(view, 'topbar.right_pad', got.tbRightPad, '8±1', got.tbRightPad !== null && Math.abs(got.tbRightPad - 8) <= 1);
  check(view, 'topbar.search_w', got.searchW, '200–240', got.searchW !== null && got.searchW >= 200 && got.searchW <= 240);
  const wide = width >= 1280;
  check(view, 'sidebar.w', Math.round(got.sidebar.w), wide ? 277 : 214, Math.abs(got.sidebar.w - (wide ? 277 : 214)) <= 1);
  check(view, 'topbar.h', Math.round(got.topbar.h), 39, Math.abs(got.topbar.h - 39) <= 1);
  check(view, 'statusbar.h', Math.round(got.statusbar.h), 35, Math.abs(got.statusbar.h - 35) <= 1);
  check(view, 'nav.top_h', got.topH.join(','), '36', got.topH.length === 1 && got.topH[0] === 36);
  check(view, 'nav.sub_h', got.subH.join(','), '31', got.subH.length === 1 && got.subH[0] === 31);
  // 装不下时必须靠滚动（scrollHeight > clientHeight），且滚到底最后一项完整可见
  check(view, 'nav.scrollable', `${got.navOverflow}px`, '≥0 且滚到底可见末项',
    got.navOverflow >= 0 && got.lastBottom <= got.navBottom + 1);
  check(view, 'nav.footer_count', got.footCount, 2, got.footCount === 2);
  check(view, 'nav.footer_visible', `${got.footBottom} / ${Math.min(got.sidebarBottom, got.statusbar.y)}`,
    '页脚在侧栏内且高于状态栏', got.footBottom !== null && got.footBottom <= Math.min(got.sidebarBottom, got.statusbar.y) + 1);
  const sbGaps = got.sbItems.slice(1).map((it, i) => it.x - (got.sbItems[i].x + got.sbItems[i].w));
  check(view, 'statusbar.item_count', got.sbItems.length, 4, got.sbItems.length === 4);
  check(view, 'statusbar.first_x', got.sbItems[0]?.x, '10±1', Math.abs((got.sbItems[0]?.x ?? -99) - 10) <= 1);
  check(view, 'statusbar.gap', sbGaps.join(','), '23±1', sbGaps.length === 3 && sbGaps.every((g) => Math.abs(g - 23) <= 1));
  const wantRoster = width >= 1440;
  check(view, 'roster.visible', got.roster ? 'yes' : 'no', wantRoster ? 'yes' : 'no', !!got.roster === wantRoster);
  check(view, 'roster.toggle_visible', got.toggle ? 'yes' : 'no', wantRoster ? 'yes' : 'no', !!got.toggle === wantRoster);
  // 顶栏右簇：间距是布局契约（真机 topbar-measure.json 的 pitch/gap 同口径）。窗口控制 3 项、宽 24、
  // pitch 40（真机 pitch 40）、末项距右缘 8（真机 9）；图标组 5 项（<1440 无好友栏开关）/ 6 项（≥1440）。
  const tb = got.tbRight;
  check(view, 'topbar.kbd_w', tb.kbdW, '34±1', tb.kbdW !== null && Math.abs(tb.kbdW - 34) <= 1);
  check(view, 'topbar.gap_search_actions', tb.gapSearchActions, '22±1', tb.gapSearchActions !== null && Math.abs(tb.gapSearchActions - 22) <= 1);
  check(view, 'topbar.gap_actions_win', tb.gapActionsWin, '15±1', tb.gapActionsWin !== null && Math.abs(tb.gapActionsWin - 15) <= 1);
  check(view, 'topbar.actions_count', tb.actCount, wantRoster ? '6' : '5', tb.actCount === (wantRoster ? 6 : 5));
  check(view, 'topbar.win', `${tb.winCount}×${tb.winW} pitch${tb.winPitch} @${tb.winLastRel}`,
    '3×24 pitch40，末项距右缘 8±1',
    tb.winCount === 3 && tb.winW === 24 && tb.winPitch === 40 && Math.abs(tb.winLastRel - 8) <= 1);
  check(view, 'content.w', Math.round(got.workspace.w), '≥720', got.workspace.w >= 720);
  await tab.close();
}

// ── 第二轮：深色主题 + 收起侧栏 ──────────────────────────────────────────────
// 框架的另两种状态。上一轮只量默认浅色 + 侧栏展开，于是「切深色后侧栏变宽/行高缩水」和
// 「收起侧栏后内容没让出宽度、顶栏/状态栏变高」这两类回归都量不到。几何与浅色展开态同口径。
for (const [width, height] of VIEWS) {
  const view = `${width}x${height}`;
  const wide = width >= 1280;
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  // 主题存 localStorage（vrc-theme），导航收起态存 vrc-nav-collapsed
  await ctx.addInitScript(() => { try { localStorage.setItem('vrc-theme', 'dark'); } catch {} });
  const tab = await ctx.newPage();
  await gotoVrc(tab, `${PAGE}#/friends`);
  await tab.waitForSelector('aside.vrc-sidebar [data-nav-id]', { timeout: 30_000 });
  await tab.waitForTimeout(400);
  await assertVrcPage(tab, `dark@${view}`);

  const dark = await tab.evaluate(() => {
    const aside = document.querySelector('aside.vrc-sidebar');
    const nav = aside?.querySelector('nav');
    const top = aside?.querySelector('[data-nav-kind="top"]');
    const sub = aside?.querySelector('[data-nav-kind="sub"]');
    const rowH = (el) => (el ? Math.round(el.getBoundingClientRect().height) : null);
    const hs = (sel) => [...new Set([...(aside?.querySelectorAll(sel) ?? [])]
      .map((el) => Math.round(el.getBoundingClientRect().height)))];
    // 文本列：行内第二个 span 的左端相对行左端（顶层/二级同为 30 = 图标列 14 + gap 8 + 行内 padding 8）
    const textCol = (el) => {
      const b = el?.querySelectorAll('span')?.[1]?.getBoundingClientRect();
      return b ? Math.round(b.left - el.getBoundingClientRect().left) : null;
    };
    return {
      theme: document.documentElement.dataset.theme ?? '',
      topbarH: Math.round(document.querySelector('#vrc-topbar')?.getBoundingClientRect().height ?? 0),
      statusbarH: Math.round(document.querySelector('#vrc-statusbar')?.getBoundingClientRect().height ?? 0),
      sidebarW: Math.round(aside?.getBoundingClientRect().width ?? 0),
      topH: hs('[data-nav-kind="top"]'),
      subH: hs('[data-nav-kind="sub"]'),
      textTop: textCol(top),
      textSub: textCol(sub),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      workspaceX: Math.round(document.querySelector('.workspace')?.getBoundingClientRect().x ?? -1)
    };
  });
  check(view, 'dark.theme', dark.theme, 'dark', dark.theme === 'dark');
  check(view, 'dark.topbar_h', dark.topbarH, '39±1', Math.abs(dark.topbarH - 39) <= 1);
  check(view, 'dark.statusbar_h', dark.statusbarH, '35±1', Math.abs(dark.statusbarH - 35) <= 1);
  check(view, 'dark.sidebar_w', dark.sidebarW, wide ? 277 : 214, Math.abs(dark.sidebarW - (wide ? 277 : 214)) <= 1);
  check(view, 'dark.nav.top_h', dark.topH.join(','), '36', dark.topH.length === 1 && dark.topH[0] === 36);
  check(view, 'dark.nav.sub_h', dark.subH.join(','), '31', dark.subH.length === 1 && dark.subH[0] === 31);
  check(view, 'dark.nav.text_col', `top+${dark.textTop} / sub+${dark.textSub}`, '30±1 / 30±1',
    dark.textTop !== null && Math.abs(dark.textTop - 30) <= 1 && dark.textSub !== null && Math.abs(dark.textSub - 30) <= 1);
  check(view, 'dark.overflow', dark.overflow, '≤0', dark.overflow <= 0);

  // 收起侧栏：整列（214/277）让给内容，顶栏/状态栏不变高，顶栏出现的展开按钮可见
  const col = await tab.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('[data-testid="nav-collapse"]')?.click();
    await wait(350);
    const ws = document.querySelector('.workspace')?.getBoundingClientRect();
    return {
      asideGone: !document.querySelector('aside.vrc-sidebar'),
      expand: !!document.querySelector('[data-testid="nav-expand"]')
        && document.querySelector('[data-testid="nav-expand"]').getBoundingClientRect().width > 1,
      topbarH: Math.round(document.querySelector('#vrc-topbar')?.getBoundingClientRect().height ?? 0),
      statusbarH: Math.round(document.querySelector('#vrc-statusbar')?.getBoundingClientRect().height ?? 0),
      workspaceX: Math.round(ws?.x ?? -1),
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });
  const freed = dark.workspaceX - col.workspaceX;
  check(view, 'collapsed.aside_gone', col.asideGone ? 'gone' : 'still there', 'gone', col.asideGone);
  check(view, 'collapsed.expand_btn', col.expand ? 'visible' : 'missing', 'visible', col.expand);
  check(view, 'collapsed.topbar_h', col.topbarH, '39±1', Math.abs(col.topbarH - 39) <= 1);
  check(view, 'collapsed.statusbar_h', col.statusbarH, '35±1', Math.abs(col.statusbarH - 35) <= 1);
  check(view, 'collapsed.content_freed', `${freed}px`, `${wide ? 277 : 214}±1`,
    Math.abs(freed - (wide ? 277 : 214)) <= 1);
  check(view, 'collapsed.overflow', col.overflow, '≤0', col.overflow <= 0);
  await ctx.close();
}

await browser.close();
const pass = rows.filter((r) => r.ok).length;
const result = { at: new Date().toISOString(), base: BASE, pass, total: rows.length, rows };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
console.log(`主框架/导航密度 ${pass}/${rows.length} ${pass === rows.length ? '→ FRAME OK' : '→ 有 FAIL'}`);
if (pass !== rows.length) process.exit(1);
