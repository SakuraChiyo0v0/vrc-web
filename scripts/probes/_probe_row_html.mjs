import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.argv[2] || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
for (const page of ['friendlist', 'feed']) {
  const tab = await browser.newPage({ viewport: { width: 360, height: 800 }, hasTouch: true });
  await tab.goto(`${BASE}#/${page}`, { waitUntil: 'domcontentloaded' });
  await tab.waitForTimeout(2000);
  const r = await tab.evaluate(() => {
    const tr = document.querySelector('tbody tr');
    if (!tr) return { err: 'no row' };
    return { trHTML: tr.outerHTML.slice(0, 1200) };
  });
  console.log(page, r.trHTML || r.err);
  await tab.close();
}
await browser.close();
