// 320×568（最小常见宽度）全页体检：右溢 / 卡片化 / 字号 / 命中区 / 内容区
import { createRequire } from 'node:module';
import { STRUCT_PAGES } from './lib/page_structure.mjs';
const _req = createRequire(import.meta.url);
let _pw; try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const PAGES = ['friends', ...STRUCT_PAGES.filter((p) => p !== 'locations')];
const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
for (const p of PAGES) {
  const tab = await ctx.newPage();
  await tab.goto(`${BASE}#/${p}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await tab.waitForTimeout(600);
  const a = await tab.evaluate(() => {
    const de = document.documentElement;
    const vw = window.innerWidth;
    const offenders = [];
    const walk = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.right > vw + 1) {
        const cs = getComputedStyle(el);
        if (cs.overflowX !== 'auto' && cs.overflowX !== 'scroll' && cs.position !== 'fixed')
          offenders.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}(${Math.round(r.right)})`);
      }
      for (const c of el.children) walk(c);
    };
    walk(document.body);
    let minFont = 99; const tap = [];
    document.querySelectorAll('body *').forEach((el) => {
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = el.getBoundingClientRect(); const text = (el.textContent || '').trim();
      if (text && r.width > 0 && r.height > 0 && el.children.length === 0) minFont = Math.min(minFont, Math.round(parseFloat(cs.fontSize) * 10) / 10);
      if (el.matches('button, a[href], [role="button"], input, select') && r.width > 0 && r.height > 0)
        tap.push(Math.round(r.height));
    });
    const th = document.querySelector('thead'); const tr = document.querySelector('tbody tr');
    const main = document.querySelector('main');
    const sb = document.querySelector('#vrc-statusbar');
    return { vw, sw: de.scrollWidth, offenders: [...new Set(offenders)].slice(0, 6), minFont,
      tapMin: tap.length ? Math.min(...tap) : null, thead: th ? getComputedStyle(th).display : null,
      tr: tr ? getComputedStyle(tr).display : null, mainW: main ? Math.round(main.getBoundingClientRect().width) : null,
      sbSW: sb ? sb.scrollWidth : null, sbCW: sb ? sb.clientWidth : null };
  });
  const bad = [];
  if (a.sw > a.vw + 1) bad.push(`右溢 sw=${a.sw}`);
  if (a.thead && (a.thead !== 'none' || a.tr !== 'flex')) bad.push(`未卡片化 thead=${a.thead} tr=${a.tr}`);
  if (a.minFont < 11) bad.push(`字号${a.minFont}`);
  if (a.tapMin != null && a.tapMin < 32) bad.push(`触控${a.tapMin}`);
  if (a.mainW != null && a.mainW <= 0) bad.push(`mainW=${a.mainW}`);
  console.log(`${p.padEnd(12)} ${bad.length ? 'FAIL ' + bad.join(' ') : 'OK'}  f=${a.minFont} tap=${a.tapMin} main=${a.mainW} sb=${a.sbSW}/${a.sbCW}${a.offenders.length ? '  ' + a.offenders.join(' ') : ''}`);
  await tab.close();
}
await browser.close();
