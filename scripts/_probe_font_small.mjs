
import path from 'node:path';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const b = await pw.chromium.launch({ executablePath: '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
for (const page of ['feed','insights','settings','gamelog']) {
  const t = await b.newPage({ viewport: { width: 390, height: 844 } });
  await t.goto('http://127.0.0.1:8891#/' + page, { waitUntil: 'domcontentloaded' });
  await t.waitForTimeout(1200);
  const out = await t.evaluate(() => [...document.querySelectorAll('body *')].filter(el => {
    const cs = getComputedStyle(el); if (cs.display==='none'||cs.visibility==='hidden'||!el.offsetParent) return false;
    if (!(el.textContent||'').trim()) return false;
    return parseFloat(cs.fontSize) < 11;
  }).slice(0,8).map(el => `${el.tagName.toLowerCase()}.${(el.className||'').toString().split(' ').slice(0,2).join('.')} fs=${getComputedStyle(el).fontSize} text="${(el.textContent||'').trim().slice(0,14)}"`));
  console.log('##', page); out.forEach(o=>console.log('  ',o));
  await t.close();
}
await b.close();
