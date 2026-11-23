/**
 * 185 导航可达性真机断言：逐个点侧栏项，确认页面真的切过去、标题对得上、没蹦错误边界。
 *
 *   node scripts/nav_coverage.mjs [baseUrl]
 *
 * 只断言「能到 + 标题对」，密度/像素交给 chrome_parity.mjs（spec.chrome.nav）。
 * 产出 docs/ref/nav-coverage.json；有 FAIL 则 exit 1。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const PW_HOME = process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json';
const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = createRequire(PW_HOME)('playwright'); }
const { chromium } = pw;

const BASE = process.argv[2] || 'http://127.0.0.1:8899';
const ROOT = process.env.VRC_ROOT || path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs/ref/nav-coverage.json');
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

// 期望：侧栏页面 id → 标题（App.jsx TITLES 第一列）
const app = fs.readFileSync(path.join(ROOT, 'web/src/App.jsx'), 'utf8');
const titlesBlock = app.slice(app.indexOf('const TITLES = {'), app.indexOf('function useTheme'));
const WANT = Object.fromEntries(
  [...titlesBlock.matchAll(/^\s{2}(\w+):\s*\['([^']*)'/gm)].map((m) => [m[1], m[2]])
);

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1688, height: 1028 }, deviceScaleFactor: 1 });
const rows = [];
try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  // 等侧栏渲染出至少一个导航项（demo 种子要一点时间）
  await page.waitForSelector('aside.vrc-sidebar [data-nav-id]', { timeout: 30_000 });
  const ids = await page.evaluate(() => [...document.querySelectorAll('aside.vrc-sidebar [data-nav-id]')].map((el) => el.dataset.navId));

  for (const id of ids) {
    const r = await page.evaluate(async (id) => {
      const btn = [...document.querySelectorAll('aside.vrc-sidebar [data-nav-id]')].find((el) => el.dataset.navId === id);
      btn.click();
      // 等 hash、标题、懒加载块都到位
      const t0 = Date.now();
      let hash = '', title = '', err = null, active = false;
      while (Date.now() - t0 < 8000) {
        await new Promise((res) => setTimeout(res, 60));
        hash = location.hash;
        title = document.querySelector('#vrc-topbar h1')?.textContent?.trim() ?? '';
        const errBox = [...document.querySelectorAll('h2,h3')].find((el) => el.textContent.includes('这个页面出错了'));
        err = errBox ? errBox.textContent.trim() : null;
        active = btn.dataset.active === 'true';
        if (hash === `#/${id}` && title && !err) break;
      }
      return { hash, title, err, active };
    }, id);
    const okHash = r.hash === `#/${id}`;
    const okTitle = !WANT[id] || r.title === WANT[id];
    rows.push({ id, hash: r.hash, title: r.title, want: WANT[id] ?? null, active: r.active, ok: okHash && okTitle && !r.err, error: r.err });
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
  rows.push({ id: `folder:${fold.key}`, hash: '-', title: `${fold.before}→${fold.closed}→${fold.reopened}`, want: 'N→0→N', active: '-', ok: fold.before > 0 && fold.closed === 0 && fold.reopened === fold.before, error: null });
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
  rows.push({
    id: 'footer:collapse', hash: '-',
    title: `${collapse.before ? 'nav' : 'no'}→${collapse.afterClick ? 'nav' : 'no'}→${collapse.afterExpand ? 'nav' : 'no'}`,
    want: 'nav→no→nav', active: '-',
    ok: collapse.before && !collapse.afterClick && collapse.expandBtn && collapse.afterExpand && collapse.stored === '1',
    error: null
  });
} finally {
  await browser.close();
}

const pass = rows.filter((r) => r.ok).length;
const report = {
  _note: 'nav_coverage.mjs：逐个点侧栏项，断言 hash=#/<id>、顶栏标题=TITLES[id][0]、无错误边界；最后验折叠夹收起/展开',
  base: BASE,
  viewport: { w: 1688, h: 1028 },
  score: Number(((pass / rows.length) * 100).toFixed(1)),
  rows
};
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 1)}\n`);
const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('nav', 18)}${pad('hash', 22)}${pad('title', 16)}ok`);
for (const r of rows) console.log(`${pad(r.id, 18)}${pad(r.hash, 22)}${pad(r.title, 16)}${r.ok ? 'PASS' : `FAIL${r.error ? ' ' + r.error : ''}`}`);
console.log(`\n导航可达 ${pass}/${rows.length} (${report.score}%) → ${path.relative(ROOT, OUT)}`);
process.exit(pass === rows.length ? 0 : 1);
