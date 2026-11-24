// 触控降档残留盘点：列出 13 页 @390 与 844×390 上所有 <36 的可交互元素（含是否在白名单里）
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw; try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const PAGES = ['friends', 'overview', 'feed', 'friendlist', 'friendlog', 'worlds', 'favorites', 'players', 'search', 'sessions', 'gamelog', 'stats', 'insights', 'settings'];
const ALLOW = '[data-tab].ov-tab, .sess-seg button, .sess-row, .sess-self, [data-list-row] button, [data-list-row] a, .gl-inst button, .gl-inst a, tbody td button, tbody td a, .vrc-sidebar .nav-sub .nav-item';
const VIEWS = [{ w: 390, h: 844 }, { w: 844, h: 390 }];
const browser = await chromium.launch({ executablePath: EXE });
for (const v of VIEWS) {
  console.log(`\n=== ${v.w}x${v.h} ===`);
  for (const page of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const tab = await ctx.newPage();
    await tab.goto(`${BASE}#/${page}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await tab.waitForTimeout(900);
    const rows = await tab.evaluate((allowSel) => {
      const out = [];
      document.querySelectorAll('button, a[href], [role="button"], input, select').forEach((el) => {
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || b.width <= 0 || b.height <= 0) return;
        const hh = Math.round(b.height);
        if (hh >= 36) return;
        const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 14);
        const cls = (el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.');
        out.push({ h: hh, label, cls: `${el.tagName.toLowerCase()}.${cls}`, allow: el.matches(allowSel) });
      });
      const agg = new Map();
      for (const o of out) {
        const k = `${o.cls}|${o.h}|${o.allow ? 'allow' : 'NOALLOW'}`;
        const e = agg.get(k) || { ...o, n: 0 };
        e.n++;
        agg.set(k, e);
      }
      return [...agg.values()];
    }, ALLOW);
    console.log(`-- ${page}: ${rows.length ? '' : 'OK（无 <36）'}`);
    for (const r of rows) console.log(`   ${r.h}px ${r.allow ? 'allow  ' : 'NOALLOW'} ×${r.n} ${r.cls} "${r.label}"`);
    await ctx.close();
  }
}
await browser.close();
