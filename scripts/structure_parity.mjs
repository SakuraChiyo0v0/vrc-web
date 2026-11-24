/**
 * 页面结构对齐：docs/ref/vrcx0-spec.json → pages[*].structure（逐条来自真机截图量测）vs 我们的 DOM。
 *
 *   node scripts/structure_parity.mjs [baseUrl]     # 默认 http://127.0.0.1:8891（server/scripts/demo.mjs）
 *
 * 只比「截图能证明的结构」：表格列数与列名、可见行数、tab/chip/子导航文字、网格列数、空态文案。
 * 断言实现在 scripts/lib/page_structure.mjs（visual_parity.mjs 共用，保证两边口径一致）。
 * 每项输出 PASS/DIFF；有 DIFF 就 exit 1。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { probeMain, structureRows, STRUCT_PAGES, PAGE_ROUTES, assertVrcServer, dataDependentWant, emptyDataReason } from './lib/page_structure.mjs';

const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = pw;

const BASE = (process.argv[2] || process.env.VRC_BASE || 'http://127.0.0.1:8891').replace(/\/$/, '');
const roster = await assertVrcServer(BASE);
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
  // 表页首屏「有骨架没行」（冷启动接口慢）也不是结构差异：先等 tbody 出第一行再量，
  // 仍 0 才重载一次。第 33 轮 structure 段在 regress 冷启动时量到 [friendlist] 一屏行数 0，
  // 单跑同一页面却是 20 行——接口 0.4s 就有数据，纯粹是固定 1200ms 等不到首屏接口。
  if (want.rows_visible) {
    const hasRow = () => p.evaluate(() => {
      const m = document.querySelector('.workspace') || document.querySelector('main') || document.body;
      return m.querySelectorAll('tbody tr').length > 0;
    }).catch(() => false);
    if (!(await hasRow())) {
      await p.waitForFunction(() => {
        const m = document.querySelector('.workspace') || document.querySelector('main') || document.body;
        return m.querySelectorAll('tbody tr').length > 0;
      }, null, { timeout: 20000 }).catch(() => {});
      await p.waitForTimeout(400);
      got = await probeMain(p);
    }
  }
  if (want.rows_visible && got.rows === 0) {
    const api = await p.evaluate(async (base) => {
      try {
        const r = await fetch(`${base}/api/friend-list?limit=2000&sort=last_seen&page_size=20&page=1`);
        const j = await r.json().catch(() => null);
        return { status: r.status, friends: j?.friends?.length ?? null, total: j?.total ?? null };
      } catch (e) { return { status: 'fetch-error', err: String(e).slice(0, 80) }; }
    }, BASE).catch(() => null);
    console.log(`  [${page}] 表页 0 行，重载一次；/api/friend-list → ${JSON.stringify(api)}`);
    await p.reload({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2500);
    got = await probeMain(p);
  }
  // 网格页首屏结果没回来（搜索页偶发空列表）同样不是结构差异：重载一次再量
  if (want.grid_columns && got.gridCols !== want.grid_columns) {
    await p.reload({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(2500);
    got = await probeMain(p);
  }
  // 概览右栏三块榜单挂在 `tab==='overview' && data` 后面：/api/overview 慢或失败时整块是 null，
  // 会把「接口没回来」量成「榜单节数 0/3」的结构差异（第三十一轮 regress 就这样误报 4 项）。
  // 这里按页面等自己的锚点，仍缺就重载一次，并把接口状态打出来，区分接口红与结构红。
  if (page === 'overview' || want.lists?.length) {
    const rail = () => p.evaluate(() => document.querySelectorAll('.ov-rail .ov-sec').length);
    for (let i = 0; i < 2 && (await rail()) < (want.lists?.length ?? 3); i += 1) {
      await p
        .waitForSelector('.ov-rail .ov-sec', { timeout: 25000 })
        .catch(() => {});
      if ((await rail()) >= (want.lists?.length ?? 3)) break;
      const api = await p.evaluate(async (base) => {
        try {
          const r = await fetch(`${base}/api/overview?range=all`);
          const j = await r.json().catch(() => null);
          return { status: r.status, companions: j?.companions?.length ?? null, sessions: j?.sessions ?? null };
        } catch (e) { return { status: 'fetch-error', err: String(e).slice(0, 80) }; }
      }, BASE);
      console.log(`  [overview] 右栏未渲染（第 ${i + 1} 次），/api/overview → ${JSON.stringify(api)}`);
      await p.reload({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
      await p.waitForTimeout(2500);
    }
    got = await probeMain(p);
  }
  return got;
}

for (const page of STRUCT_PAGES) {
  const want = SPEC.pages?.[page]?.structure;
  if (!want) { rows.push({ page, name: '结构记录', ours: '无', want: 'spec.pages 有 structure', ok: true }); continue; }
  // 空桶不出栏（规则见 lib/dataDependentWant，visual_parity 共用）
  const w = dataDependentWant(page, want, roster);
  const got = await go(PAGE_ROUTES[page] || page, w);
  const out = structureRows(page, got, w, SPEC.pages?.[page]?.row_pitch);
  // 数据为空时（线上库 0 条收藏 / 0 条屏蔽记录）失败项记 SKIP：不是结构变差，是没数据可比，
  // 既不能算 PASS 混进分母，也不能算 DIFF 把线上跑红。
  const why = emptyDataReason(page, got);
  if (why) {
    for (const r of out) if (!r.ok) Object.assign(r, { ok: true, skip: true, want: `${r.want}（跳过：${why}）` });
  }
  rows.push(...out);
}

await browser.close();
for (const r of rows) console.log(`${r.skip ? 'SKIP' : r.ok ? 'PASS' : 'DIFF'}  [${r.page}] ${r.name} — 我们 ${r.ours} / 真机 ${r.want}`);
const skipped = rows.filter((r) => r.skip).length;
const judged = rows.length - skipped;
const pass = rows.filter((r) => r.ok && !r.skip).length;
fs.writeFileSync(path.join(ROOT, 'docs/ref/structure-parity.json'), JSON.stringify({
  _note: '由 scripts/structure_parity.mjs 生成：spec.pages[*].structure（真机截图量测）vs 我们的 DOM',
  at: new Date().toISOString(),
  base: BASE,
  pass, skipped, total: rows.length, rows,
}, null, 2));
console.log(`\n结构对齐 ${pass}/${judged}（${Math.round((pass / judged) * 100)}%）${skipped ? ` · ${skipped} 项数据为空跳过` : ''} · 基准 docs/ref/vrcx0-spec.json → pages[*].structure`);
process.exit(pass === judged ? 0 : 1);
