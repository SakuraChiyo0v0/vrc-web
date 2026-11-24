import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw; try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox','--disable-dev-shm-usage'] });
for (const [w,h] of [[390,844],[844,390],[932,430]]) {
  const tab = await browser.newPage({ viewport:{width:w,height:h}, hasTouch:true });
  await tab.goto(`${BASE}#/friends`, { waitUntil:'domcontentloaded' });
  await tab.waitForTimeout(1000);
  await tab.click('button[aria-label="菜单"]');
  await tab.waitForTimeout(400);
  const r = await tab.evaluate(() => {
    const s = document.querySelector('.vrc-sidebar');
    const nav = s.querySelector('nav') || s;
    const items=[...s.querySelectorAll('.nav-item')];
    const hs=[...new Set(items.map(n=>Math.round(n.getBoundingClientRect().height)))];
    return { sidebarH:Math.round(s.getBoundingClientRect().height), navCS:getComputedStyle(nav).overflowY,
      navH:Math.round(nav.getBoundingClientRect().height), navScroll:nav.scrollHeight,
      itemHeights:hs, n:items.length, first:items[0]&&items[0].getBoundingClientRect().top|0,
      lastBottom: items.length?Math.round(items[items.length-1].getBoundingClientRect().bottom):null,
      sidebarOverflow:getComputedStyle(s).overflowY, flexShrink: items[0]&&getComputedStyle(items[0]).flexShrink,
      sidebarDisplay:getComputedStyle(s).display };
  });
  console.log(w+'x'+h, JSON.stringify(r));
  await tab.close();
}
await browser.close();
