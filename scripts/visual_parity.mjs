/**
 * 视觉对齐评测：把「我们 vs VRCX-0 规格」变成可量化的数字，而不是靠看图说话。
 *
 *   node scripts/visual_parity.mjs [baseUrl]
 *
 * 做三件事：
 *   1) 在 390 / 1440 / 3840 三个宽度截我们的页面（存 docs/screenshots/compare/）
 *   2) 用 DOM 实测关键尺寸（行高、字号档位、头像、列数、边框），和 docs/ref/vrcx0-spec.json 比
 *   3) 输出每项 PASS/DIFF + 相似度百分比；有 DIFF 就 exit 1（可进 parity）
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:8790';
const ROOT = process.env.VRC_ROOT || path.resolve(import.meta.dirname, '..');
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/ref/vrcx0-spec.json'), 'utf8'));
const OUT = path.join(ROOT, 'docs/screenshots/compare');
fs.mkdirSync(OUT, { recursive: true });

const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const rows = [];
const check = (name, ours, want, ok) => {
  rows.push({ name, ours, want, ok });
};

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

async function shot(width, height, name) {
  const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await p.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  // 等首屏列表出来再截图：容器刚重启时页面还是空壳，会把分数打到 50% 的假低
  await p.waitForSelector('.friend-row, .card', { timeout: 25000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const file = path.join(OUT, `${name}-${width}.png`);
  await p.screenshot({ path: file });
  return p;
}

// —— 好友位置页（默认页）——
const p = await shot(1440, 960, 'friends');

const measured = await p.evaluate(() => {
  const row = document.querySelector('.friend-row');
  const avatar = document.querySelector('.friend-row .avatar');
  const navItem = document.querySelector('aside button, nav button');
  const cs = row ? getComputedStyle(row) : null;
  const sizes = new Set();
  // 只统计可见的、有文字的节点：head/meta/script 的默认 16px 不算版面字号
  document.querySelectorAll('body *').forEach((el) => {
    if (!el.offsetParent && el.tagName !== 'BODY') return;
    if (!(el.textContent || '').trim()) return;
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px > 0) sizes.add(Math.round(px));
  });
  return {
    rowHeight: row ? Math.round(row.getBoundingClientRect().height) : null,
    avatarSize: avatar ? Math.round(avatar.getBoundingClientRect().width) : null,
    rowBorder: cs ? cs.borderTopWidth : null,
    rowBg: cs ? cs.backgroundColor : null,
    navItemHeight: navItem ? Math.round(navItem.getBoundingClientRect().height) : null,
    fontSizes: [...sizes].sort((a, b) => a - b),
    tabular: getComputedStyle(document.body).fontVariantNumeric,
    columns: getComputedStyle(document.querySelector('.friend-row') || document.body).gridTemplateColumns,
  };
});

check('好友行高', `${measured.rowHeight}px`, '32–40px', measured.rowHeight != null && measured.rowHeight <= 40);
check('头像尺寸', `${measured.avatarSize}px`, '≈56px(大方块)/40px(列表)', measured.avatarSize != null && measured.avatarSize >= 22);
check('行无边框底色', `${measured.rowBorder}/${measured.rowBg}`, '0px / transparent', measured.rowBorder === '0px');
check('字号档位', measured.fontSizes.join('/'), `${SPEC.typography.px_sizes_allowed.join('/')}`, measured.fontSizes.filter((s) => ![11, 12, 13, 14].includes(s)).length === 0);
check('数字等宽', measured.tabular, 'tabular-nums', String(measured.tabular).includes('tabular'));

// —— 动态页（表格四列）——
await p.getByRole('button', { name: /动态/ }).first().click().catch(() => {});
await p.waitForSelector('thead th', { timeout: 15000 }).catch(() => {});
await p.waitForTimeout(800);
await p.screenshot({ path: path.join(OUT, 'feed-1440.png') });
const feed = await p.evaluate(() => {
  const ths = [...document.querySelectorAll('thead th')].map((t) => t.textContent.trim());
  const tr = document.querySelector('tbody tr');
  return {
    columnCount: ths.length,
    columns: ths.join('/'),
    rowHeight: tr ? Math.round(tr.getBoundingClientRect().height) : null,
    hasAvatar: !!document.querySelector('tbody img'),
    headerTransform: document.querySelector('thead th') ? getComputedStyle(document.querySelector('thead th')).textTransform : '',
  };
});
check('动态表头列数', feed.columnCount, SPEC.feed_table.columns, feed.columnCount === SPEC.feed_table.columns);
check('动态列名', feed.columns, SPEC.feed_table.column_names.join('/'), feed.columns.includes('时间') && feed.columns.includes('类型'));
check('动态行高', `${feed.rowHeight}px`, '≤48px', feed.rowHeight != null && feed.rowHeight <= 48);
check('动态无头像', String(feed.hasAvatar), 'false', feed.hasAvatar === false);
check('表头不大写', feed.headerTransform, 'none', feed.headerTransform === 'none');

// —— 三宽度截图（响应式）——
for (const [w, h] of [[390, 844], [3840, 2160]]) {
  const pp = await shot(w, h, 'friends');
  const overflow = await pp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  check(`${w}px 无横向溢出`, String(overflow), 'false', overflow === false);
  await pp.close();
}

await p.close();
await browser.close();

const pass = rows.filter((r) => r.ok).length;
const score = Math.round((pass / rows.length) * 100);
for (const r of rows) {
  console.log(`${r.ok ? 'PASS' : 'DIFF'}  ${r.name} — 我们 ${r.ours} / 基准 ${r.want}`);
}
console.log(`\n视觉相似度 ${score}%（${pass}/${rows.length} 项对齐）· 截图在 docs/screenshots/compare/`);
process.exit(pass === rows.length ? 0 : 1);
