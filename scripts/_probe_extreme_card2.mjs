import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.argv[2] || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const tab = await browser.newPage({ viewport: { width: 360, height: 800 }, hasTouch: true });
await tab.goto(`${BASE}#/feed`, { waitUntil: 'domcontentloaded' });
await tab.waitForTimeout(2000);
const r = await tab.evaluate(() => {
  const tr = document.querySelector('tbody tr');
  if (!tr) return { err: 'no row' };
  const out = [...tr.children].map((td) => {
    const cs = getComputedStyle(td);
    return { tag: td.tagName, label: td.dataset.label, html: td.innerHTML.slice(0, 160), ws: cs.whiteSpace, ov: cs.overflow + '/' + cs.textOverflow, display: cs.display, minW: cs.minWidth };
  });
  return { tr: getComputedStyle(tr).cssText, cells: out };
});
console.log(JSON.stringify(r, null, 1));
// 再试：把玩家格内文本换成超长串，看真实行为
const r2 = await tab.evaluate(() => {
  const tr = document.querySelector('tbody tr');
  const td = [...tr.children].find((x) => x.dataset.label === '玩家');
  const target = td.querySelector('span, a, div') || td;
  target.textContent = '异常漫长的玩家昵称'.repeat(12);
  const b = td.getBoundingClientRect();
  return { html: td.innerHTML.slice(0, 200), tdW: Math.round(b.width), sw: td.scrollWidth, cw: td.clientWidth, h: Math.round(b.height),
    targetCS: (() => { const c = getComputedStyle(target); return `${c.whiteSpace} ${c.overflow} ${c.textOverflow} ${c.overflowWrap}`; })() };
});
console.log(JSON.stringify(r2, null, 1));
await browser.close();
