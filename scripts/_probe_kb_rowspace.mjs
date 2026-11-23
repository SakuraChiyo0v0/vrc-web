/**
 * 探针：横屏 + 软键盘（844×390 键盘 220 → 可视 170）下 feed 表格还剩多少可用空间。
 * 关注：主内容高、工具栏高、表头/首行是否还有可读高度、行是否可滚、聚焦搜索框是否仍可见。
 */
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
for (const [w, h, kb] of [[844, 390, 220], [932, 430, 240]]) {
  const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await tab.goto(`${BASE}#/feed`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await tab.waitForTimeout(1400);
  await tab.waitForSelector('#vrc-statusbar', { timeout: 15000 }).catch(() => {});
  await tab.locator('[data-testid="feed-search"]').first().click({ timeout: 5000 }).catch(() => {});
  await tab.evaluate((hh) => {
    const vv = window.visualViewport;
    Object.defineProperty(vv, 'height', { configurable: true, get: () => hh });
    vv.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
  }, h - kb);
  await tab.waitForTimeout(500);
  const d = await tab.evaluate(() => {
    const box = (s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; };
    const rows = [...document.querySelectorAll('tbody tr')];
    const vis = rows.filter((r) => { const b = r.getBoundingClientRect(); return b.top >= 0 && b.bottom <= window.visualViewport.height && b.height > 0; });
    const scroller = [...document.querySelectorAll('body *')].find((el) => /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 20);
    const firstRow = rows[0];
    const th = document.querySelector('thead');
    return {
      vvH: Math.round(window.visualViewport.height),
      appVh: getComputedStyle(document.documentElement).getPropertyValue('--app-vh').trim(),
      kb: document.documentElement.dataset.kb || null,
      topbar: box('#vrc-topbar'), sb: box('#vrc-statusbar'), main: box('main'),
      toolbar: box('.feed-toolbar'), search: box('[data-testid="feed-search"]'),
      thead: th ? box('thead') : null,
      rowH: rows.length ? Math.round(rows[0].getBoundingClientRect().height) : null,
      rows: rows.length, rowsFullyVisible: vis.length,
      firstRowTop: firstRow ? Math.round(firstRow.getBoundingClientRect().top) : null,
      scroll: scroller ? { top: Math.round(scroller.scrollTop), client: scroller.clientHeight, scrollH: scroller.scrollHeight, cls: (scroller.className || '').toString().split(' ')[0] } : null,
      statusItems: document.querySelectorAll('#vrc-statusbar [data-status-item]').length,
    };
  });
  console.log(`\n=== ${w}x${h} 键盘 ${kb} ===`);
  console.log(JSON.stringify(d, null, 1));
  await tab.close();
}
await browser.close();
