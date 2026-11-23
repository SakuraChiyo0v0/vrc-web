/** 临时探针：CSS zoom 下 matchMedia / innerWidth 怎么算，决定 <picture media> 断点口径 */
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
for (const width of [1700, 1920, 2560, 3840]) {
  const p = await b.newPage({ viewport: { width, height: 1040 }, deviceScaleFactor: 1 });
  await p.goto('http://127.0.0.1:8892/#/worlds', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.world-card', { timeout: 30000 });
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => {
    const img = document.querySelector('.world-card img.thumb');
    const card = document.querySelector('.world-card');
    const tb = img?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      docClientW: document.documentElement.clientWidth,
      zoom: getComputedStyle(document.documentElement).zoom,
      mq2200: matchMedia('(min-width: 2200px)').matches,
      mq2560: matchMedia('(min-width: 2560px)').matches,
      thumbDev: tb?.width, natW: img?.naturalWidth,
      dpr: devicePixelRatio,
    };
  });
  console.log(width, JSON.stringify(r));
  await p.close();
}
await b.close();
