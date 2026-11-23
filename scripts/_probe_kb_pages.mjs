/**
 * 探针：横屏 + 软键盘（844×390 键盘 220 → 可视 170 / 932×430 键盘 240 → 190）
 * 在「其他带搜索的页」上还剩多少可用空间：sessions（需先点搜索段）、friendlist、friendlog、players、favorites。
 * 关注：主内容高、首行可读高、搜索框是否仍完整可见且中心可点、表格是否还能滚到底。
 */
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const CASES = [
  ['sessions', 'input[placeholder="搜索房间"]', true],
  ['friendlist', 'input[placeholder="搜索好友"]', false],
  ['friendlog', 'input[placeholder="搜索好友日志"]', false],
  ['players', 'input[placeholder="查找好友"]', false],
  ['favorites', 'input[placeholder="搜索"]', false],
];

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
for (const [w, h, kb] of [[844, 390, 220], [932, 430, 240]]) {
  for (const [page, sel, needSegment] of CASES) {
    const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await tab.goto(`${BASE}#/${page}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await tab.waitForTimeout(1400);
    await tab.waitForSelector('#vrc-statusbar', { timeout: 15000 }).catch(() => {});
    if (needSegment) {
      // sessions 默认 mode=day 没有搜索框，先点「搜索」段
      await tab.getByRole('button', { name: '搜索' }).first().click({ timeout: 4000 }).catch(() => {});
      await tab.waitForTimeout(500);
    }
    const found = await tab.locator(sel).first().isVisible().catch(() => false);
    if (found) { await tab.locator(sel).first().click({ timeout: 4000 }).catch(() => {}); await tab.waitForTimeout(150); }
    const focused = found ? await tab.evaluate((s) => document.querySelector(s) === document.activeElement, sel) : null;
    await tab.evaluate((hh) => {
      const vv = window.visualViewport;
      Object.defineProperty(vv, 'height', { configurable: true, get: () => hh });
      vv.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('resize'));
    }, h - kb);
    await tab.waitForTimeout(500);
    const d = await tab.evaluate((s) => {
      const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width) }; };
      const inp = document.querySelector(s);
      const ib = inp ? inp.getBoundingClientRect() : null;
      const hit = ib ? (document.elementFromPoint(ib.left + ib.width / 2, ib.top + ib.height / 2) || {}) : null;
      const hitTag = hit ? `${hit.tagName}${hit === inp ? '(=input)' : ''}` : null;
      const rows = [...document.querySelectorAll('tbody tr')].filter((r) => r.getBoundingClientRect().height > 0);
      const vvH = window.visualViewport.height;
      const vis = rows.filter((r) => { const b = r.getBoundingClientRect(); return b.top >= 0 && b.bottom <= vvH; });
      const main = document.querySelector('main');
      const scroller = main ? [...main.querySelectorAll('*')].find((el) => /auto|scroll/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 20) : null;
      return {
        kb: document.documentElement.dataset.kb || null,
        main: box(main), search: box(inp), searchHit: hitTag,
        sb: box(document.querySelector('#vrc-statusbar')),
        rows: rows.length, rowsFullyVisible: vis.length,
        rowH: rows.length ? Math.round(rows[0].getBoundingClientRect().height) : null,
        rowTop: rows.length ? Math.round(rows[0].getBoundingClientRect().top) : null,
        scroll: scroller ? { client: scroller.clientHeight, scrollH: scroller.scrollHeight } : null,
      };
    }, sel);
    console.log(`\n=== ${w}x${h} 键盘 ${kb} · ${page} ===`);
    console.log(JSON.stringify({ searchVisible: found, focused, ...d }));
    await tab.close();
  }
}
await browser.close();
