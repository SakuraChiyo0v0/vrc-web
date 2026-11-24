import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw; try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const tab = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 });
await tab.goto(`${BASE}#/feed`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await tab.waitForTimeout(2000);
console.log(JSON.stringify(await tab.evaluate(() => {
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
  const inp = document.querySelector('[data-testid="feed-search"]');
  const tbl = document.querySelector('.feed-tbl');
  const toolbar = inp?.closest('.feed-toolbar') || inp?.parentElement;
  const scroll = document.querySelector('.feed-scroll');
  const day = document.querySelector('tr.feed-day');
  const chain = [];
  for (let e = inp; e && e !== document.body; e = e.parentElement) chain.push(`${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ').slice(0, 2).join('.')} ${box(e)} pos=${getComputedStyle(e).position} z=${getComputedStyle(e).zIndex} ov=${getComputedStyle(e).overflow}`);
  const hits = [96, 105, 114, 125, 130, 140].map((y) => { const h = document.elementFromPoint(136, y); return `${y}:${h?.tagName}.${(h?.className || '').toString().slice(0, 30)}`; });
  return { inp: box(inp), toolbar: box(toolbar), scroll: box(scroll), tbl: box(tbl), day: box(day), dayPos: day ? getComputedStyle(day.firstElementChild || day).position + '/' + getComputedStyle(day.firstElementChild || day).zIndex + '/top=' + getComputedStyle(day.firstElementChild || day).top : null, hits, chain };
}), null, 1));
await browser.close();
