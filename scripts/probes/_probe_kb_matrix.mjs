/**
 * 探针：13 页 × 横屏+键盘（844×390 kb220 / 932×430 kb240）的首屏内容可用性。
 * 每页一个内容选择器（与 mobile_parity 的 kb-matrix 断言同一张表）：
 *   输出 main 高、首块 top/高/可见高、完整可见块数。只打印，不下断言。
 */
import { createRequire } from 'node:module';
import { STRUCT_PAGES, assertVrcServer } from '../lib/page_structure.mjs';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
await assertVrcServer(BASE);
const PAGES = ['friends', ...STRUCT_PAGES.filter((p) => p !== 'locations')];
// 每页「内容元素」：列表行/卡片，或整区块（概览/图表/设置这类天然高于视口的块）
export const CONTENT_SEL = {
  overview: '.ov-shell > *', search: '.world-card', feed: 'tbody tr', sessions: '.sess-row',
  players: '.empty, .card', moderation: 'tbody tr', favorites: '.fav-card', insights: '.graph-wrap',
  friendlist: 'tbody tr', friendlog: 'tbody tr', gamelog: '.card', settings: '.card', friends: '.loc-group',
};
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
for (const [w, h, kbH] of [[844, 390, 220], [932, 430, 240]]) {
  for (const page of PAGES) {
    const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await tab.goto(`${BASE}#/${page}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await tab.waitForTimeout(1600);
    await tab.evaluate((hh) => {
      const vv = window.visualViewport;
      Object.defineProperty(vv, 'height', { configurable: true, get: () => hh });
      vv.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('resize'));
    }, h - kbH);
    await tab.waitForTimeout(500);
    const d = await tab.evaluate((sel) => {
      const vvH = window.visualViewport.height;
      const main = document.querySelector('main') || document.querySelector('#root > div > div:last-child');
      const mb = main.getBoundingClientRect();
      const els = [...document.querySelectorAll(sel)].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.height > 0 && getComputedStyle(e).display !== 'none';
      });
      const rects = els.map((e) => { const r = e.getBoundingClientRect(); return { h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
      const fully = rects.filter((r) => r.top >= -1 && r.bottom <= vvH + 1);
      const f = rects[0] || null;
      return {
        vvH: Math.round(vvH), mainH: Math.round(mb.height), n: rects.length, fully: fully.length, first: f,
        vis: f ? Math.max(0, Math.min(Math.round(f.bottom), Math.round(vvH)) - Math.max(0, f.top)) : 0,
        kb: document.documentElement.getAttribute('data-kb'),
      };
    }, CONTENT_SEL[page]);
    console.log(`${String(page).padEnd(11)} @${w}x${h} kb=${d.kb} vv=${d.vvH} main=${d.mainH} n=${d.n} fully=${d.fully} first=${d.first ? `${d.first.h}px top=${d.first.top}` : '-'} vis=${d.vis}`);
    await tab.close();
  }
}
await browser.close();
