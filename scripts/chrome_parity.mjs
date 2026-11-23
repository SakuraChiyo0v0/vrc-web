/**
 * 184 外壳结构对齐：在浏览器里量我们自己的 DOM，逐项比 docs/ref/vrcx0-spec.json → chrome。
 *
 *   NODE_PATH=/opt/data/cache/hermes-daily-template/node_modules \
 *     node scripts/chrome_parity.mjs [baseUrl]
 *
 * 口径：
 *   - 截图尺寸 1688×1028 = 真机窗口 1700×1040 去掉 6px 边框（spec.chrome.inner），
 *     所以我们的 DOM 坐标减去视口原点就能和 spec 里的 inner 相对坐标直接比。
 *   - 容差 ±2px；内容面板高度单独给 4px（真机窗口上下各 2px 内缩：inner 从 y6 起、
 *     状态栏底 1032 而 inner 底 1034），其余项一律 2px。
 *   - 数值全部来自截图量测（scripts/measure_ref_chrome.py），本脚本不自拟断言。
 * 产出 docs/ref/chrome-parity.json；有 FAIL 则 exit 1。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// playwright 不在本仓库依赖里（容器只有一份装在 hermes 模板目录），ESM 不吃 NODE_PATH，所以显式按路径 require
const PW_HOME = process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json';
const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = createRequire(PW_HOME)('playwright'); }
const { chromium } = pw;

const BASE = process.argv[2] || 'http://127.0.0.1:8899';
const ROOT = process.env.VRC_ROOT || path.resolve(import.meta.dirname, '..');
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/ref/vrcx0-spec.json'), 'utf8')).chrome;
const OUT = path.join(ROOT, 'docs/ref/chrome-parity.json');
const SHOT = path.join(ROOT, 'docs/screenshots/compare');
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const W = SPEC.inner.w;   // 1688
const H = SPEC.inner.h;   // 1028
// spec 里的绝对坐标 → 相对 inner 原点
const rel = (v, base) => v - base;
const want = {
  'topbar.h': SPEC.topbar.h,
  'topbar.y': rel(SPEC.topbar.y, SPEC.inner.y),
  'sidebar.x': rel(SPEC.sidebar.x, SPEC.inner.x),
  'sidebar.w': SPEC.sidebar.w,
  'sidebar.y': rel(SPEC.topbar.y + SPEC.topbar.h, SPEC.inner.y),
  'statusbar.h': SPEC.statusbar.h,
  'content.x': rel(SPEC.content.x, SPEC.inner.x),
  'content.y': rel(SPEC.content.y, SPEC.inner.y),
  'content.w': SPEC.content.w,
  'content.h': SPEC.content.h,
  'content.right_gap': rel(SPEC.inner.x + SPEC.inner.w, SPEC.inner.x) - rel(SPEC.content.x + SPEC.content.w, SPEC.inner.x)
};
const tol = { 'content.h': 4 };

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const rows = [];
try {
  await page.goto(`${BASE}/#/feed`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#vrc-topbar', { timeout: 20000 });
  await page.waitForSelector('#vrc-statusbar', { timeout: 20000 });
  await page.waitForSelector('aside.vrc-sidebar', { timeout: 20000 });
  await page.waitForTimeout(600);

  const got = await page.evaluate(() => {
    const r = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 };
    };
    return {
      topbar: r('#vrc-topbar'),
      sidebar: r('aside.vrc-sidebar'),
      statusbar: r('#vrc-statusbar'),
      content: r('.workspace'),
      roster: r('[data-testid="roster-rail"]'),
      vw: window.innerWidth,
      vh: window.innerHeight
    };
  });

  const ours = {
    'topbar.h': got.topbar.h,
    'topbar.y': got.topbar.y,
    'sidebar.x': got.sidebar.x,
    'sidebar.w': got.sidebar.w,
    'sidebar.y': got.sidebar.y,
    'statusbar.h': got.statusbar.h,
    'content.x': got.content.x,
    'content.y': got.content.y,
    'content.w': got.content.w,
    'content.h': got.content.h,
    'content.right_gap': Math.round((got.vw - (got.content.x + got.content.w)) * 10) / 10
  };

  for (const k of Object.keys(want)) {
    const o = ours[k];
    const w = want[k];
    const t = tol[k] ?? 2;
    const diff = Math.round((o - w) * 10) / 10;
    rows.push({ metric: k, ours: o, ref: w, diff, tol: t, ok: Math.abs(diff) <= t });
  }
  // 壳体自洽（不依赖真机）：三段高度正好铺满视口、内容面板贴侧栏右侧
  rows.push({ metric: 'shell.fill', ours: Math.round(got.topbar.h + got.statusbar.h + got.content.h), ref: H, diff: Math.round(got.topbar.h + got.statusbar.h + got.content.h - H), tol: 0, ok: Math.abs(got.topbar.h + got.statusbar.h + got.content.h - H) <= 1 });
  rows.push({ metric: 'content.flush_sidebar', ours: ours['content.x'], ref: ours['sidebar.x'] + ours['sidebar.w'], diff: Math.round((ours['content.x'] - ours['sidebar.x'] - ours['sidebar.w']) * 10) / 10, tol: 1, ok: Math.abs(ours['content.x'] - ours['sidebar.x'] - ours['sidebar.w']) <= 1 });
  rows.push({ metric: 'roster.default_off', ours: got.roster ? 'open' : 'closed', ref: 'closed', diff: '-', tol: '-', ok: !got.roster });

  fs.mkdirSync(SHOT, { recursive: true });
  await page.screenshot({ path: path.join(SHOT, 'chrome-1688.png') });
} finally {
  await browser.close();
}

const pass = rows.filter((r) => r.ok).length;
const report = {
  _note: 'chrome_parity.mjs：视口 1688×1028（真机 inner），逐项比 spec.chrome，容差 ±2px（content.h 4px 见脚本头注释）',
  base: BASE,
  viewport: { w: W, h: H },
  score: Number(((pass / rows.length) * 100).toFixed(1)),
  rows
};
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 1)}\n`);

const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('metric', 22)}${pad('ours', 9)}${pad('ref', 9)}${pad('diff', 8)}ok`);
for (const r of rows) console.log(`${pad(r.metric, 22)}${pad(r.ours, 9)}${pad(r.ref, 9)}${pad(r.diff, 8)}${r.ok ? 'PASS' : 'FAIL'}`);
console.log(`\n结构一致度 ${report.score}% (${pass}/${rows.length}) → ${path.relative(ROOT, OUT)}`);
process.exit(pass === rows.length ? 0 : 1);
