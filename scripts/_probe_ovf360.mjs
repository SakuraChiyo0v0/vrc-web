
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const PAGES = ['friends','overview','search','feed','sessions','players','moderation','favorites','insights','friendlist','friendlog','gamelog','settings','locations'];
const b = await pw.chromium.launch({ executablePath: '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
for (const p of PAGES) {
  const t = await b.newPage({ viewport: { width: 360, height: 800 } });
  await t.goto('http://127.0.0.1:8891#/' + p, { waitUntil: 'domcontentloaded' });
  await t.waitForTimeout(1000);
  const out = await t.evaluate(() => [...document.querySelectorAll('body *')].filter(el => {
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    return r.width > 0 && r.right > innerWidth + 1 && cs.position !== 'fixed';
  }).slice(0,4).map(el => {
    let p = el, chain = [];
    for (let i=0;i<3&&p;i++){ chain.push(`${p.tagName.toLowerCase()}.${(p.className||'').toString().split(' ').slice(0,3).join('.')}`); p=p.parentElement; }
    return `right=${Math.round(el.getBoundingClientRect().right)} w=${Math.round(el.getBoundingClientRect().width)} ` + chain.join(' <- ');
  }));
  if (out.length) { console.log('##', p); out.forEach(o => console.log('  ', o)); }
  await t.close();
}
await b.close();
