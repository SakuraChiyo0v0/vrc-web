import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw; try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE, args:['--no-sandbox','--disable-dev-shm-usage'] });
const tab = await browser.newPage({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true });
await tab.goto(`${BASE}#/friends`, { waitUntil:'domcontentloaded' });
await tab.waitForTimeout(1000);
await tab.click('button[aria-label="菜单"]');
await tab.waitForTimeout(400);
const where = () => tab.evaluate(() => {
  const a=document.activeElement;
  return { tag:a?.tagName, label:(a?.getAttribute?.('aria-label')||a?.textContent||'').trim().slice(0,14), inSidebar:!!a?.closest?.('.vrc-sidebar'), inMain:!!a?.closest?.('main') };
});
await tab.setViewportSize({width:1024,height:768}); await tab.waitForTimeout(700);
console.log('desktop state', JSON.stringify(await tab.evaluate(()=>({open:document.querySelector('.vrc-sidebar').dataset.open, left:Math.round(document.querySelector('.vrc-sidebar').getBoundingClientRect().left)}))));
for (let i=0;i<6;i++){ await tab.keyboard.press('Tab'); console.log('tab'+(i+1), JSON.stringify(await where())); }
// Esc on desktop 是否误关/误操作
await tab.keyboard.press('Escape'); await tab.waitForTimeout(300);
console.log('desktop after Esc', JSON.stringify(await tab.evaluate(()=>({open:document.querySelector('.vrc-sidebar').dataset.open, left:Math.round(document.querySelector('.vrc-sidebar').getBoundingClientRect().left)}))));
// 桌面下点抽屉里的链接仍可用？（不遮 main）
await tab.close();

// B) 844x390 抽屉底部按钮是否压在状态栏上
{
  const t = await browser.newPage({ viewport:{width:844,height:390}, hasTouch:true });
  await t.goto(`${BASE}#/friends`, { waitUntil:'domcontentloaded' }); await t.waitForTimeout(900);
  await t.click('button[aria-label="菜单"]'); await t.waitForTimeout(400);
  const r = await t.evaluate(() => {
    const s=document.querySelector('.vrc-sidebar');
    const items=[...s.querySelectorAll('.nav-item')]; const last=items[items.length-1];
    const lb=last.getBoundingClientRect();
    const sb=document.querySelector('#vrc-statusbar');
    const sbr=sb?sb.getBoundingClientRect():null;
    return { lastBtn:[Math.round(lb.left),Math.round(lb.top),Math.round(lb.bottom)], sbTop: sbr?Math.round(sbr.top):null,
      overlap: sbr ? Math.round(Math.max(0, lb.bottom - sbr.top)) : null,
      elAtBottom: (()=>{const e=document.elementFromPoint(Math.round(lb.left+10), Math.round(lb.bottom)-6); return e?e.className.toString().slice(0,30):null;})(),
      sbZ: sb?getComputedStyle(sb).zIndex:null, sideZ:getComputedStyle(s).zIndex };
  });
  console.log('landscape sidebar footer', JSON.stringify(r));
  await t.close();
}
await browser.close();
