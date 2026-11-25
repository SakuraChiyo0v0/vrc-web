// 第 32 轮：侧栏 21 行图标截图（验矢量图标没有豆腐框/错位）
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let pw; try { pw = _req('playwright'); } catch { pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const base = process.argv[2] || 'http://127.0.0.1:8891';
const out = process.argv[3] || 'cache/scratch/nav_r32.png';
const b = await pw.chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1700, height: 1040 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto(base.replace(/\/$/, '') + '/vrc/', { waitUntil: 'domcontentloaded' });
await p.waitForSelector('.nav-item', { timeout: 20000 });
await p.waitForTimeout(1200);
const aside = await p.$('aside');
await aside.screenshot({ path: out });
const rows = await p.evaluate(() => [...document.querySelectorAll('.nav-item')].map((el) => {
  const s = el.querySelector('.nav-icon');
  const r = s?.getBoundingClientRect();
  return { t: (el.textContent || '').trim().slice(0, 8), svg: !!s?.querySelector('svg'), w: r ? Math.round(r.width) : null, h: r ? Math.round(r.height) : null };
}));
console.log(JSON.stringify({ out, rows }, null, 0));
await b.close();
