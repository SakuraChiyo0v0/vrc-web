
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = pw;
const BASE = process.argv[2] || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const b = await chromium.launch({ executablePath: EXE });
for (const [w,h] of [[1700,1040],[1024,768]]) {
  const ctx = await b.newContext({ viewport:{width:w,height:h} });
  const p = await ctx.newPage();
  await p.goto(BASE + '/#/overview', { waitUntil:'domcontentloaded' });
  await p.waitForSelector('[data-nav-id]');
  await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const aside = document.querySelector('aside');
    const ax = aside.getBoundingClientRect().x;
    const rel = el => +(el.getBoundingClientRect().x - ax).toFixed(1);
    const items = [...aside.querySelectorAll('[data-nav-id],[data-nav-kind=folder],[data-nav-kind=footer],[data-testid=nav-collapse]')];
    const rows = items.map(el => {
      const b = el.getBoundingClientRect();
      const icon = el.querySelector('span');
      const text = el.querySelectorAll('span')[1];
      return { id: el.dataset.navId || el.dataset.navKind || el.dataset.testid, kind: el.dataset.navKind || (el.dataset.navId==='settings'?'footer-item':'top'),
        y:+b.y.toFixed(1), h:+b.height.toFixed(1), left: rel(el), iconX: icon?rel(icon):null, textX: text?rel(text):null };
    });
    // pitch between consecutive same-kind rows
    const gaps = [];
    for (let i=1;i<rows.length;i++) gaps.push({a:rows[i-1].id,b:rows[i].id,dy:+(rows[i].y-rows[i-1].y).toFixed(1),dh:+(rows[i].h-rows[i-1].h).toFixed(1)});
    const foot = aside.querySelector('[data-nav-footer]');
    const footKids = [...foot.children].map(el=>{const b=el.getBoundingClientRect();return {y:+b.y.toFixed(1),h:+b.height.toFixed(1)}});
    const sb = document.querySelector('#vrc-statusbar');
    const st = [...sb.querySelectorAll('[data-status-item]')].map(el=>{
      const dot = el.querySelector('span'); const lab = el.querySelectorAll('span')[1];
      const db = dot.getBoundingClientRect(), lb = lab.getBoundingClientRect();
      return {id:el.dataset.statusItem, label: lab.textContent, dotW:+db.width.toFixed(1), dotX:+(db.x).toFixed(1), gapDotText:+(lb.x-db.right).toFixed(1), textW:+lb.width.toFixed(1)};
    });
    const act = document.querySelector('[data-topbar=actions]');
    const acts = act ? [...act.children].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const b=e.getBoundingClientRect();return {x:+b.x.toFixed(1),w:+b.width.toFixed(1),cx:+(b.x+b.width/2).toFixed(1)}}) : [];
    return { aside:{x:ax,w:+aside.getBoundingClientRect().width.toFixed(1)}, rows, gaps: gaps.filter(g=>Math.abs(g.dh)<0.5), foot: footKids, status: st, acts,
      actPitch: acts.length>1 ? +(acts[1].cx-acts[0].cx).toFixed(1) : null };
  });
  console.log(JSON.stringify({v:`${w}x${h}`, ...r}, null, 0));
  await ctx.close();
}
await b.close();
