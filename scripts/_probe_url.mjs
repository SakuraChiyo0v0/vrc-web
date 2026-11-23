import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = pw;
const BASE = process.argv[2] || 'http://127.0.0.1:8897/vrc';
const b = await chromium.launch({ executablePath: '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 1688, height: 1028 } });
const resp = await p.goto(`${BASE}#/friendlist`, { waitUntil: 'networkidle', timeout: 40000 }).catch((e) => ({ err: String(e) }));
await p.waitForTimeout(1500);
console.log('resp', resp?.status?.() ?? resp);
console.log('url', p.url(), 'title', await p.title());
console.log(await p.evaluate(() => ({
  bodyLen: document.body.innerText.length,
  bodyHead: document.body.innerText.slice(0, 120),
  ws: !!document.querySelector('.workspace'),
  wsLen: document.querySelector('.workspace')?.innerText.length ?? -1,
  main: !!document.querySelector('main'),
  ths: document.querySelectorAll('thead th').length
})));
await b.close();
