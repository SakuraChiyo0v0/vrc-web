
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const b = await pw.chromium.launch({ executablePath: '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const t = await b.newPage({ viewport: { width: 360, height: 800 } });
await t.goto('http://127.0.0.1:8891#/insights', { waitUntil: 'domcontentloaded' });
await t.waitForTimeout(1200);
console.log(await t.evaluate(() => [...document.querySelectorAll('button.chip')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => {
  let p = el, chain = [];
  for (let i=0;i<4&&p;i++){ chain.push(`${p.tagName.toLowerCase()}.${(p.className||'').toString().split(' ').slice(0,3).join('.')}[w=${Math.round(p.getBoundingClientRect().width)},right=${Math.round(p.getBoundingClientRect().right)}]`); p=p.parentElement; }
  return `CHIP "${el.textContent.trim().slice(0,10)}" h=${Math.round(el.getBoundingClientRect().height)} <- ` + chain.join(' <- ');
})));
await b.close();
