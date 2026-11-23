// 探针：feed 表格行高为何 46 而不是 spec 的 44
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const b = await pw.chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1688, height: 1028 }, deviceScaleFactor: 1 });
await p.goto(`${BASE}/#/feed`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(4000);
const out = await p.evaluate(() => {
  const tb = document.querySelector('.feed-tbl');
  if (!tb) return { err: 'no table', html: document.body.innerText.slice(0, 200) };
  const trs = [...tb.querySelectorAll('tbody tr')].filter((t) => t.classList.contains('feed-row'));
  const tr = trs[0];
  const cs = getComputedStyle(tr);
  const tds = [...tr.children].map((td) => {
    const s = getComputedStyle(td);
    const r = td.getBoundingClientRect();
    return {
      label: td.dataset.label, rectH: +r.height.toFixed(2), h: s.height, pad: s.padding, lh: s.lineHeight,
      fs: s.fontSize, ws: s.whiteSpace, border: s.borderBottomWidth, text: td.innerText.replace(/\n/g, '\\n'),
      scrollH: td.scrollHeight,
    };
  });
  const tblCS = getComputedStyle(tb);
  return {
    viewport: innerWidth, zoom: getComputedStyle(document.documentElement).zoom,
    trRectH: +tr.getBoundingClientRect().height.toFixed(2),
    trCS: { h: cs.height, lh: cs.lineHeight, pad: cs.padding, borderSpacing: cs.borderSpacing, borderCollapse: tblCS.borderCollapse },
    tds,
    rowCount: trs.length,
  };
});
console.log(JSON.stringify(out, null, 1));
await b.close();
