// 逐页列出 390 竖屏下 <44 的命中目标（带 class），用于分层阈值定档；同时量抽屉导航文字对比度
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const b = await pw.chromium.launch({ executablePath: '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
const PAGES = ['overview','friends','friendlist','feed','worlds','favorites','sessions','players','encounters','insights','calendar','moderation','settings','search'];
for (const page of PAGES) {
  const t = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await t.goto('http://127.0.0.1:8891#/' + page, { waitUntil: 'domcontentloaded' });
  await t.waitForTimeout(1500);
  const out = await t.evaluate(() => [...document.querySelectorAll('button, a[href], [role="button"], input, select')].map(el => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    if (r.height >= 44) return null;
    const cls = (el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.');
    return { k: `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`, h: Math.round(r.height), w: Math.round(r.width) };
  }).filter(Boolean));
  const uniq = [...new Map(out.map(o => [o.k, o])).values()];
  console.log('##', page, uniq.length ? '' : '(全 ≥44)');
  uniq.forEach(o => console.log(`   ${o.k}  ${o.h}px  w=${o.w}`));
  await t.close();
}
// 抽屉导航对比度（390×844，打开抽屉）
{
  const t = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await t.goto('http://127.0.0.1:8891#/friends', { waitUntil: 'domcontentloaded' });
  await t.waitForTimeout(1200);
  await t.click('[data-topbar="menu"]').catch(async () => { await t.evaluate(() => document.querySelector('#vrc-topbar button')?.click()); });
  await t.waitForTimeout(400);
  const res = await t.evaluate(() => {
    const lum = (c) => {
      const m = c.match(/[\d.]+/g).map(Number);
      const [r, g, bl] = m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const parse = (c) => { const d = document.createElement('div'); d.style.color = c; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; };
    const bgOf = (el) => { let n = el; while (n) { const c = getComputedStyle(n).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && !/rgba\(.*,\s*0\)/.test(c)) return c; n = n.parentElement; } return 'rgb(255,255,255)'; };
    const pick = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().width > 0).slice(0, 6);
    const rows = [];
    for (const [name, sel] of [['nav-item', '.vrc-sidebar .nav-item'], ['nav-sub', '.vrc-sidebar .nav-sub .nav-item'], ['nav-head', '.vrc-sidebar .nav-head, .vrc-sidebar .side-label']]) {
      for (const el of pick(sel)) {
        const cs = getComputedStyle(el);
        const fg = parse(cs.color), bg = bgOf(el);
        const L1 = lum(fg), L2 = lum(bg);
        const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        rows.push({ name, txt: (el.textContent || '').trim().slice(0, 10), fs: cs.fontSize, fg, bg, ratio: Math.round(ratio * 100) / 100 });
      }
    }
    return rows;
  });
  console.log('## contrast 390 drawer');
  res.forEach(r => console.log(`   ${r.name} "${r.txt}" ${r.fs} ratio=${r.ratio} fg=${r.fg} bg=${r.bg}`));
  await t.close();
}
await b.close();
