import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const EXE = '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = process.argv[2] || 'http://127.0.0.1:8899';
const PAGES = (process.argv[3] || 'sessions').split(',');
const browser = await pw.chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const p = await browser.newPage({ viewport: { width: 1440, height: 960 } });
for (const page of PAGES) {
  await p.goto(`${BASE}#/${page}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await p.waitForTimeout(2000);
  const out = await p.evaluate(() => {
    const ok = [11, 12, 13, 14];
    const bad = [];
    document.querySelectorAll('body *').forEach((el) => {
      if (!el.offsetParent) return;
      if (!(el.textContent || '').trim()) return;
      const px = Math.round(parseFloat(getComputedStyle(el).fontSize));
      if (px > 0 && !ok.includes(px)) {
        const cls = [...el.classList].join('.');
        bad.push({ px, tag: el.tagName.toLowerCase(), cls, text: (el.textContent || '').trim().slice(0, 24) });
      }
    });
    // 去重：同 px+class 只留一条，svg 里的文字单独标
    const seen = new Set(); const uniq = [];
    for (const b of bad) {
      const k = b.px + '|' + b.tag + '|' + b.cls;
      if (seen.has(k)) continue; seen.add(k); uniq.push(b);
    }
    return uniq;
  });
  console.log(`\n== ${page} ==`);
  for (const b of out) console.log(`${b.px}px <${b.tag}.${b.cls}> "${b.text}"`);
}
await browser.close();
