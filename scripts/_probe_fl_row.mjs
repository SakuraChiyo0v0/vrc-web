import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw; try { _pw = _req('playwright'); } catch { _pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox','--disable-dev-shm-usage'] });
const tab = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
await tab.goto(`${BASE}#/friendlist`, { waitUntil: 'domcontentloaded' }).catch(()=>{});
await tab.waitForTimeout(1500);
await tab.locator('input[placeholder="搜索好友"]').first().click().catch(()=>{});
await tab.evaluate(() => { const vv = window.visualViewport; Object.defineProperty(vv,'height',{configurable:true,get:()=>170}); vv.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('resize')); });
await tab.waitForTimeout(500);
console.log(JSON.stringify(await tab.evaluate(() => {
  const bar = document.querySelector('input[placeholder="搜索好友"]').closest('div');
  const tr = document.querySelector('tbody tr');
  const cs = getComputedStyle(tr);
  return {
    toolbar: { h: Math.round(bar.getBoundingClientRect().height), cls: bar.className },
    row: { h: Math.round(tr.getBoundingClientRect().height), flex: cs.display + '/' + cs.flexFlow, pad: cs.padding, gap: cs.gap },
    cells: [...tr.querySelectorAll('td')].map(td => ({ label: td.dataset.label || '(1st)', w: Math.round(td.getBoundingClientRect().width), h: Math.round(td.getBoundingClientRect().height), lh: getComputedStyle(td).lineHeight, fs: getComputedStyle(td).fontSize })),
    avatar: (() => { const a = tr.querySelector('.avatar'); return a ? { w: Math.round(a.getBoundingClientRect().width), h: Math.round(a.getBoundingClientRect().height) } : null; })(),
  };
})));
await browser.close();
