import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw; try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
for (const [page, sel] of [['feed', '[data-testid="feed-search"]'], ['sessions', 'input[placeholder="搜索房间"]']]) {
  const tab = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 });
  await tab.goto(`${BASE}#/${page}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await tab.waitForTimeout(1800);
  const info = await tab.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { found: false };
    const r = el.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const hit = document.elementFromPoint(cx, cy);
    const cs = getComputedStyle(el);
    return { found: true, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], hit: hit ? hit.tagName + '.' + (hit.className || '').toString().slice(0, 40) : null, same: hit === el, pe: cs.pointerEvents, vis: cs.visibility, disp: cs.display, cx, cy };
  }, sel);
  console.log(page, JSON.stringify(info));
  if (info.found) {
    await tab.mouse.click(info.cx, info.cy);
    await tab.waitForTimeout(200);
    console.log(page, 'after mouse click focus:', await tab.evaluate(() => document.activeElement?.tagName));
    await tab.evaluate((sel) => document.querySelector(sel)?.focus(), sel);
    await tab.waitForTimeout(100);
    console.log(page, 'after js focus:', await tab.evaluate(() => document.activeElement?.tagName + ':' + document.activeElement?.getAttribute('placeholder')));
  }
  await tab.close();
}
await browser.close();
