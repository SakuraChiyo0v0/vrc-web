/**
 * 探针：横屏（844×390 / 932×430）与 375/414 竖直档的形态与几何。
 *   node scripts/_probe_landscape.mjs [base]
 */
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw; try { _pw = _req('playwright'); } catch { _pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.argv[2] || 'http://127.0.0.1:8891';
const EXE = '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const VIEWS = [[375, 667], [414, 896], [844, 390], [932, 430]];
const PAGES = ['friends', 'feed', 'friendlist', 'search', 'settings', 'worlds', 'sessions', 'insights'];

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
for (const [w, h] of VIEWS) {
  for (const p of PAGES) {
    const tab = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true });
    await tab.goto(`${BASE}#/${p}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await tab.waitForTimeout(900);
    const a = await tab.evaluate(() => {
      const de = document.documentElement;
      const sb = document.querySelector('.vrc-sidebar');
      const main = document.querySelector('main');
      const tb = document.querySelector('#vrc-topbar');
      const ofs = [];
      document.querySelectorAll('body *').forEach((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.visibility === 'hidden' || cs.display === 'none') return;
        if (r.width > 0 && r.right > window.innerWidth + 1) ofs.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} r=${Math.round(r.right)}`);
      });
      return {
        sw: de.scrollWidth, sh: de.scrollHeight, vw: innerWidth, vh: innerHeight,
        sbLeft: sb ? Math.round(sb.getBoundingClientRect().left) : null,
        sbW: sb ? Math.round(sb.getBoundingClientRect().width) : null,
        mainW: main ? Math.round(main.getBoundingClientRect().width) : null,
        mainH: main ? Math.round(main.getBoundingClientRect().height) : null,
        tbH: tb ? Math.round(tb.getBoundingClientRect().height) : null,
        thead: document.querySelector('thead') ? getComputedStyle(document.querySelector('thead')).display : '-',
        ofs: ofs.slice(0, 4),
      };
    });
    console.log(`${p}@${w}x${h} sw=${a.sw}/${a.vw} sh=${a.sh} sb=${a.sbLeft},${a.sbW} main=${a.mainW}x${a.mainH} tb=${a.tbH} thead=${a.thead}${a.ofs.length ? ' OVF ' + a.ofs.join('|') : ''}`);
    await tab.close();
  }
}
await browser.close();
