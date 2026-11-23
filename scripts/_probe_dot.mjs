import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const EXE = '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await pw.chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const p = await browser.newPage({ viewport: { width: 3840, height: 2160 } });
await p.goto('http://127.0.0.1:8899#/friendlog', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(()=>{});
await p.waitForTimeout(2500);
console.log(JSON.stringify(await p.evaluate(() => {
  const W = window.innerWidth;
  const dot = [...document.querySelectorAll('.dot')].find((d) => d.getBoundingClientRect().right > W + 2);
  if (!dot) return 'none';
  const chain = []; let el = dot;
  for (let i = 0; i < 6 && el; i++, el = el.parentElement) {
    const r = el.getBoundingClientRect();
    chain.push({ tag: el.tagName.toLowerCase(), cls: [...el.classList].join('.').slice(0,50), x: Math.round(r.x), right: Math.round(r.right), w: Math.round(r.width), pos: getComputedStyle(el).position, ov: getComputedStyle(el).overflowX });
  }
  return { chain, style: { right: getComputedStyle(dot).right, w: getComputedStyle(dot).width, pos: getComputedStyle(dot).position } };
}), null, 1));
await browser.close();
