/** 探针2：顶栏右簇内部间距（可见元素），不依赖绝对 x。 */
import { createRequire } from 'node:module';
import { normBase, pageBase, assertVrcPage, gotoVrc } from './lib/page_structure.mjs';

const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = normBase(process.argv[2] || 'http://127.0.0.1:8891');
const PAGE = pageBase(BASE);
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
for (const [w, h] of [[1024, 768], [1280, 800], [1366, 768], [1440, 900], [1600, 900], [1700, 1040]]) {
  const tab = await browser.newPage({ viewport: { width: w, height: h } });
  await gotoVrc(tab, `${PAGE}#/friends`);
  await tab.waitForTimeout(700);
  await assertVrcPage(tab, `friends@${w}`);
  const g = await tab.evaluate(() => {
    const vis = (el) => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 1; };
    const tb = document.querySelector('#vrc-topbar');
    const R = tb.getBoundingClientRect().right;
    const box = (el) => { const b = el.getBoundingClientRect(); return { l: +(R - b.left).toFixed(1), r: +(R - b.right).toFixed(1), w: +b.width.toFixed(1) }; };
    const kbd = document.querySelector('[data-topbar="search"] kbd');
    const acts = [...document.querySelector('[data-topbar="actions"]').children].filter(vis);
    const wins = [...document.querySelector('[data-topbar="window-controls"]').children].filter(vis);
    const pitches = wins.slice(1).map((e, i) => Math.round(wins[i].getBoundingClientRect().right + 0) );
    return {
      kbd: box(kbd),
      acts: acts.map(box),
      wins: wins.map(box),
      nActs: acts.length,
      nWins: wins.length,
      gapSearchActions: +(box(kbd).r - box(acts[0]).l).toFixed(1),
      gapActionsWin: +(box(acts[acts.length - 1]).r - box(wins[0]).l).toFixed(1),
      winGaps: wins.slice(1).map((e, i) => +(wins[i].getBoundingClientRect().left - e.getBoundingClientRect().right).toFixed(1)),
    };
  });
  console.log(w, JSON.stringify(g));
  await tab.close();
}
await browser.close();
