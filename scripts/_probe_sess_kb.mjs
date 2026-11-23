import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw; try { _pw = _req('playwright'); } catch { _pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox','--disable-dev-shm-usage'] });
for (const [w,h,kb] of [[844,390,220],[932,430,240]]) {
  const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await tab.goto(`${BASE}#/sessions`, { waitUntil: 'domcontentloaded' }).catch(()=>{});
  await tab.waitForTimeout(1500);
  await tab.click('.sess-seg button:first-child').catch((e)=>console.log('click err', e.message));
  await tab.waitForTimeout(400);
  const sel='input[aria-label="搜索房间"]';
  const found = await tab.locator(sel).first().isVisible().catch(()=>false);
  await tab.locator(sel).first().click({timeout:3000}).catch(()=>{});
  await tab.evaluate((hh)=>{const vv=window.visualViewport;Object.defineProperty(vv,'height',{configurable:true,get:()=>hh});vv.dispatchEvent(new Event('resize'));window.dispatchEvent(new Event('resize'));}, h-kb);
  await tab.waitForTimeout(500);
  console.log(`=== ${w}x${h} kb${kb} sessions ===`, JSON.stringify(await tab.evaluate((s)=>{
    const box=(el)=>{if(!el)return null;const b=el.getBoundingClientRect();return {top:Math.round(b.top),bottom:Math.round(b.bottom),h:Math.round(b.height)}};
    const vvH=window.visualViewport.height;
    const rows=[...document.querySelectorAll('.sess-row, a[data-world], [data-sess-row]')];
    const vis=rows.filter(r=>{const b=r.getBoundingClientRect();return b.top>=0&&b.bottom<=vvH&&b.height>0;});
    const inp=document.querySelector(s);
    return { found:!!inp, search:box(inp), main:box(document.querySelector('main')), tools:box(document.querySelector('.sess-tools')), searchBar:box(document.querySelector('.sess-search')), count:box(document.querySelector('.sess-count')),
      rowsTotal:rows.length, rowsFullyVisible:vis.length, rowH: rows[0]?Math.round(rows[0].getBoundingClientRect().height):null, firstTop: rows[0]?Math.round(rows[0].getBoundingClientRect().top):null };
  }, sel)));
  // dump first row html for row selector discovery
  if (w===844) console.log('rowhtml:', (await tab.evaluate(()=>{const sc=document.querySelector('.sess-scroll');return sc?sc.innerHTML.slice(0,400):null})));
  await tab.close();
}
await browser.close();
