/**
 * 185 导航可达性真机断言：逐个点侧栏项，确认页面真的切过去、标题对得上、没蹦错误边界。
 *
 *   node scripts/nav_coverage.mjs [baseUrl]
 *
 * 视口：默认 4 个桌面档 1688×1028 / 1366×768 / 1100×800 / 1024×768（矮窗下侧栏靠滚动，
 * 所以每项先 scrollIntoView 做**命中测试**：中心点 elementFromPoint 落在该项自己身上，
 * 且整行落在 <nav> 可视区内 —— 防「JS click 能过、人点不到」）。
 *   NAV_VIEWS=all                 → frame_parity 的 9 个视口（含 600 高两档）
 *   NAV_VIEWS=1688x1028,1440x900  → 自定义
 *
 * 断言「能到 + 标题对 + 点得到」；密度/像素交给 frame_parity.mjs。
 * 产出 docs/ref/nav-coverage.json；有 FAIL 则 exit 1。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { normBase, pageBase, assertVrcPage, gotoVrc } from './lib/page_structure.mjs';

const PW_HOME = process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json';
const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = createRequire(PW_HOME)('playwright'); }
const { chromium } = pw;

const BASE = normBase(process.argv[2]?.startsWith('http') ? process.argv[2] : (process.env.VRC_BASE || 'http://127.0.0.1:8899'));
const PAGE = pageBase(BASE);
const ROOT = process.env.VRC_ROOT || path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs/ref/nav-coverage.json');
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

// 与 frame_parity 同口径（含 600 高矮窗两档：导航必须靠滚动且每项仍点得到）
const ALL_VIEWS = [[1024, 600], [1024, 768], [1100, 800], [1280, 600], [1280, 800], [1366, 768], [1440, 900], [1600, 900], [1700, 1040]];
const DEFAULT_VIEWS = [[1688, 1028], [1366, 768], [1100, 800], [1024, 768]];
const parseViews = (s) => s.split(',').map((v) => v.trim()).filter(Boolean)
  .map((v) => v.split('x').map(Number)).filter((v) => v.length === 2 && v.every(Number.isFinite));
const VIEWS = process.env.NAV_VIEWS
  ? (process.env.NAV_VIEWS === 'all' ? ALL_VIEWS : parseViews(process.env.NAV_VIEWS))
  : DEFAULT_VIEWS;

// 期望：侧栏页面 id → 标题（App.jsx TITLES 第一列）
const app = fs.readFileSync(path.join(ROOT, 'web/src/App.jsx'), 'utf8');
const titlesBlock = app.slice(app.indexOf('const TITLES = {'), app.indexOf('function useTheme'));
const WANT = Object.fromEntries(
  [...titlesBlock.matchAll(/^\s{2}(\w+):\s*\['([^']*)'/gm)].map((m) => [m[1], m[2]])
);

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const rows = [];
const perView = [];

for (const [width, height] of VIEWS) {
  const view = `${width}x${height}`;
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  let viewRows = 0, viewPass = 0;
  const push = (row) => { rows.push(row); viewRows++; if (row.ok) viewPass++; };
  try {
    await gotoVrc(page, PAGE);
    await assertVrcPage(page, `nav@${view}`);
    // 等侧栏渲染出至少一个导航项（demo 种子要一点时间）
    await page.waitForSelector('aside.vrc-sidebar [data-nav-id]', { timeout: 30_000 });
    const ids = await page.evaluate(() => [...document.querySelectorAll('aside.vrc-sidebar [data-nav-id]')].map((el) => el.dataset.navId));

    for (const id of ids) {
      const r = await page.evaluate(async (id) => {
        const wait = (ms) => new Promise((res) => setTimeout(res, ms));
        const btn = [...document.querySelectorAll('aside.vrc-sidebar [data-nav-id]')].find((el) => el.dataset.navId === id);
        if (!btn) return { hash: '', title: '', err: 'nav item vanished', active: false, vis: false, hit: false };
        const b0 = btn.getBoundingClientRect();
        const vis = b0.width > 1 && b0.height > 1 && getComputedStyle(btn).visibility !== 'hidden';
        let hit = null;
        if (vis) {
          btn.scrollIntoView({ block: 'nearest' });
          await wait(80);
          const c = btn.getBoundingClientRect();
          // 可视区：页脚项（设置/收起导航栏）在 [data-nav-footer] 里，其余在 <nav> 滚动容器里
          const scroller = btn.closest('nav') ?? btn.closest('[data-nav-footer]');
          const nav = scroller.getBoundingClientRect();
          const t = document.elementFromPoint(c.x + c.width / 2, c.y + c.height / 2);
          hit = !!t && (t === btn || btn.contains(t) || t.contains(btn))
            && c.top >= nav.top - 1 && c.bottom <= nav.bottom + 1;
        }
        btn.click();
        // 等 hash、标题、懒加载块都到位
        const t0 = Date.now();
        let hash = '', title = '', err = null, active = false;
        while (Date.now() - t0 < 8000) {
          await wait(60);
          hash = location.hash;
          title = document.querySelector('#vrc-topbar h1')?.textContent?.trim() ?? '';
          const errBox = [...document.querySelectorAll('h2,h3')].find((el) => el.textContent.includes('这个页面出错了'));
          err = errBox ? errBox.textContent.trim() : null;
          active = btn.dataset.active === 'true';
          if (hash === `#/${id}` && title && !err) break;
        }
        return { hash, title, err, active, vis, hit };
      }, id);
      const okHash = r.hash === `#/${id}`;
      const okTitle = !WANT[id] || r.title === WANT[id];
      const okHit = r.vis ? r.hit === true : true; // 折叠夹里的子项不可见时不判命中
      push({
        id: `${id}@${view}`, view, nav: id, hash: r.hash, title: r.title, want: WANT[id] ?? null,
        active: r.active, hit: r.vis ? r.hit : 'hidden',
        ok: okHash && okTitle && !r.err && okHit,
        error: r.err || (okHit ? null : 'unreachable（命中测试失败）')
      });
    }
    // 折叠夹行为：收起后子项消失，再展开回来（真机两夹默认展开）
    const fold = await page.evaluate(async () => {
      const box = document.querySelector('aside.vrc-sidebar [data-nav-folder]');
      const key = box.dataset.navFolder;
      const head = box.querySelector('[data-nav-kind="folder"]');
      const before = box.querySelectorAll('[data-nav-kind="sub"]').length;
      head.click();
      await new Promise((r) => setTimeout(r, 200));
      const closed = box.querySelectorAll('[data-nav-kind="sub"]').length;
      head.click();
      await new Promise((r) => setTimeout(r, 200));
      const reopened = box.querySelectorAll('[data-nav-kind="sub"]').length;
      return { key, before, closed, reopened };
    });
    push({
      id: `folder:${fold.key}@${view}`, view, nav: `folder:${fold.key}`, hash: '-',
      title: `${fold.before}→${fold.closed}→${fold.reopened}`, want: 'N→0→N', active: '-', hit: '-',
      ok: fold.before > 0 && fold.closed === 0 && fold.reopened === fold.before, error: null
    });
    // 188 SidebarFooter「收起导航栏」：点了侧栏消失、顶栏出展开按钮、再点回来（状态存 localStorage）
    const collapse = await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const btn = document.querySelector('[data-testid="nav-collapse"]');
      if (!btn) return { before: true, afterClick: true, expandBtn: false, afterExpand: false, stored: null };
      const before = !!document.querySelector('aside.vrc-sidebar');
      btn.click();
      await wait(250);
      const afterClick = !!document.querySelector('aside.vrc-sidebar');
      const expandBtn = !!document.querySelector('[data-testid="nav-expand"]');
      const stored = localStorage.getItem('vrc-nav-collapsed');
      document.querySelector('[data-testid="nav-expand"]')?.click();
      await wait(250);
      const afterExpand = !!document.querySelector('aside.vrc-sidebar');
      return { before, afterClick, expandBtn, afterExpand, stored };
    });
    push({
      id: `footer:collapse@${view}`, view, nav: 'footer:collapse', hash: '-',
      title: `${collapse.before ? 'nav' : 'no'}→${collapse.afterClick ? 'nav' : 'no'}→${collapse.afterExpand ? 'nav' : 'no'}`,
      want: 'nav→no→nav', active: '-', hit: '-',
      ok: collapse.before && !collapse.afterClick && collapse.expandBtn && collapse.afterExpand && collapse.stored === '1',
      error: null
    });
  } finally {
    perView.push({ view, pass: viewPass, total: viewRows });
    await ctx.close();
  }
}

await browser.close();

const pass = rows.filter((r) => r.ok).length;
const report = {
  _note: 'nav_coverage.mjs：逐视口逐个点侧栏项，断言 hash=#/<id>、顶栏标题=TITLES[id][0]、无错误边界，可见项还要过命中测试（elementFromPoint 落在自身且整行在 nav 可视区）；最后验折叠夹收起/展开与收起导航栏',
  base: BASE,
  views: VIEWS.map(([w, h]) => `${w}x${h}`),
  per_view: perView,
  score: Number(((pass / rows.length) * 100).toFixed(1)),
  rows
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 1)}\n`);
const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('nav@view', 26)}${pad('hash', 22)}${pad('title', 16)}hit    ok`);
for (const r of rows) console.log(`${pad(r.id, 26)}${pad(r.hash, 22)}${pad(r.title, 16)}${pad(String(r.hit), 7)}${r.ok ? 'PASS' : `FAIL${r.error ? ' ' + r.error : ''}`}`);
for (const v of perView) console.log(`${pad(v.view, 12)}${v.pass}/${v.total}`);
console.log(`\n导航可达 ${pass}/${rows.length} (${report.score}%) → ${path.relative(ROOT, OUT)}`);
process.exit(pass === rows.length ? 0 : 1);
