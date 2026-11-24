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
console.log(JSON.stringify(await tab.evaluate(() => {
  const WORLD = /Alpha Club|Cube Garden|Beta Lounge|Tiny Studio|夜の喫茶店/;
  const out = [];
  document.querySelectorAll('button, a[href]').forEach((el) => {
    const b = el.getBoundingClientRect();
    const t = (el.textContent || '').trim();
    if (b.height <= 0 || b.height >= 36 || !WORLD.test(t)) return;
    out.push({ h: Math.round(b.height), tag: el.tagName, cls: el.className.toString().slice(0, 60), text: t.slice(0, 20),
      inRow: !!el.closest('[data-list-row]'),
      chain: (() => { const c = []; let n = el; for (let i = 0; i < 5 && n; i += 1, n = n.parentElement) c.push(`${n.tagName}.${(n.className || '').toString().split(' ')[0]}`); return c.join('<'); })() });
  });
  return out.slice(0, 4);
}), null, 1));
await browser.close();
