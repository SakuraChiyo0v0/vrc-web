
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = pw;
const EXE = '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1688, height: 1028 }, deviceScaleFactor: 1 });
for (const page of ['search','favorites','insights','players']) {
  await p.goto(`http://127.0.0.1:8899/#/${page}`, { waitUntil: 'networkidle' }).catch(()=>{});
  await p.waitForTimeout(2200);
  await p.screenshot({ path: `/opt/data/apps/vrc-web/docs/screenshots/compare/r186-${page}.png` });
  const overflow = await p.evaluate(() => {
    const m = document.querySelector('.workspace') || document.body;
    return { sw: m.scrollWidth, cw: m.clientWidth, sh: m.scrollHeight, ch: m.clientHeight };
  });
  console.log(page, JSON.stringify(overflow));
}
await b.close();
