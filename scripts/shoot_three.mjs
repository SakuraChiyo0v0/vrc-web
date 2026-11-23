/**
 * 三端截图入库：16 页 × desktop(1700×1040) / mobile(390×844) / 4k(3840×2160) + 好友模态三端。
 *
 *   node scripts/shoot_three.mjs [baseUrl]        # 默认 http://127.0.0.1:8899（demo.mjs）
 *
 * 口径：
 *   - desktop 用真机窗口尺寸 1700×1040，可直接与 docs/ref/vrcx0-*.png 逐像素比对；
 *   - 4k 用 3840×2160，mobile 用 390×844（与既有 round 截图一致）；
 *   - 每张图落 docs/screenshots/tri/<page>-<端>.png，并记字节数/是否空态到 docs/ref/shots.json；
 *   - 小于 12KB 视为可疑（空白/错误页），报 FAIL 并 exit 1 —— 宁可失败也别把空图算成「已入库」。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const PW_HOME = process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json';
const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = createRequire(PW_HOME)('playwright'); }
const { chromium } = pw;

const BASE = (process.argv[2] || 'http://127.0.0.1:8899').replace(/\/$/, '');
const ROOT = process.env.VRC_ROOT || path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs/screenshots/tri');
fs.mkdirSync(OUT, { recursive: true });
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

// 与 web/src/App.jsx 的路由一致
const PAGES = ['overview', 'search', 'friends', 'feed', 'notifications', 'sessions', 'players',
  'favorites', 'insights', 'worlds', 'friendlist', 'friendlog', 'gamelog', 'settings'];
const SIZES = {
  desktop: { width: 1700, height: 1040 },
  mobile: { width: 390, height: 844 },
  '4k': { width: 3840, height: 2160 },
};
const MIN_BYTES = 12 * 1024;

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const report = { base: BASE, sizes: SIZES, shots: {}, fails: [] };

async function shoot(page, url, file) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#vrc-topbar', { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1100);
  const p = path.join(OUT, file);
  await page.screenshot({ path: p });
  const bytes = fs.statSync(p).size;
  const rec = { file: `docs/screenshots/tri/${file}`, bytes };
  if (bytes < MIN_BYTES) { rec.error = 'too_small'; report.fails.push(`docs/screenshots/tri/${file}`); }
  return rec;
}

for (const size of Object.keys(SIZES)) {
  const vp = SIZES[size];
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
  console.log(`\n[${size}] ${vp.width}×${vp.height}`);
  for (const name of PAGES) {
    const file = `${name}-${size}.png`;
    const rec = await shoot(page, `${BASE}/#/${name}`, file);
    report.shots[file] = rec;
    console.log(`  ${rec.error ? '✗' : '✓'} ${file}  ${(rec.bytes / 1024).toFixed(0)}KB`);
  }
  // 好友模态（完成定义里单列）
  const drawerFile = `friend-drawer-${size}.png`;
  await page.goto(`${BASE}/#/friends`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.friend-row:not(.list-head)', { timeout: 25000 }).catch(() => {});
  await page.locator('.friend-row[data-user="usr_alice"]').click({ force: true, timeout: 6000 })
    .catch(() => page.locator('.friend-row:not(.list-head)').first().click({ force: true, timeout: 6000 })).catch(() => {});
  await page.waitForSelector('.fd-card', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(800);
  const p = path.join(OUT, drawerFile);
  await page.screenshot({ path: p });
  const bytes = fs.statSync(p).size;
  const hasDrawer = await page.locator('.fd-card').count();
  const rec = { file: `docs/screenshots/tri/${drawerFile}`, bytes, drawer: !!hasDrawer };
  if (bytes < MIN_BYTES || !hasDrawer) { rec.error = 'missing_drawer'; report.fails.push(rec.file); }
  report.shots[drawerFile] = rec;
  console.log(`  ${rec.error ? '✗' : '✓'} ${drawerFile}  ${(bytes / 1024).toFixed(0)}KB  drawer=${rec.drawer}`);
  await page.close();
}

await browser.close();
const n = Object.keys(report.shots).length;
report.summary = { total: n, ok: n - report.fails.length, fails: report.fails.length };
fs.writeFileSync(path.join(ROOT, 'docs/ref/shots.json'), JSON.stringify(report, null, 1) + '\n');
console.log(`\n三端截图 ${report.summary.ok}/${n} → docs/ref/shots.json`);
if (report.fails.length) { console.error('FAIL: ' + report.fails.join(', ')); process.exit(1); }
