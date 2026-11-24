/**
 * 外壳（主框架）＋导航密度现状量测：
 *   node scripts/_probe_frame.mjs [baseUrl]
 * 逐个桌面视口记录：侧栏/顶栏/状态栏/内容面板几何、导航是否需要滚动、是否有条目被裁、
 * 以及 5 个代表页是否有横向溢出。只打印 JSON，不做断言。
 */
import { createRequire } from 'node:module';

const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;

const BASE = process.argv[2]?.startsWith('http') ? process.argv[2] : (process.env.VRC_BASE || 'http://vrc-web-r18:8790/vrc/');
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const VIEWS = [[1024, 768], [1100, 800], [1280, 800], [1366, 768], [1440, 900], [1700, 1040]];
const PAGES = ['friends', 'feed', 'friendlist', 'gamelog', 'settings'];

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const out = { base: BASE, views: [] };

for (const [width, height] of VIEWS) {
  const tab = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const row = { viewport: `${width}x${height}` };
  const geo = [];
  for (const p of PAGES) {
    await tab.goto(`${BASE}#/${p}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await tab.waitForTimeout(900);
    await tab.waitForFunction(() => {
      const th = document.querySelector('thead');
      return !th || !!document.querySelector('tbody tr');
    }, { timeout: 6000 }).catch(() => {});
    geo.push(await tab.evaluate((page) => {
      const r = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return null;
        return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
      };
      const nav = document.querySelector('.vrc-sidebar nav');
      const items = [...document.querySelectorAll('.vrc-sidebar [data-nav-id], .vrc-sidebar [data-nav-kind="folder"], .vrc-sidebar [data-nav-kind="footer"]')];
      const navRect = nav?.getBoundingClientRect();
      const clipped = items.filter((el) => {
        const b = el.getBoundingClientRect();
        return navRect && b.height > 0 && (b.bottom > navRect.bottom + 1 || b.top < navRect.top - 1);
      }).map((el) => (el.textContent || '').trim().slice(0, 12));
      const ws = document.querySelector('.workspace');
      const content = ws?.firstElementChild?.firstElementChild || ws?.firstElementChild;
      return {
        page,
        docW: document.documentElement.scrollWidth,
        vw: window.innerWidth,
        sidebar: r('.vrc-sidebar'),
        topbar: r('#vrc-topbar'),
        statusbar: r('#vrc-statusbar'),
        workspace: r('.workspace'),
        roster: r('.roster-rail'),
        contentInnerW: content ? Math.round(content.getBoundingClientRect().width) : null,
        nav: nav ? { ch: nav.clientHeight, sh: nav.scrollHeight, overflow: nav.scrollHeight - nav.clientHeight } : null,
        navItems: items.length,
        navItemH: items[0] ? Math.round(items[0].getBoundingClientRect().height) : null,
        clipped: clipped.slice(0, 8),
        clippedN: clipped.length,
        firstRow: (() => {
          const tr = document.querySelector('.tbl tbody tr, .friend-row');
          return tr ? { w: Math.round(tr.getBoundingClientRect().width), cols: getComputedStyle(tr).gridTemplateColumns } : null;
        })()
      };
    }, p));
  }
  row.pages = geo;
  out.views.push(row);
  await tab.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
