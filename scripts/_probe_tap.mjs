
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const b = await pw.chromium.launch({ executablePath: '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
for (const page of ['feed','favorites','insights']) {
  const t = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await t.goto('http://127.0.0.1:8891#/' + page, { waitUntil: 'domcontentloaded' });
  await t.waitForTimeout(1200);
  const out = await t.evaluate(() => [...document.querySelectorAll('button, a[href], [role="button"], input, select')].map(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    if (r.height >= 28) return null;
    return `${el.tagName.toLowerCase()} type=${el.type||''} class="${(el.className||'').toString().slice(0,50)}" placeholder="${el.placeholder||''}" aria="${el.getAttribute('aria-label')||''}" h=${Math.round(r.height)} w=${Math.round(r.width)} right=${Math.round(r.right)} parent=${el.parentElement?.tagName.toLowerCase()}.${(el.parentElement?.className||'').toString().split(' ')[0]}`;
  }).filter(Boolean));
  console.log('##', page); out.forEach(o => console.log('  ', o));
  await t.close();
}
await b.close();
