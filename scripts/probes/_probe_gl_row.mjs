import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = 'http://127.0.0.1:8891';
const EXE = '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const tab = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
await tab.goto(`${BASE}#/gamelog`, { waitUntil: 'domcontentloaded' });
await tab.waitForTimeout(1600);
console.log(await tab.evaluate(() => {
  const out = [];
  document.querySelectorAll('button, a[href]').forEach((el) => {
    const b = el.getBoundingClientRect();
    if (b.height <= 0 || b.height >= 36) return;
    out.push({ h: Math.round(b.height), tag: el.tagName, cls: el.className.toString().slice(0, 40),
      inRow: !!el.closest('[data-list-row]'),
      m1: el.matches('[data-list-row] button'), m2: el.matches('[data-list-row] a'),
      parentChain: (() => { const c = []; let n = el; for (let i = 0; i < 4 && n; i += 1, n = n.parentElement) c.push(`${n.tagName}.${(n.className || '').toString().split(' ')[0]}${n.dataset && n.dataset.listRow ? '[row]' : ''}`); return c.join('<'); })() });
  });
  return out.slice(0, 4);
}));
await browser.close();
