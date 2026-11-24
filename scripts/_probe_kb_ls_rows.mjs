// 横屏 + 键盘：feed 表格行是否还剩可用高度、能否滚到最后一行
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = 'http://127.0.0.1:8891';
const EXE = '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
for (const [w, h, kb] of [[844, 390, 220], [932, 430, 240]]) {
  const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await tab.goto(`${BASE}#/feed`, { waitUntil: 'domcontentloaded' });
  await tab.waitForTimeout(1600);
  await tab.locator('[data-testid="feed-search"]').first().click().catch(() => {});
  await tab.evaluate((hh) => {
    const vv = window.visualViewport;
    Object.defineProperty(vv, 'height', { configurable: true, get: () => hh });
    vv.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
  }, h - kb);
  await tab.waitForTimeout(500);
  const r = await tab.evaluate(() => {
    const R = (s) => { const el = document.querySelector(s); const b = el?.getBoundingClientRect(); return b ? { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) } : null; };
    const scroller = [...document.querySelectorAll('body *')].find((el) => {
      const cs = getComputedStyle(el);
      return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight - el.clientHeight > 40 && el.querySelector('tbody tr');
    });
    const rows = [...document.querySelectorAll('tbody tr')];
    const first = rows[0]?.getBoundingClientRect();
    const sb = scroller?.getBoundingClientRect();
    const inView = rows.filter((tr) => { const b = tr.getBoundingClientRect(); return b.top >= (sb?.top ?? 0) && b.bottom <= (sb?.bottom ?? 0); }).length;
    let lastBottom = null;
    if (scroller) { scroller.scrollTop = scroller.scrollHeight; const l = rows[rows.length - 1]?.getBoundingClientRect(); lastBottom = l ? Math.round(l.bottom) : null; }
    return {
      vvH: Math.round(window.visualViewport.height), appVh: getComputedStyle(document.documentElement).getPropertyValue('--app-vh').trim(),
      topbar: R('#vrc-topbar'), main: R('main'), sb: R('#vrc-statusbar'), toolbar: R('[data-testid="feed-toolbar"]'),
      scroller: scroller ? { h: scroller.clientHeight, scroll: scroller.scrollHeight, top: Math.round(sb.top), bottom: Math.round(sb.bottom) } : null,
      rows: rows.length, rowH: first ? Math.round(first.height) : null, firstRowTop: first ? Math.round(first.top) : null,
      fullyVisibleRows: inView, lastBottom, headerH: (() => { const t = document.querySelector('thead'); return t ? Math.round(t.getBoundingClientRect().height) : null; })(),
    };
  });
  console.log(`${w}x${h} kb${kb}:`, JSON.stringify(r));
  await tab.close();
}
await browser.close();
