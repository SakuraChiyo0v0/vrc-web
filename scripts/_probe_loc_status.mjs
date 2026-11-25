import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = pw;
const EXE = '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const b = await chromium.launch({ executablePath: EXE });
const p = await b.newPage({ viewport: { width: 1688, height: 1028 } });
await p.goto('http://127.0.0.1:8891/#/friends', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(4000);
const out = await p.evaluate(() => [...document.querySelectorAll('.loc-card')].map((c) => {
  const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
  const cr = c.getBoundingClientRect();
  const L = { x: +cr.x.toFixed(1), w: +cr.width.toFixed(1), status: box(c.querySelector('.loc-status')), world: box(c.querySelector('.loc-world')) };
  const left = L.x + 10, near = (a, bb) => Math.abs(a - bb) <= 2;
  const wide = (bb) => bb && near(bb.x, left) && bb.w >= L.w - 24;
  const oneLine = Math.abs(L.status.h - 12) <= 1;
  const worldOk = !L.world || (near(L.world.x, left) && Math.abs(L.world.h - 12) <= 1);
  return { u: c.getAttribute('data-user'), g: c.closest('[data-group]')?.getAttribute('data-group'), left, ...L, ok: wide(L.status) && oneLine && worldOk };
}));
console.log(out.map((o) => `${o.ok ? 'OK ' : 'BAD'} ${o.g} ${o.u} x=${o.x} w=${o.w} st=(${o.status.x},${o.status.w},${o.status.h}) wd=${o.world ? `(${o.world.x},${o.world.w},${o.world.h})` : '-'} left=${o.left}`).join('\n'));
await b.close();
