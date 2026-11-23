import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const EXE = '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = process.argv[2] || 'http://127.0.0.1:8899';
const browser = await pw.chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
for (const page of ['friendlist','friendlog']) {
  const p = await browser.newPage({ viewport: { width: 3840, height: 2160 } });
  await p.goto(`${BASE}#/${page}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await p.waitForTimeout(2500);
  const out = await p.evaluate(() => {
    const W = window.innerWidth;
    const over = [];
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > W + 2 && r.width > 0) {
        over.push({ tag: el.tagName.toLowerCase(), cls: [...el.classList].join('.').slice(0,40), right: Math.round(r.right), w: Math.round(r.width), sw: el.scrollWidth });
      }
    });
    return { W, sw: document.documentElement.scrollWidth, over: over.slice(0, 6) };
  });
  console.log(page, JSON.stringify(out));
  await p.close();
}
await browser.close();
