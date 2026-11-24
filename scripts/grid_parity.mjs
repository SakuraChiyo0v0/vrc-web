/**
 * 好友位置网格（.loc-grid）列数阶梯回归：把「窗口多宽排几列」变成可量断言，防再退回 auto-fill。
 *
 *   node scripts/grid_parity.mjs [baseUrl]        # 默认 http://127.0.0.1:8891（server/scripts/demo.mjs）
 *
 * 背景：c5c6aa8 曾把 .loc-grid 改成 repeat(auto-fill,minmax(230px,1fr))，1688 宽只排下 5 列，
 * 与 spec「≥1600 六列」不符（structure_parity 58/59、visual_parity 214/215 各挂一项）。
 * 1fb499c 改成媒体查询阶梯：≥1600 → 6、1280–1599 → 4、768–1279 → 3、≤767 → 2。
 * 本脚本锁住这条阶梯 + 每档卡片内的文字不被硬裁 + 整页无横向溢出（原来只有一次性探针）。
 *
 * 视口取档位中间值 + 每一处断点两侧（1599/1600、1279/1280、767/768），断点写错会立刻红。
 * 断言（每档 6 项）：
 *   1) 列数 = 该档约定（6/4/3/2）
 *   2) 网格自身不溢出：grid.scrollWidth ≤ clientWidth+1，且末列卡片右缘落在网格右缘内（±1）
 *   3) 同档卡片等宽：最宽−最窄 ≤ 1（1fr 均分，不该有一个被挤扁）
 *   4) 卡片内文字不硬裁：.loc-name/.loc-world/.loc-meta/.loc-time 的 scrollWidth−clientWidth ≤ 1
 *   5) 卡片本体不溢出（scrollWidth−clientWidth ≤ 1）且高 96 不被压扁（±1）
 *   6) 整页无横向溢出：documentElement.scrollWidth ≤ innerWidth+1
 * 另：末档（≤767）允许卡片走移动端两行布局，<768 起不再要求高 96（见 MOBILE_MIN_W）。
 *
 * 有 DIFF 退出码 1；全 PASS 打印 GRID OK，并把结果写 docs/ref/grid-parity.json。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { assertVrcServer } from './lib/page_structure.mjs';

const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = pw;

const BASE = (process.argv[2] || process.env.VRC_BASE || 'http://127.0.0.1:8891').replace(/\/$/, '');
await assertVrcServer(BASE);

const ROOT = process.env.VRC_ROOT || path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs/ref/grid-parity.json');
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

// [宽, 高, 期望列数]：档位中间值 + 每个断点两侧
const VIEWS = [
  [1688, 1028, 6],
  [1600, 900, 6],
  [1599, 900, 4],
  [1440, 900, 4],
  [1280, 800, 4],
  [1279, 800, 3],
  [1024, 768, 3],
  [768, 900, 3],
  [767, 900, 2],
  [390, 844, 2],
];

const rows = [];
const perView = {};
const add = (v, name, ok, ours, want) => {
  rows.push({ view: v, name, ok, ours: String(ours), want: String(want) });
  (perView[v] ||= []).push({ name, ok, ours, want });
};

const MEASURE = () => {
    const g = document.querySelector('.loc-grid');
    if (!g) return { none: true };
    const gb = g.getBoundingClientRect();
    const cols = getComputedStyle(g).gridTemplateColumns.split(/\s+/).filter(Boolean).length;
    const cards = [...g.querySelectorAll('.loc-card')];
    const cw = cards.map((c) => c.getBoundingClientRect().width);
    const last = cards.length ? cards.reduce((a, b) => (a.getBoundingClientRect().right > b.getBoundingClientRect().right ? a : b)) : null;
    const txtSel = ['.loc-name', '.loc-world', '.loc-meta', '.loc-time'];
    const clipped = [];
    for (const c of cards) {
      for (const t of c.querySelectorAll(txtSel.join(','))) {
        if (t.scrollWidth - t.clientWidth > 1) clipped.push(`${t.className.split(' ')[0]}:${(t.textContent || '').trim().slice(0, 10)}`);
      }
    }
    const cardOvf = cards.filter((c) => c.scrollWidth - c.clientWidth > 1).length;
    const ch = cards.map((c) => Math.round(c.getBoundingClientRect().height));
    return {
      cols,
      n: cards.length,
      gridW: Math.round(gb.width),
      gridScrollW: g.scrollWidth,
      lastRightOver: last && gb.width ? Math.round(last.getBoundingClientRect().right - gb.right) : null,
      cardWMin: cw.length ? Math.round(Math.min(...cw)) : 0,
      cardWMax: cw.length ? Math.round(Math.max(...cw)) : 0,
      cardHMin: ch.length ? Math.min(...ch) : 0,
      cardHMax: ch.length ? Math.max(...ch) : 0,
      cardOvf,
      clippedN: clipped.length,
      clipped: clipped.slice(0, 4),
      ovf: document.documentElement.scrollWidth - window.innerWidth,
    };
};

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

for (const [w, h, wantCols] of VIEWS) {
  const v = `${w}x${h}`;
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  // 位置页首屏要拉好友位置接口，偶发慢：加载到 .loc-grid 出现或超时，再稳 800ms
  await p.goto(`${BASE}/#/locations`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await p.waitForFunction(() => !!document.querySelector('.loc-grid'), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(800);
  const m = await p.evaluate(MEASURE);
  // 首屏没出卡片（接口慢）：重载一次再量，别把「没数据」当成布局差异
  const mm = m.none || !m.n ? await (async () => {
    await p.reload({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2500);
    return p.evaluate(MEASURE);
  })() : m;
  await p.close();

  if (mm.none || !mm.n) {
    add(v, '网格与卡片', false, '未见 .loc-grid/.loc-card', '有数据');
    continue;
  }

  add(v, '列数', mm.cols === wantCols, mm.cols, wantCols);
  add(v, '网格不溢出', mm.gridScrollW <= mm.gridW + 1 && (mm.lastRightOver === null || mm.lastRightOver <= 1),
    `scrollW ${mm.gridScrollW}/${mm.gridW} 末列右溢 ${mm.lastRightOver}`, `scrollW ≤ ${mm.gridW + 1}、末列右溢 ≤ 1`);
  add(v, '卡片等宽', mm.cardWMax - mm.cardWMin <= 1, `${mm.cardWMin}–${mm.cardWMax}`, '极差 ≤ 1');
  add(v, '卡片内文字不裁', mm.clippedN === 0, mm.clippedN ? `${mm.clippedN} 处 ${mm.clipped.join(',')}` : '0 处', '0 处');
  // 桌面档（≥1024）卡片高恒 96；≤1023 走移动端细则 height:auto/min-height:76（styles.css 1398 行）
  const hOk = w >= 1024 ? Math.abs(mm.cardHMin - 96) <= 1 && mm.cardHMax - mm.cardHMin <= 1 : mm.cardHMin >= 76;
  add(v, '卡片不溢出且高度对', mm.cardOvf === 0 && hOk,
    `溢出 ${mm.cardOvf} 张、高 ${mm.cardHMin}–${mm.cardHMax}`, w >= 1024 ? '溢出 0、高 96' : '溢出 0、高 ≥ 76');
  add(v, '整页无横向溢出', mm.ovf <= 1, mm.ovf, '≤ 1');
}

await browser.close();

const pass = rows.filter((r) => r.ok).length;
const fail = rows.length - pass;
for (const r of rows) if (!r.ok) console.log(`DIFF ${r.view} [${r.name}] 我们 ${r.ours} / 期望 ${r.want}`);
console.log(`\n网格阶梯 ${pass}/${rows.length} (${((pass / rows.length) * 100).toFixed(0)}%)`);
fs.writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), base: BASE, pass, total: rows.length, per_view: perView, rows }, null, 1));
if (fail) { console.log(`GRID FAIL (${fail})`); process.exit(1); }
console.log('GRID OK');
