// 设置页左上子导航（系统/界面/社交…共 10 项）在移动形态下的可达性与命中区
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw; try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const CASE = [
  { w: 390, h: 844, kb: 0 },
  { w: 360, h: 800, kb: 0 },
  { w: 844, h: 390, kb: 0 },
  { w: 932, h: 430, kb: 0 },
  { w: 844, h: 390, kb: 220 },
];
const browser = await chromium.launch({ executablePath: EXE });
for (const c of CASE) {
  const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const tab = await ctx.newPage();
  await tab.goto(`${BASE}#/settings`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await tab.waitForTimeout(700);
  if (c.kb) {
    await tab.evaluate((h) => {
      document.documentElement.style.setProperty('--app-vh', `${window.innerHeight - h}px`);
      document.documentElement.setAttribute('data-kb', '1');
    }, c.kb);
    await tab.waitForTimeout(200);
  }
  const r = await tab.evaluate(() => {
    const nav = document.querySelector('.settings-subnav');
    if (!nav) return { found: false };
    const items = [...nav.querySelectorAll('[data-subnav-item]')];
    const nb = nav.getBoundingClientRect();
    const cs = getComputedStyle(nav);
    const hs = items.map((el) => Math.round(el.getBoundingClientRect().height));
    const last = items[items.length - 1];
    const lb = last.getBoundingClientRect();
    // 最后一个条目中心点命中的是谁（判断是否被裁/被别的元素盖住）
    const cx = Math.round(lb.left + lb.width / 2), cy = Math.round(Math.min(lb.bottom - 4, nb.bottom - 4));
    const hit = document.elementFromPoint(cx, cy);
    return {
      found: true,
      navH: Math.round(nb.height), navClient: nav.clientHeight, navScroll: nav.scrollHeight,
      overflowY: cs.overflowY, itemH: [...new Set(hs)].join('/'),
      lastBottom: Math.round(lb.bottom), navBottom: Math.round(nb.bottom),
      lastVisible: lb.bottom <= nb.bottom + 1 && lb.top >= nb.top - 1,
      hit: hit ? `${hit.tagName.toLowerCase()}${hit.dataset?.subnavItem ? '[subnav-item]' : ''}` : null,
      hitText: hit ? (hit.textContent || '').trim().slice(0, 6) : null,
      canScroll: nav.scrollHeight > nav.clientHeight + 1,
    };
  });
  console.log(`${c.w}x${c.h}${c.kb ? '+kb' + c.kb : ''}`, JSON.stringify(r));
  if (r.canScroll) {
    const after = await tab.evaluate(() => {
      const nav = document.querySelector('.settings-subnav');
      nav.scrollTop = 9999;
      const items = [...nav.querySelectorAll('[data-subnav-item]')];
      const nb = nav.getBoundingClientRect();
      const lb = items[items.length - 1].getBoundingClientRect();
      return { scrollTop: nav.scrollTop, lastBottom: Math.round(lb.bottom), navBottom: Math.round(nb.bottom), reachable: lb.bottom <= nb.bottom + 1 };
    });
    console.log('   scroll→', JSON.stringify(after));
  }
  await ctx.close();
}
await browser.close();
