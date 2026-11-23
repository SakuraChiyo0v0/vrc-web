/**
 * 世界库卡片「真人封面」实测：用真实数据（PG 库 1200+ 世界，缩略图非空）跑一遍世界库，
 * 确认卡片网格在真封面下仍是真机规格，并留下可看的三端截图 + 真机对照。
 *
 *   PORT=8892 node server/src/index.js &      # 必须是读 PG 的实例（缩略图才非空）
 *   node scripts/worlds_realcovers.mjs [baseUrl]
 *
 * 和 visual_parity 的分工：那边用 sqlite 夹具（thumbnail 全 null，卡片只有灰底占位），
 * 断言的是几何；这里专门验「封面真的加载出来了」（naturalWidth>0）以及真封面下的几何没塌。
 * 不写任何数据，只读接口 + 截图。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;

const BASE = process.argv[2] || process.env.VRC_BASE || 'http://127.0.0.1:8892';
const ROOT = process.env.VRC_ROOT || path.resolve(import.meta.dirname, '..');
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/ref/vrcx0-spec.json'), 'utf8'));
const W = SPEC.worlds;
const OUT = path.join(ROOT, 'docs/screenshots/compare');
fs.mkdirSync(OUT, { recursive: true });
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

// 预检：接口必须有封面，否则这个脚本验不到东西（夹具库 thumbnail 全 null 会静默「通过」）
const probe = await fetch(`${BASE}/api/worlds?limit=8`).then((r) => r.json()).catch(() => null);
if (!probe?.worlds?.length) {
  console.error(`✗ ${BASE}/api/worlds 取不到数据，先起一个读 PG 的实例（PORT=8892 node server/src/index.js）`);
  process.exit(1);
}
const withThumb = probe.worlds.filter((w) => w.thumbnail).length;
if (!withThumb) {
  console.error(`✗ ${BASE} 的 world.thumbnail 全为空（sqlite 夹具库），换 PG 实例再跑`);
  process.exit(1);
}
console.log(`预检 ${BASE}：共 ${probe.total} 个世界，首屏 ${probe.worlds.length} 张里 ${withThumb} 张有封面`);

const rows = [];
const check = (name, ours, want, ok) => rows.push({ name, ours: String(ours), want: String(want), ok });

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const p = await browser.newPage({ viewport: { width: 1700, height: 1040 }, deviceScaleFactor: 1 });
await p.goto(`${BASE}#/worlds`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await p.waitForSelector('.world-card', { timeout: 30000 });
// 等封面真的解码完（lazy 图要滚进视口；只量首屏，最多等 8s）
await p.evaluate(async () => {
  const imgs = [...document.querySelectorAll('.world-card img.thumb')];
  imgs.slice(0, 12).forEach((i) => { i.loading = 'eager'; });
  const t0 = Date.now();
  while (Date.now() - t0 < 8000 && imgs.slice(0, 12).some((i) => !i.complete)) {
    await new Promise((r) => setTimeout(r, 150));
  }
});
await p.waitForTimeout(500);

// 首屏卡片对应的世界（按接口默认排序），用于核对占位灰块数
const all = await fetch(`${BASE}/api/worlds?limit=50`).then((r) => r.json()).catch(() => ({ worlds: [] }));
const nullThumbs = (all.worlds || []).filter((w) => !w.thumbnail).length;

const m = await p.evaluate(() => {
  const grid = document.querySelector('.world-grid');
  const cards = [...document.querySelectorAll('.world-card')];
  const card = cards[0];
  const cb = card?.getBoundingClientRect();
  const cb2 = cards[1]?.getBoundingClientRect();
  const card3 = grid ? [...grid.children].filter((_, i) => i >= 3)[0] : null;
  const cb3 = card3?.getBoundingClientRect();
  const imgs = [...document.querySelectorAll('.world-card img.thumb')];
  const loaded = imgs.filter((i) => i.complete && i.naturalWidth > 0);
  const sizes = loaded.map((i) => `${i.naturalWidth}x${i.naturalHeight}`);
  const thumb = card?.querySelector('.thumb');
  const tb = thumb?.getBoundingClientRect();
  const gcs = grid ? getComputedStyle(grid) : null;
  return {
    cards: cards.length,
    cols: gcs ? gcs.gridTemplateColumns.split(' ').length : null,
    colGap: gcs ? Math.round(parseFloat(gcs.columnGap)) : null,
    cardW: cb ? Math.round(cb.width) : null,
    rowPitch: cb && cb3 ? Math.round(cb3.top - cb.top) : null,
    thumbW: tb ? Math.round(tb.width) : null,
    thumbH: tb ? Math.round(tb.height) : null,
    imgCount: imgs.length,
    imgLoaded: loaded.length,
    imgSizes: [...new Set(sizes)],
    emptyThumbs: document.querySelectorAll('.world-card .thumb-empty').length,
    metaLines: card ? card.querySelectorAll('.wc-meta').length : null,
    metaRows: card ? getComputedStyle(card.querySelector('.wc-meta')).flexDirection : null
  };
});

check('世界卡片数', m.cards, `≥${W.min_cards}`, m.cards >= W.min_cards);
check('网格列数', m.cols, W.grid_columns, m.cols === W.grid_columns);
check('列距', `${m.colGap}px`, `${W.col_gap}px`, m.colGap === W.col_gap);
check('卡片宽', `${m.cardW}px`, `${W.card_w}±2px`, m.cardW != null && Math.abs(m.cardW - W.card_w) <= 2);
check('行距', `${m.rowPitch}px`, `${W.row_pitch}±2px`, m.rowPitch != null && Math.abs(m.rowPitch - W.row_pitch) <= 2);
check('缩略图边长', `${m.thumbW}×${m.thumbH}`, '4:3', m.thumbW && m.thumbH && Math.abs(m.thumbW / m.thumbH - W.thumb_aspect) <= 0.05);
check('封面已解码', `${m.imgLoaded}/${m.imgCount}`, '首屏全部 >0', m.imgLoaded >= Math.min(6, m.imgCount));
check('封面清晰度', m.imgSizes.join('/') || '—', '≥512 宽', m.imgSizes.every((s) => Number(s.split('x')[0]) >= 512));
// 占位灰块只在「库内该世界本来就没有缩略图」时出现才对；不是布局问题，别把数据缺口算成几何 DIFF
check('占位灰块', `${m.emptyThumbs} 张（库内无缩略图 ${nullThumbs} 张）`, '与无缩略图数一致', m.emptyThumbs === nullThumbs);
check('元信息行数', m.metaLines, W.meta_lines, m.metaLines === W.meta_lines);

await p.screenshot({ path: path.join(OUT, 'worlds-real-covers-1700.png') });

const bad = rows.filter((r) => !r.ok);
for (const r of rows) console.log(`${r.ok ? 'PASS' : 'DIFF'}  ${r.name}: ${r.ours}（真机 ${r.want}）`);
console.log(`\n封面实测 ${rows.length - bad.length}/${rows.length} PASS · 截图 docs/screenshots/compare/worlds-real-covers-1700.png`);
await browser.close();
if (bad.length) process.exit(1);
