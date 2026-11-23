/** 探针：竖屏键盘下卡片是否仍整行堆叠（横屏紧凑规则不该漏到竖屏）。 */
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw; try { _pw = _req('playwright'); } catch { _pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
for (const [w, h] of [[390, 844], [844, 390]]) {
  const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await tab.goto(`${BASE}#/feed`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await tab.waitForTimeout(1400);
  await tab.locator('[data-testid="feed-search"]').first().click({ timeout: 5000 }).catch(() => {});
  await tab.evaluate((hh) => { const vv = window.visualViewport; Object.defineProperty(vv, 'height', { configurable: true, get: () => hh }); vv.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('resize')); }, h <= 500 ? h - 220 : 430);
  await tab.waitForTimeout(500);
  const d = await tab.evaluate(() => {
    const tr = document.querySelector('tbody tr'); const tds = tr ? [...tr.querySelectorAll('td')] : [];
    const rowW = tr ? tr.getBoundingClientRect().width : 0;
    const cells = tds.slice(1).filter((td) => td.getBoundingClientRect().width > 0);
    const sb = document.querySelector('#vrc-statusbar')?.getBoundingClientRect();
    return { kb: document.documentElement.dataset.kb || null, rowW: Math.round(rowW), tdW: cells.map((td) => Math.round(td.getBoundingClientRect().width)),
      ratio: rowW && cells.length ? Math.round(Math.max(...cells.map((td) => td.getBoundingClientRect().width)) / rowW * 100) : null,
      sbH: sb ? Math.round(sb.height) : null, rowH: tr ? Math.round(tr.getBoundingClientRect().height) : null };
  });
  console.log(`${w}x${h}`, JSON.stringify(d));
  await tab.close();
}
await browser.close();
