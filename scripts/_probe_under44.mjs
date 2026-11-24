// 探针：390 竖屏下每页仍 <44px 的触控目标清单（用于把残留定档成显式允许清单）
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
import { STRUCT_PAGES } from './lib/page_structure.mjs';
const BASE = process.argv[2] || process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const PAGES = ['friends', ...STRUCT_PAGES.filter((p) => p !== 'locations')];

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const out = {};
for (const page of PAGES) {
  const tab = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 });
  await tab.goto(`${BASE}#/${page}`, { waitUntil: 'domcontentloaded' });
  await tab.waitForTimeout(1400);
  out[page] = await tab.evaluate(() => {
    const res = [];
    document.querySelectorAll('button, a[href], [role="button"], input, select').forEach((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || r.width <= 0 || r.height <= 0) return;
      if (r.height >= 44) return;
      const layer = el.closest('#vrc-topbar') ? 'topbar' : el.closest('.vrc-sidebar') ? 'nav'
        : el.matches('.chip') ? 'chip' : el.matches('input, select') ? 'field' : 'rest';
      res.push(`${layer}:${(el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 12)}=${Math.round(r.height)}`);
    });
    return res;
  });
  console.log(page, JSON.stringify(out[page]));
  await tab.close();
}
await browser.close();
