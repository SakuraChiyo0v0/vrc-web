/** 探针：kb 矩阵里 cand=0 的页，dump main 内可见块（top/h/text） */
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const pages = (process.argv[2] || 'search,favorites,players,insights,friends').split(',');
for (const page of pages) {
  const w = 844, h = 390;
  const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await tab.goto(`${BASE}#/${page}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await tab.waitForTimeout(1600);
  await tab.evaluate((hh) => {
    const vv = window.visualViewport;
    Object.defineProperty(vv, 'height', { configurable: true, get: () => hh });
    vv.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('resize'));
  }, h - 220);
  await tab.waitForTimeout(500);
  const d = await tab.evaluate(() => {
    const vvH = window.visualViewport.height;
    const main = document.querySelector('main') || document.querySelector('#root > div > div:last-child');
    const out = [];
    const walk = (el, depth) => {
      [...el.children].forEach((c) => {
        const r = c.getBoundingClientRect();
        const cs = getComputedStyle(c);
        if (cs.display === 'none' || r.height <= 0) return;
        if (r.width < 40) return;
        const txt = (c.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
        out.push(`${'  '.repeat(depth)}${c.tagName.toLowerCase()}.${(c.className || '').toString().split(' ').slice(0, 2).join('.')} top=${Math.round(r.top)} h=${Math.round(r.height)} ${txt}`);
        if (depth < 3 && r.height > 30) walk(c, depth + 1);
      });
    };
    walk(main, 0);
    return { vvH, main: Math.round(main.getBoundingClientRect().height), out: out.slice(0, 26) };
  });
  console.log(`\n=== ${page} vv=${d.vvH} main=${d.main}`);
  d.out.forEach((l) => console.log(l));
  await tab.close();
}
await browser.close();
