/**
 * 探针：最小宽 320×568 竖屏 + 软键盘（SE1 键高约 216 → 可视 352）。
 * 检查外壳是否跟随 visualViewport、状态栏/输入框是否被键盘盖住、主区是否被压成 0。
 */
import { createRequire } from 'node:module';
import { assertVrcServer } from '../lib/page_structure.mjs';
const _req = createRequire(import.meta.url);
let _pw; try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
await assertVrcServer(BASE);
const PAGES = ['overview','search','feed','sessions','players','moderation','favorites','insights','friendlist','friendlog','gamelog','settings','friends','worlds'];
const SEL = { overview:'.ov-shell > *', search:'.world-card', feed:'tbody tr', sessions:'.sess-row', players:'.empty, .card', moderation:'tbody tr', favorites:'.fav-card', insights:'.graph-wrap', friendlist:'tbody tr', friendlog:'tbody tr', gamelog:'.card', settings:'.card', friends:'.loc-group', worlds:'.world-card' };
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
for (const [w, h, kbH] of [[320, 568, 216], [390, 844, 336]]) {
  for (const page of PAGES) {
    const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
    await tab.goto(`${BASE}#/${page}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await tab.waitForTimeout(1500);
    await tab.evaluate((hh) => {
      const vv = window.visualViewport;
      Object.defineProperty(vv, 'height', { configurable: true, get: () => hh });
      vv.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('resize'));
    }, h - kbH);
    await tab.waitForTimeout(450);
    const d = await tab.evaluate((sel) => {
      const vvH = window.visualViewport.height;
      const shell = document.querySelector('#root > div');
      const sb = document.querySelector('#vrc-statusbar');
      const main = document.querySelector('main');
      const els = [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().height > 0);
      const f = els[0]?.getBoundingClientRect();
      return {
        appVh: getComputedStyle(document.documentElement).getPropertyValue('--app-vh').trim(),
        shell: shell ? Math.round(shell.getBoundingClientRect().height) : null,
        sbBottom: sb ? Math.round(sb.getBoundingClientRect().bottom) : null,
        mainH: main ? Math.round(main.getBoundingClientRect().height) : null,
        kb: document.documentElement.getAttribute('data-kb'),
        vvH: Math.round(vvH), n: els.length,
        firstTop: f ? Math.round(f.top) : null, firstH: f ? Math.round(f.height) : null,
        vis: f ? Math.max(0, Math.min(Math.round(f.bottom), Math.round(vvH)) - Math.max(0, Math.round(f.top))) : 0,
      };
    }, SEL[page]);
    console.log(`${String(page).padEnd(11)} @${w}x${h}+kb${kbH} kb=${d.kb} vv=${d.vvH} appVh=${d.appVh} shell=${d.shell} sbBottom=${d.sbBottom} main=${d.mainH} n=${d.n} first=${d.firstTop}+${d.firstH} vis=${d.vis}`);
    await tab.close();
  }
}
await browser.close();
