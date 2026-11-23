import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const EXE = '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const b = await pw.chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
for (const pg of ['friendlist', 'friendlog']) {
  const p = await b.newPage({ viewport: { width: 3840, height: 2160 } });
  await p.goto(`http://127.0.0.1:8899/#/${pg}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const w = window.innerWidth;
    const wide = [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().width > w + 2)
      .slice(0, 6).map((e) => `${e.tagName}.${e.className}`.slice(0, 80) + ' w=' + Math.round(e.getBoundingClientRect().width));
    return { doc: document.documentElement.scrollWidth, win: w, wide };
  });
  console.log(pg, JSON.stringify(r));
  await p.close();
}
await b.close();
