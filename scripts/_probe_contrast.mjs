// 抽屉导航文字对比度（oklch 需过 canvas 归一化成 rgb 才能算亮度）
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire('/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const b = await pw.chromium.launch({ executablePath: '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'] });
for (const [w, h] of [[390, 844], [844, 390]]) {
  const t = await b.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  await t.goto('http://127.0.0.1:8891#/friends', { waitUntil: 'domcontentloaded' });
  await t.waitForTimeout(1200);
  await t.evaluate(() => document.querySelector('#vrc-topbar button')?.click());
  await t.waitForTimeout(400);
  const rows = await t.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const rgb = (c) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); const d = ctx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
    const lum = ([r, g, b]) => [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
    // 背景带 alpha（如 data-active 的 oklab(.../0.09)），要沿祖先链合成后再算亮度
    const rgba = (c) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); const d = ctx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], c.startsWith('rgba') || /\/\s*0?\.\d/.test(c) ? d[3] / 255 : 1]; };
    const bgOf = (el) => {
      const layers = [];
      for (let n = el; n; n = n.parentElement) {
        const c = getComputedStyle(n).backgroundColor;
        if (!c || c === 'rgba(0, 0, 0, 0)') continue;
        const [r, g, b, a] = rgba(c);
        if (a > 0) layers.push([r, g, b, a]);
      }
      let out = [255, 255, 255];
      for (const [r, g, b, a] of layers.reverse()) out = [r * a + out[0] * (1 - a), g * a + out[1] * (1 - a), b * a + out[2] * (1 - a)];
      return out;
    };
    const out = [];
    for (const [name, sel] of [['nav-item', '.vrc-sidebar .nav-item'], ['nav-sub', '.vrc-sidebar .nav-sub .nav-item'], ['nav-head', '.vrc-sidebar .side-label'], ['nav-section', '.vrc-sidebar .nav-section-title']]) {
      for (const el of [...document.querySelectorAll(sel)].slice(0, 4)) {
        const r = el.getBoundingClientRect(); if (r.width <= 0) continue;
        const cs = getComputedStyle(el);
        const L1 = lum(rgb(cs.color)), L2 = lum(bgOf(el));
        out.push({ name, txt: (el.textContent || '').trim().slice(0, 10), fs: cs.fontSize, color: cs.color, bg: bgOf(el).map(Math.round).join(','), ratio: Math.round(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)) * 100) / 100 });
      }
    }
    return out;
  });
  console.log(`## ${w}x${h}`);
  rows.forEach((r) => console.log(`   ${r.name} "${r.txt}" ${r.fs} ratio=${r.ratio} color=${r.color} bg=${r.bg}`));
  await t.close();
}
await b.close();
