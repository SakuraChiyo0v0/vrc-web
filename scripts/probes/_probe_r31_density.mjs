
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = pw;
const BASE = process.argv[2] || 'http://127.0.0.1:8891';
const VIEWS = [[1024,600],[1024,768],[1100,800],[1280,800]];
const PAGES = ['overview','friends','feed','friendlist','gamelog','worlds','settings','favorites','sessions'];
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const b = await chromium.launch({ executablePath: EXE });
for (const [w,h] of VIEWS) {
  const ctx = await b.newContext({ viewport:{width:w,height:h} });
  const p = await ctx.newPage();
  await p.goto(BASE + '/#/overview', { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#vrc-topbar');
  for (const pg of PAGES) {
    await p.evaluate((pg)=>location.hash = '#/'+pg, pg);
    await p.waitForTimeout(700);
    const r = await p.evaluate(() => {
      const box = (el) => el ? (()=>{const b=el.getBoundingClientRect();return {x:+b.x.toFixed(1),y:+b.y.toFixed(1),w:+b.width.toFixed(1),h:+b.height.toFixed(1),r:+b.right.toFixed(1)}})() : null;
      const tb = document.querySelector('#vrc-topbar');
      const brand = tb.querySelector('[data-topbar=brand]');
      const help = tb.querySelector('[data-topbar=help]');
      const right = tb.querySelector(':scope > div.ml-auto') || tb.querySelector('.ml-auto');
      const items = [...document.querySelectorAll('[data-nav-id]')].map(el=>{
        const lab = el.querySelector('span.truncate, span');
        return { id: el.dataset.navId, w:+el.getBoundingClientRect().width.toFixed(1),
          clipped: lab ? lab.scrollWidth > lab.clientWidth + 1 : null,
          text: (lab?.textContent||'').slice(0,14) };
      }).filter(x=>x.clipped);
      const sb = document.querySelector('#vrc-statusbar');
      const sbi = [...sb.querySelectorAll('[data-status-item]')].map(el=>({id:el.dataset.statusItem, ...box(el), clip: el.scrollWidth>el.clientWidth+1}));
      const nav = document.querySelector('aside nav');
      return {
        vw: innerWidth,
        tb: box(tb), brand: box(brand), help: box(help), right: box(right),
        overlapBrandRight: (brand && right) ? +(brand.getBoundingClientRect().right - right.getBoundingClientRect().left).toFixed(1) : null,
        tbScroll: tb.scrollWidth - tb.clientWidth,
        clippedNav: items.slice(0,6),
        nav: nav ? {clientH: nav.clientHeight, scrollH: nav.scrollHeight} : null,
        status: sbi, statusOverflow: sb.scrollWidth - sb.clientWidth,
        aside: box(document.querySelector('aside')),
        docOverflow: document.documentElement.scrollWidth - innerWidth
      };
    });
    console.log(JSON.stringify({v:`${w}x${h}`, pg, ...r}));
  }
  await ctx.close();
}
await b.close();
