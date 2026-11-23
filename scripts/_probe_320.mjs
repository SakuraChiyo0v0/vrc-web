/**
 * 探针：极窄视口（320×568，iPhone SE 初代）下状态栏与顶栏是否被裁。
 *   node scripts/_probe_320.mjs [baseUrl]
 */
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.argv[2]?.startsWith('http') ? process.argv[2] : (process.env.VRC_BASE || 'http://127.0.0.1:8891');
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

for (const [w, h] of [[320, 568], [360, 800], [390, 844]]) {
  const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2 });
  await tab.goto(`${BASE}#/feed`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await tab.waitForTimeout(1500);
  const r = await tab.evaluate(() => {
    const sb = document.querySelector('#vrc-statusbar');
    const items = [...sb.querySelectorAll('[data-status-item]')];
    const last = items[items.length - 1];
    const bar = sb.getBoundingClientRect();
    return {
      docW: document.documentElement.scrollWidth,
      sbClient: sb.clientWidth, sbScroll: sb.scrollWidth,
      sbRight: Math.round(bar.right),
      items: items.map((el) => ({ id: el.dataset.statusItem, w: Math.round(el.getBoundingClientRect().width), right: Math.round(el.getBoundingClientRect().right) })),
      lastClipped: last ? Math.round(last.getBoundingClientRect().right) > Math.round(bar.right) : null,
      overflowX: getComputedStyle(sb).overflowX,
      gap: getComputedStyle(sb).columnGap,
    };
  });
  console.log(`320probe@${w}x${h}`, JSON.stringify(r));
  await tab.close();
}
await browser.close();
