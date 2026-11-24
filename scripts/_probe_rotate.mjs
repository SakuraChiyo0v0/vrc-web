import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw; try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE, args:['--no-sandbox','--disable-dev-shm-usage'] });

// A) 横屏抽屉 nav 滚动到底（等平滑滚动结束）后最后一项是否在可视区
for (const [w,h] of [[844,390],[390,844]]) {
  const tab = await browser.newPage({ viewport:{width:w,height:h}, hasTouch:true });
  await tab.goto(`${BASE}#/friends`, { waitUntil:'domcontentloaded' });
  await tab.waitForTimeout(900);
  await tab.click('button[aria-label="菜单"]');
  await tab.waitForTimeout(400);
  await tab.evaluate(()=>{const n=document.querySelector('.vrc-sidebar nav'); n.scrollTo({top:n.scrollHeight,behavior:'instant'});});
  await tab.waitForTimeout(400);
  const r = await tab.evaluate(() => {
    const n=document.querySelector('.vrc-sidebar nav');
    const items=[...document.querySelectorAll('.vrc-sidebar .nav-item')];
    const last=items[items.length-1];
    const nr=n.getBoundingClientRect(), lr=last.getBoundingClientRect();
    return { scrollTop:Math.round(n.scrollTop), max:n.scrollHeight-n.clientHeight, navTop:Math.round(nr.top), navBottom:Math.round(nr.bottom),
      lastTop:Math.round(lr.top), lastBottom:Math.round(lr.bottom), inView: lr.top>=nr.top-1 && lr.bottom<=nr.bottom+1,
      smooth:getComputedStyle(n).scrollBehavior, last:last.textContent.trim().slice(0,10) };
  });
  console.log(`navscroll ${w}x${h}`, JSON.stringify(r));
  await tab.close();
}

// B) 旋转：竖屏开抽屉 → 转平板宽（≥1024）桌面形态；再转矮横屏
{
  const tab = await browser.newPage({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true });
  await tab.goto(`${BASE}#/friends`, { waitUntil:'domcontentloaded' });
  await tab.waitForTimeout(1000);
  await tab.click('button[aria-label="菜单"]');
  await tab.waitForTimeout(400);
  const snap = () => tab.evaluate(() => {
    const s=document.querySelector('.vrc-sidebar'); const b=s.getBoundingClientRect();
    const hamburger=document.querySelector('button[aria-label="菜单"]');
    const hb=hamburger?hamburger.getBoundingClientRect():null;
    return { open:s.dataset.open, left:Math.round(b.left), w:Math.round(b.width), h:Math.round(b.height),
      hamburgerVisible: hb ? hb.width>0 : null,
      bodyOverflow:getComputedStyle(document.body).overflow, bodyPad:getComputedStyle(document.body).paddingRight,
      main:Math.round(document.querySelector('main')?.getBoundingClientRect().width||0),
      scrollW:document.documentElement.scrollWidth, vw:window.innerWidth,
      focusInSidebar:!!document.activeElement?.closest?.('.vrc-sidebar') };
  });
  console.log('portrait+drawer', JSON.stringify(await snap()));
  await tab.setViewportSize({ width:1024, height:768 }); await tab.waitForTimeout(600);
  console.log('->1024x768', JSON.stringify(await snap()));
  await tab.setViewportSize({ width:844, height:390 }); await tab.waitForTimeout(600);
  console.log('->844x390', JSON.stringify(await snap()));
  // 横屏再点 ☰ 能否开
  await tab.click('button[aria-label="菜单"]').catch(e=>console.log('click err', e.message));
  await tab.waitForTimeout(400);
  console.log('landscape open again', JSON.stringify(await snap()));
  // Esc 能否关，焦点是否回来
  await tab.keyboard.press('Escape'); await tab.waitForTimeout(400);
  console.log('after Esc', JSON.stringify(await snap()));
  await tab.setViewportSize({ width:390, height:844 }); await tab.waitForTimeout(600);
  console.log('back portrait', JSON.stringify(await snap()));
  await tab.close();
}
await browser.close();
