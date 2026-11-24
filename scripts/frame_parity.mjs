/**
 * 主框架（外壳）＋导航密度回归：把「窗口多大都长什么样」变成可量数字。
 *
 *   node scripts/frame_parity.mjs [baseUrl]
 *
 * 覆盖 7 个桌面视口 1024×768 / 1100×800 / 1280×800 / 1366×768 / 1440×900 / 1600×900 / 1700×1040。
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
 *
 * 任一 FAIL 退出码 1；全 PASS 打印 FRAME OK，并把结果写 docs/ref/frame-parity.json。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;

const BASE = process.argv[2]?.startsWith('http') ? process.argv[2] : (process.env.VRC_BASE || 'http://127.0.0.1:8891');
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs/ref/frame-parity.json');
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const VIEWS = [[1024, 768], [1100, 800], [1280, 800], [1366, 768], [1440, 900], [1600, 900], [1700, 1040]];
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
    await tab.goto(`${BASE}#/${p}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await tab.waitForTimeout(900);
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
    const last = kinds[kinds.length - 1];
    nav.scrollTop = nav.scrollHeight;
    const navRect = nav.getBoundingClientRect();
    const lastRect = last.getBoundingClientRect();
    return {
      sidebar: box(aside),
      topbar: box(document.querySelector('#vrc-topbar')),
      statusbar: sb,
      workspace: box(document.querySelector('.workspace')),
      roster: box(document.querySelector('.roster-rail')),
      toggle: box(document.querySelector('.roster-toggle')),
      topH: tops.length ? [...new Set(tops.map((el) => Math.round(el.getBoundingClientRect().height)))] : [],
      subH: subs.length ? [...new Set(subs.map((el) => Math.round(el.getBoundingClientRect().height)))] : [],
      navOverflow: nav.scrollHeight - nav.clientHeight,
      navItems: kinds.length,
      lastBottom: Math.round(lastRect.bottom),
      navBottom: Math.round(navRect.bottom),
      footCount: footRows.length,
      footBottom: foot && footRows.length ? Math.round(Math.max(...footRows.map((el) => el.getBoundingClientRect().bottom))) : null,
      sidebarBottom: Math.round(aside.getBoundingClientRect().bottom),
      sbItems
    };
  });

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
  check(view, 'content.w', Math.round(got.workspace.w), '≥720', got.workspace.w >= 720);
  await tab.close();
}

await browser.close();
const pass = rows.filter((r) => r.ok).length;
const result = { at: new Date().toISOString(), base: BASE, pass, total: rows.length, rows };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
console.log(`主框架/导航密度 ${pass}/${rows.length} ${pass === rows.length ? '→ FRAME OK' : '→ 有 FAIL'}`);
if (pass !== rows.length) process.exit(1);
