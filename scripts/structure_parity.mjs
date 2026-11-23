/**
 * 页面结构对齐：docs/ref/vrcx0-spec.json → pages[*].structure（逐条来自真机截图量测）vs 我们的 DOM。
 *
 *   node scripts/structure_parity.mjs [baseUrl]     # 默认 http://127.0.0.1:8899（server/scripts/demo.mjs）
 *
 * 只比「截图能证明的结构」：表格列数与列名、可见行数、tab/chip/子导航文字、网格列数、空态文案。
 * 断言实现在 scripts/lib/page_structure.mjs（visual_parity.mjs 共用，保证两边口径一致）。
 * 每项输出 PASS/DIFF；有 DIFF 就 exit 1。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { probeMain, structureRows, STRUCT_PAGES } from './lib/page_structure.mjs';

const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = pw;

const BASE = (process.argv[2] || 'http://127.0.0.1:8899').replace(/\/$/, '');
const ROOT = process.env.VRC_ROOT || path.resolve(import.meta.dirname, '..');
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/ref/vrcx0-spec.json'), 'utf8'));
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const rows = [];

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
// 真机截图是 1700x1040 窗口（内窗 1688x1028）；用内窗尺寸量，避开 ≥1700 的大屏 zoom:1.15
const p = await browser.newPage({ viewport: { width: 1688, height: 1028 }, deviceScaleFactor: 1 });

async function go(page, want = {}) {
  // BASE 只是服务根（可能是 http://host/vrc）：拼成 /vrc/#/page，否则 hash 会吃掉路径变成 404
  await p.goto(`${BASE}/#/${page}`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  // 懒加载路由 + 首屏接口：等 main 里出现实际内容再量，否则会把「还在加载」当成空结构
  await p
    .waitForFunction(() => {
      const m = document.querySelector('.workspace') || document.querySelector('main');
      if (!m || m.innerText.trim().length <= 20) return false;
      if (/^\s*加载中/.test(m.innerText)) return false;
      return !m.querySelector('.skeleton, [class*=skeleton]');
    }, null, { timeout: 20000 })
    .catch(() => {});
  await p.waitForTimeout(1200);
  let got = await probeMain(p);
  // 首屏接口偶发慢（本地 sqlite 被并发占住）：空白重载一次再量，避免把「没等到」当结构差异
  for (let i = 0; i < 2 && got.text.trim().length < 40; i += 1) {
    await p.reload({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2000);
    got = await probeMain(p);
  }
  // 表页首屏「有骨架没行」（冷启动接口慢）也不是结构差异：重载一次再量
  if (want.rows_visible && got.rows === 0) {
    await p.reload({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2500);
    got = await probeMain(p);
  }
  return got;
}

for (const page of STRUCT_PAGES) {
  const want = SPEC.pages?.[page]?.structure;
  if (!want) { rows.push({ page, name: '结构记录', ours: '无', want: 'spec.pages 有 structure', ok: true }); continue; }
  const got = await go(page, want);
  rows.push(...structureRows(page, got, want, SPEC.pages?.[page]?.row_pitch));
}

await browser.close();
for (const r of rows) console.log(`${r.ok ? 'PASS' : 'DIFF'}  [${r.page}] ${r.name} — 我们 ${r.ours} / 真机 ${r.want}`);
const pass = rows.filter((r) => r.ok).length;
fs.writeFileSync(path.join(ROOT, 'docs/ref/structure-parity.json'), JSON.stringify({
  _note: '由 scripts/structure_parity.mjs 生成：spec.pages[*].structure（真机截图量测）vs 我们的 DOM',
  at: new Date().toISOString(),
  base: BASE,
  pass, total: rows.length, rows,
}, null, 2));
console.log(`\n结构对齐 ${pass}/${rows.length}（${Math.round((pass / rows.length) * 100)}%）· 基准 docs/ref/vrcx0-spec.json → pages[*].structure`);
process.exit(pass === rows.length ? 0 : 1);
