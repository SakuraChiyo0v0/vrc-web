
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw; try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE });
for (const [w, h] of [[320, 568], [844, 390], [390, 844]]) {
  const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await tab.goto(`${BASE}#/friends`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await tab.waitForTimeout(1200);
  await tab.locator('.friend-row:not(.list-head)').first().click({ timeout: 8000, force: true }).catch(() => {});
  await tab.waitForSelector('.fd-card', { timeout: 8000 }).catch(() => {});
  await tab.waitForTimeout(400);
  const r = await tab.evaluate(() => {
    const card = document.querySelector('.fd-card');
    const tabs = document.querySelector('.fd-tabs');
    const cr = card.getBoundingClientRect();
    const tr = tabs.getBoundingClientRect();
    const cs = getComputedStyle(card);
    const info = [...tabs.querySelectorAll('button')].map((b) => {
      const br = b.getBoundingClientRect();
      const hit = document.elementFromPoint(Math.round(br.left + br.width / 2), Math.round(br.top + br.height / 2));
      return { t: b.textContent.trim().slice(0, 6), x: Math.round(br.left), y: Math.round(br.top), w: Math.round(br.width), h: Math.round(br.height), r: Math.round(br.right),
        hit: hit ? `${hit.tagName}.${(hit.className || '').toString().split(' ')[0]}` : 'null' };
    });
    return { card: { y: Math.round(cr.y), b: Math.round(cr.bottom), h: Math.round(cr.height), ovf: cs.overflowY, st: Math.round(card.scrollTop) },
      tabs: { y: Math.round(tr.y), b: Math.round(tr.bottom), w: Math.round(tr.width), dir: getComputedStyle(tabs).flexDirection, wrap: getComputedStyle(tabs).flexWrap },
      cardInner: card.clientWidth, info };
  });
  console.log(`${w}x${h}`, JSON.stringify(r));
  await tab.close();
}
await browser.close();
