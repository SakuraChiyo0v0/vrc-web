// 探针：移动端表格卡片里「列名左边缘 / 值右边缘 / 是否折行」是否对齐（不入库，用完可删）
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = pw;
const BASE = process.argv[2] || 'http://127.0.0.1:8891';
const EXE = '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const b = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
for (const page of ['friendlist', 'feed', 'gamelog']) {
  const t = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await t.goto(`${BASE}/#/${page}`, { waitUntil: 'domcontentloaded' });
  await t.waitForTimeout(1500);
  const rows = await t.evaluate(() => {
    const tr = document.querySelector('tbody tr:not(.group-row):not(.feed-day)');
    if (!tr) return null;
    return [...tr.querySelectorAll('td')].map((td) => {
      const r = td.getBoundingClientRect();
      const cs = getComputedStyle(td, '::before');
      const lines = Math.round(r.height / 16);
      return { label: td.dataset.label || null, tdLeft: Math.round(r.left), tdW: Math.round(r.width), h: Math.round(r.height), lines, beforeW: cs.width };
    });
  });
  console.log(`== ${page}`, JSON.stringify(rows, null, 0));
  await t.close();
}
await b.close();
