/** 探针：移动端输入框字号（iOS Safari <16px 会自动放大）与顶栏/抽屉安全区内边距现状 */
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const PAGES = ['friends', 'feed', 'friendlist', 'search', 'settings', 'worlds', 'notifications'];

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const tab = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

for (const p of PAGES) {
  await tab.goto(`${BASE}#/${p}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await tab.waitForTimeout(1400);
  const r = await tab.evaluate(() => {
    const box = (el) => { const b = el.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top) }; };
    const inputs = [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]), select, textarea')]
      .filter((el) => el.offsetParent !== null || el.getClientRects().length)
      .map((el) => ({ tag: el.tagName.toLowerCase(), type: el.type || '', fs: parseFloat(getComputedStyle(el).fontSize), ph: el.placeholder || '', ...box(el) }));
    const top = document.querySelector('[data-topbar]') || document.querySelector('header');
    const drawer = document.querySelector('aside, [data-sidebar], nav');
    const cs = top ? getComputedStyle(top) : null;
    // 焦点到输入框后视口缩放（Chromium 无自动放大，只看基准是否需要修）
    return {
      inputs,
      topbar: top ? { ...box(top), padTop: cs.paddingTop, padBottom: cs.paddingBottom } : null,
      drawer: drawer ? { ...box(drawer), padTop: getComputedStyle(drawer).paddingTop, padBottom: getComputedStyle(drawer).paddingBottom } : null,
      vh: window.innerHeight,
    };
  });
  console.log(`# ${p}`, JSON.stringify(r));
}
await browser.close();
