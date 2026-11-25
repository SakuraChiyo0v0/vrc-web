/**
 * 「NAV 文案与顺序」只读对照：把真机基准 docs/ref/nav-inventory.json 的 reference 顺序，
 * 跟页面实际渲染出来的侧栏行（文案 + 层级 + 折叠夹子项）逐条 diff。
 *
 *   node scripts/nav_inventory_check.mjs [baseUrl]
 *   node scripts/nav_inventory_check.mjs --strict      # 有 MISSING/EXTRA/ORDER 则 exit 1
 *
 * 默认只报告、exit 0：对齐表刚建立时必然有差异（9 条缺页），不该把回归流水线染红。
 * 等文案/顺序对齐做完，再在 regress_all.sh 里加 --strict。
 *
 * 对齐方式：先按 id 配对（ref.ours ↔ data-nav-id），配对不上的 ref 记 MISSING、act 记 EXTRA；
 * 再查顺序——配对项在 DOM 里的下标必须单调递增，否则记 ORDER。
 * 产出 docs/ref/nav-inventory-check.json。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const PW_HOME = process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json';
const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = createRequire(PW_HOME)('playwright'); }
const { chromium } = pw;

const argv = process.argv.slice(2);
const STRICT = argv.includes('--strict');
const BASE = (argv.find((a) => a.startsWith('http')) || process.env.VRC_BASE || 'http://127.0.0.1:8891').replace(/\/+$/, '');
const ROOT = process.env.VRC_ROOT || path.resolve(import.meta.dirname, '..');
const INVENTORY = path.join(ROOT, 'docs/ref/nav-inventory.json');
const OUT = path.join(ROOT, 'docs/ref/nav-inventory-check.json');
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const inv = JSON.parse(fs.readFileSync(INVENTORY, 'utf8'));

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1688, height: 1028 } });
await page.goto(`${BASE}/#/friends`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.vrc-sidebar .nav-item', { timeout: 20000 });
await page.waitForTimeout(600);

// 按 DOM 顺序读全部行：data-nav-kind=top|folder|sub，折叠夹子项带上父 id。
const actual = await page.evaluate(() => {
  const rows = [];
  const walk = (root, parentId) => {
    for (const el of root.children) {
      const item = el.matches('.nav-item') ? el : el.querySelector(':scope > .nav-item');
      if (item) {
        const kind = item.dataset.navKind || 'top';
        rows.push({
          kind,
          label: (item.querySelector('span.truncate')?.textContent || '').trim(),
          id: item.dataset.navId || null,
          parent: kind === 'sub' ? parentId : null
        });
      }
      const sub = el.querySelector(':scope > .nav-sub');
      if (sub) walk(sub, el.querySelector(':scope > .nav-item')?.dataset.navId || null);
    }
  };
  walk(document.querySelector('.vrc-sidebar nav') || document.querySelector('.vrc-sidebar'), null);
  // 页脚（设置 / 收起导航栏）不在 <nav> 里但「设置」是真机的一条页面：一并读，收起按钮 kind=footer 由过滤排除。
  const foot = document.querySelector('.vrc-sidebar [data-nav-footer]');
  if (foot) walk(foot, null);
  return rows;
});
await browser.close();

// 真机末尾「收起导航栏」是折叠按钮，不在 nav 行里；只比 page/folder/sub 三类。
const refRows = inv.reference.filter((r) => ['page', 'folder', 'sub'].includes(r.kind));
const actRows = actual.filter((r) => ['top', 'folder', 'sub'].includes(r.kind));
const actById = new Map(actRows.map((r, i) => [r.id, { ...r, index: i }]));

const matched = [];
const missing = [];
const usedAct = new Set();
for (const ref of refRows) {
  const act = ref.ours ? actById.get(ref.ours) : null;
  if (!act) {
    missing.push({ label: ref.label, kind: ref.kind, verdict: ref.verdict, parent: ref.parent ?? null });
    continue;
  }
  usedAct.add(act.index);
  matched.push({
    ref: ref.label,
    actual: act.label,
    id: act.id,
    kind: ref.kind,
    status: ref.label === act.label && (ref.kind === 'sub') === (act.kind === 'sub') ? 'SAME' : 'RENAME',
    ref_index: refRows.indexOf(ref),
    act_index: act.index
  });
}
const extra = actRows
  .map((r, i) => ({ ...r, index: i }))
  .filter((r) => !usedAct.has(r.index))
  .map((r) => ({ label: r.label, id: r.id, kind: r.kind, index: r.index }));

// 顺序：配对项在 DOM 中的下标必须随真机顺序单调递增。
const inversions = [];
for (let i = 1; i < matched.length; i += 1) {
  if (matched[i].act_index < matched[i - 1].act_index) {
    inversions.push({ after: matched[i - 1].ref, next: matched[i].ref, act_index: matched[i].act_index });
  }
}

const report = {
  _note: 'nav_inventory_check.mjs：真机基准 docs/ref/nav-inventory.json ↔ 实际渲染侧栏。先按 id 配对（SAME=文案层级都对 / RENAME=同页文案不同），配不上→MISSING(真机有我们没有)/EXTRA(我们有真机没有)，再查顺序单调性→ORDER。',
  base: BASE,
  strict: STRICT,
  ref_rows: refRows.length,
  actual_rows: actRows.length,
  same: matched.filter((m) => m.status === 'SAME').length,
  rename: matched.filter((m) => m.status === 'RENAME').length,
  missing: missing.length,
  extra: extra.length,
  order_inversions: inversions.length,
  matched,
  missing,
  extra,
  inversions
};
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 1)}\n`);

for (const m of matched) {
  if (m.status === 'SAME') continue;
  console.log(`RENAME   ${m.ref.padEnd(10)} → ${m.actual} (${m.id})`);
}
for (const m of missing) console.log(`MISSING  ${m.label} [${m.kind}]${m.parent ? ` @${m.parent}` : ''} → ${m.verdict}`);
for (const e of extra) console.log(`EXTRA    ${e.label} [${e.kind}:${e.id}] (DOM #${e.index})`);
for (const iv of inversions) console.log(`ORDER    ${iv.after} 之后是 ${iv.next}（DOM #${iv.act_index}）`);
console.log(`\nNAV INVENTORY · ref=${refRows.length} actual=${actRows.length} · SAME ${report.same} / RENAME ${report.rename} / MISSING ${report.missing.length} / EXTRA ${report.extra.length} / ORDER ${report.order_inversions}`);
console.log(`→ ${path.relative(ROOT, OUT)}`);

if (STRICT && (report.missing.length + report.extra.length + report.order_inversions)) process.exit(1);
