import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw; try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE, args:['--no-sandbox','--disable-dev-shm-usage'] });

// 1) 横屏抽屉：nav 自身可滚，滚到底最后一项可见且可点
for (const [w,h] of [[844,390],[932,430],[390,844]]) {
  const tab = await browser.newPage({ viewport:{width:w,height:h}, hasTouch:true });
  await tab.goto(`${BASE}#/friends`, { waitUntil:'domcontentloaded' });
  await tab.waitForTimeout(1000);
  await tab.click('button[aria-label="菜单"]');
  await tab.waitForTimeout(400);
  const r = await tab.evaluate(() => {
    const s = document.querySelector('.vrc-sidebar');
    const nav = s.querySelector('nav');
    const items=[...s.querySelectorAll('.nav-item')];
    const last=items[items.length-1];
    const b0=Math.round(last.getBoundingClientRect().bottom);
    nav.scrollTop = nav.scrollHeight;
    const b1=Math.round(last.getBoundingClientRect().bottom);
    const navRect=nav.getBoundingClientRect();
    const lastRect=last.getBoundingClientRect();
    return { before:b0, after:b1, navTop:Math.round(navRect.top), navBottom:Math.round(navRect.bottom),
      lastTop:Math.round(lastRect.top), vh:window.innerHeight, scrollTop:Math.round(nav.scrollTop), max:nav.scrollHeight-nav.clientHeight,
      inView: lastRect.top>=navRect.top-1 && lastRect.bottom<=navRect.bottom+1, label:last.textContent.trim().slice(0,8) };
  });
  let clickable=null;
  try { await tab.evaluate(()=>{const s=document.querySelector('.vrc-sidebar');const n=s.querySelector('nav');n.scrollTop=n.scrollHeight;});
    const last = await tab.evaluate(()=>{const s=document.querySelector('.vrc-sidebar');const i=[...s.querySelectorAll('.nav-item')];const l=i[i.length-1];const b=l.getBoundingClientRect();return {x:Math.round(b.left+b.width/2),y:Math.round(b.top+b.height/2),t:l.textContent.trim()};});
    await tab.mouse.click(last.x,last.y); await tab.waitForTimeout(500);
    clickable = { clicked:last.t.slice(0,8), hash:await tab.evaluate(()=>location.hash), hashEl:await tab.evaluate(()=>document.elementFromPoint(10,200)?.tagName) };
  } catch(e){ clickable='ERR '+e.message; }
  console.log(`navscroll ${w}x${h}`, JSON.stringify(r), JSON.stringify(clickable));
  await tab.close();
}

// 2) 状态栏在 320/360/390 是否被裁
for (const w of [320,360,390]) {
  const tab = await browser.newPage({ viewport:{width:w,height:760}, hasTouch:true });
  await tab.goto(`${BASE}#/friends`, { waitUntil:'domcontentloaded' });
  await tab.waitForTimeout(1000);
  const r = await tab.evaluate(() => {
    const s=document.querySelector('#vrc-statusbar');
    const spans=[...s.querySelectorAll('span')].map(e=>({t:e.textContent.trim().slice(0,14),r:Math.round(e.getBoundingClientRect().right),w:Math.round(e.getBoundingClientRect().width)}));
    const b=s.getBoundingClientRect();
    return { bar:[Math.round(b.left),Math.round(b.right)], sw:s.scrollWidth, cw:s.clientWidth, ov:getComputedStyle(s).overflow,
      lastSpan:spans[spans.length-1], over:spans.filter(x=>x.r>window.innerWidth+1).length, n:spans.length };
  });
  console.log('statusbar '+w, JSON.stringify(r));
  await tab.close();
}
await browser.close();
