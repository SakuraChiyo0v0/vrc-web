/**
 * 世界库卡片多视口复核：1700（真机量测基准）/ 1920 / 2560 / 3840。
 *
 * 背景：styles.css 的整页 zoom 起点从 1700 挪到 1800 后，1920+ 会整页放大 1.15/1.35/1.7。
 * 内容区宽 = 布局宽（viewport/zoom）- 侧栏 277 - rail 353 - inner 13 - padding 75，
 * 卡片 = 3 列 1fr，所以标注为「卡宽 = (内容宽 - 2×列距)/3」。断言：
 *   - zoom 与断点一致；列数恒 3
 *   - 卡片宽（换算回 CSS px）与网格算式一致 ±2
 *   - 列距/行距（CSS px）仍是真机 16 / 行距随卡高；缩略图 4:3
 *   - 标题/元信息不溢出卡片，页面无横向滚动
 *   - 缩略图源档位：<2560 取 512、≥2560 取大档（VRChat 回 800），渲染宽/源图宽 ≤1.02（源到上限时 ≤1.10）
 *
 *   PORT=8892 node server/src/index.js &      # 读 PG 的实例（缩略图才非空）
 *   node scripts/worlds_viewports.mjs [baseUrl]
 */
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;

const BASE = process.argv[2] || process.env.VRC_BASE || 'http://127.0.0.1:8892';
const ROOT = process.env.VRC_ROOT || path.resolve(import.meta.dirname, '..');
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/ref/vrcx0-spec.json'), 'utf8'));
const W = SPEC.worlds;
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

// zoom 断点与 styles.css 一一对应（1700 真机视口必须 zoom=1）
const ZOOM_RULES = [[3000, 1.7], [2200, 1.35], [1800, 1.15]];
const zoomFor = (w) => (ZOOM_RULES.find(([min]) => w >= min) || [0, 1])[1];

const VIEWPORTS = [1700, 1920, 2560, 3840];
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const rows = [];
const bad = [];
const notes = [];

for (const width of VIEWPORTS) {
  const zoom = zoomFor(width);
  const page = await browser.newPage({ viewport: { width, height: 1040 }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}#/worlds`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.world-card', { timeout: 30000 });
  // 缩略图 lazy，等首张真的解码完再量（naturalWidth 才能判档位）
  await page.waitForFunction(() => {
    const i = document.querySelector('.world-card img.thumb');
    return i && i.complete && i.naturalWidth > 0;
  }, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const grid = document.querySelector('.world-grid');
    const cards = [...document.querySelectorAll('.world-card')];
    const rect = (el) => (el ? el.getBoundingClientRect() : null);
    const cb = rect(cards[0]);
    const cb3 = rect(cards[3]);
    const tb = rect(cards[0]?.querySelector('.thumb'));
    const gcs = grid ? getComputedStyle(grid) : null;
    const name = cards[0]?.querySelector('.wc-name');
    const meta = cards[0]?.querySelector('.wc-meta');
    const img = cards[0]?.querySelector('img.thumb');
    const over = (el) => (el ? el.scrollWidth - el.clientWidth : null);
    return {
      htmlZoom: parseFloat(getComputedStyle(document.documentElement).zoom) || 1,
      gridW: grid ? grid.getBoundingClientRect().width : null,
      cols: gcs ? gcs.gridTemplateColumns.split(' ').length : null,
      colGap: gcs ? parseFloat(gcs.columnGap) : null,   // getComputedStyle 返回 CSS px，不随 zoom 放大
      rowGap: gcs ? parseFloat(gcs.rowGap) : null,
      cardW: cb?.width, cardH: cb?.height, rowPitch: cb && cb3 ? cb3.top - cb.top : null,
      thumbW: tb?.width, thumbH: tb?.height,
      nameOver: over(name), metaOver: over(meta),
      imgNatW: img?.naturalWidth || 0,
      docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  await page.screenshot({ path: path.join(ROOT, `docs/screenshots/compare/worlds-${width}.png`) });
  await page.close();

  const css = (v) => (v == null ? null : v / zoom);       // 设备 px → CSS px
  const cardCss = css(m.cardW);
  const gridCss = css(m.gridW);
  const expCard = (gridCss - 2 * W.col_gap) / 3;          // 3 列 1fr 的算式解
  const near = (a, b, tol = 2) => a != null && Math.abs(a - b) <= tol;
  const line = (name, os, want, ok) => { rows.push({ width, name, os, want, ok }); if (!ok) bad.push(`${width}px ${name}: 实际 ${os} 期望 ${want}`); };

  line('html zoom', m.htmlZoom, zoom, Math.abs(m.htmlZoom - zoom) < 0.01);
  line('列数', m.cols, W.grid_columns, m.cols === W.grid_columns);
  line('卡片宽(CSS)', Math.round(cardCss), `${Math.round(expCard)}（网格算式）±2`, near(cardCss, expCard));
  line('列距(CSS)', m.colGap, W.col_gap, m.colGap === W.col_gap);
  line('行距(CSS)', m.rowPitch == null ? null : Math.round(css(m.rowPitch)), `${Math.round(css(m.cardH) + m.rowGap)}`, near(css(m.rowPitch), css(m.cardH) + m.rowGap));
  line('缩略图 4:3', m.thumbW && m.thumbH ? (m.thumbW / m.thumbH).toFixed(3) : null, W.thumb_aspect, Math.abs(m.thumbW / m.thumbH - W.thumb_aspect) <= 0.05);
  line('名称不溢出', m.nameOver, '≤1', m.nameOver != null && m.nameOver <= 1);
  line('元信息不溢出', m.metaOver, '≤1', m.metaOver != null && m.metaOver <= 1);
  line('无横向滚动', m.docOverflowX, '≤1', m.docOverflowX <= 1);

  // 缩略图档位：<2560 只取 512（不加带宽），≥2560 取大档。
  // VRChat 世界缩略图的 /1024 档实际是 800×600（实测 8 个世界，/768 与 /1024 同字节），
  // 800 就是文件上限，所以 3840 视口只能做到 855/800 = 1.07× —— 不再是 1.67×。
  const SRC_CAP = 800;
  const wantSrc = width >= 2560 ? '>512（大档）' : 512;
  const srcOk = width >= 2560 ? m.imgNatW > 512 : m.imgNatW === 512;
  line('缩略图源档位', m.imgNatW || null, wantSrc, srcOk);
  if (m.imgNatW) {
    const ratio = m.thumbW / m.imgNatW;
    // 渲染宽 / 源图宽 ≤1.02 才算不发虚；源已到文件上限(800)时剩下的放大不可修
    const capped = width >= 2560 && m.imgNatW >= SRC_CAP;
    line('渲染/源', `${ratio.toFixed(2)}×`, capped ? '≤1.10×（源已到上限）' : '≤1.02×', ratio <= (capped ? 1.10 : 1.02));
    notes.push(`${width}px 缩略图渲染 ${Math.round(m.thumbW)}px / 源图 ${m.imgNatW}px = ${ratio.toFixed(2)}×${capped ? '（源已到文件上限 800）' : ''}${ratio > 1.02 && !capped ? '（放大，会发虚）' : ''}`);
  }
}

await browser.close();
for (const width of VIEWPORTS) {
  console.log(`\n── ${width}px（zoom ${zoomFor(width)}）`);
  for (const r of rows.filter((r) => r.width === width)) {
    const os = r.os == null ? '—' : typeof r.os === 'number' ? Math.round(r.os * 1000) / 1000 : r.os;
    console.log(`${r.ok ? 'PASS' : 'DIFF'}  ${r.name}: ${os}`);
  }
}
console.log('\n缩略图清晰度：\n' + notes.map((n) => `  ${n}`).join('\n'));
console.log(`\n多视口复核 ${rows.length - bad.length}/${rows.length} PASS`);
if (bad.length) { console.log(bad.join('\n')); process.exit(1); }
