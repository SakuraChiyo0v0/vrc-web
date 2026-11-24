// 探针：390 手机端 feed 时间列改 pre 后不横向溢出、行不被裁
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const b = await pw.chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const rows = [];
for (const w of [390, 1688]) {
  const p = await b.newPage({ viewport: { width: w, height: 844 }, deviceScaleFactor: 1 });
  await p.goto('http://127.0.0.1:8891/#/feed', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3500);
  const r = await p.evaluate(() => {
    const sc = document.querySelector('.feed-scroll');
    const trs = [...document.querySelectorAll('.feed-tbl tbody tr.feed-row')].slice(0, 10);
    const td = trs[0]?.querySelector("td[data-label='时间']");
    const cs = td ? getComputedStyle(td) : null;
    return {
      docOverflowX: document.documentElement.scrollWidth - innerWidth,
      scrollOwnOverflow: sc ? sc.scrollWidth - sc.clientWidth : null,
      rowHeights: [...new Set(trs.map((t) => +t.getBoundingClientRect().height.toFixed(1)))],
      timeWs: cs?.whiteSpace, timeText: td?.textContent,
      timeClipped: td ? td.scrollWidth > td.clientWidth + 1 : null,
      timeScrollW: td?.scrollWidth, timeClientW: td?.clientWidth,
    };
  });
  rows.push({ w, ...r });
  await p.close();
}
console.log(JSON.stringify(rows, null, 1));
await b.close();
