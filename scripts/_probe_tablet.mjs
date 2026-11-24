/**
 * 平板中间档探针（768–1024）：这一档既不是手机（>767）也不是宽桌面，最容易两头不靠。
 *   node scripts/_probe_tablet.mjs [baseUrl]
 * 量：侧栏宽/main 宽/右溢/最小字号/最小触控/表格形态/命令面板高度 vs 视口。
 */
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const VPS = [[768, 1024], [820, 1180], [1024, 768], [1024, 1366]];
const PAGES = ['friends', 'feed', 'friendlist', 'settings', 'sessions', 'worlds'];

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
for (const [w, h] of VPS) {
  for (const p of PAGES) {
    const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
    await tab.goto(`${BASE}#/${p}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await tab.waitForTimeout(1400);
    const r = await tab.evaluate(() => {
      const vw = window.innerWidth;
      let minFont = 99; let tapMin = null; let off = [];
      document.querySelectorAll('body *').forEach((el) => {
        const b = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        if (b.width > 0 && b.right > vw + 1 && cs.position !== 'fixed') off.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}@${Math.round(b.right)}`);
        const t = (el.textContent || '').trim();
        if (t && b.width > 0 && b.height > 0 && !el.children.length) minFont = Math.min(minFont, Math.round(parseFloat(cs.fontSize) * 10) / 10);
        if (el.matches('button, a[href], [role="button"], input, select') && b.width > 0 && b.height > 0) {
          const v = Math.round(b.height); tapMin = tapMin === null ? v : Math.min(tapMin, v);
        }
      });
      const sd = document.querySelector('.vrc-sidebar'); const main = document.querySelector('main');
      const th = document.querySelector('thead'); const tr = document.querySelector('tbody tr');
      return {
        scrollW: document.documentElement.scrollWidth, vw,
        sdW: sd ? Math.round(sd.getBoundingClientRect().width) : null,
        sdLeft: sd ? Math.round(sd.getBoundingClientRect().left) : null,
        mainW: main ? Math.round(main.getBoundingClientRect().width) : null,
        mainPad: main ? parseFloat(getComputedStyle(main).paddingLeft) : null,
        minFont, tapMin,
        thead: th ? getComputedStyle(th).display : null,
        trDir: tr ? getComputedStyle(tr).flexDirection : null,
        off: off.slice(0, 4),
        // 搜索入口是否存在（桌面靠 Ctrl K，平板有键盘但触屏平板没有）
        searchBtn: !!document.querySelector('[data-topbar="search-mobile"]') && document.querySelector('[data-topbar="search-mobile"]').getBoundingClientRect().width > 0,
      };
    });
    // 命令面板高度 vs 视口（iOS 地址栏占位后 100vh 会超出）
    await tab.keyboard.press('Control+k').catch(() => {});
    await tab.waitForTimeout(400);
    const pal = await tab.evaluate(() => {
      const el = document.querySelector('[data-testid="palette"]');
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), vh: window.innerHeight };
    });
    console.log(`${p}@${w}x${h}`, JSON.stringify(r), pal ? `palette=${JSON.stringify(pal)}` : 'palette=n/a');
    await tab.close();
  }
}
await browser.close();
