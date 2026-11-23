/**
 * 临时探针：量我们右栏内部各块的 DOM 尺寸（用完即删）
 *   node scripts/_probe_rail.mjs [baseUrl]
 */
import { createRequire } from 'node:module';
const PW_HOME = process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json';
const req = createRequire(import.meta.url);
let pw;
try { pw = req('playwright'); } catch { pw = createRequire(PW_HOME)('playwright'); }
const { chromium } = pw;
const BASE = process.argv[2] || 'http://127.0.0.1:8899';
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1688, height: 1028 }, deviceScaleFactor: 1 });
await page.goto(`${BASE}/#/feed`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#vrc-topbar', { timeout: 20000 });
await page.waitForTimeout(1200);
const out = await page.evaluate(() => {
  const r = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
  };
  const rows = [...document.querySelectorAll('.roster-row')].map((el) => el.getBoundingClientRect()).slice(0, 4).map((b) => +b.y.toFixed(1));
  const heads = [...document.querySelectorAll('.group-head')].map((el) => el.getBoundingClientRect()).slice(0, 3).map((b) => ({ y: +b.y.toFixed(1), h: +b.height.toFixed(1) }));
  return {
    rail: r('[data-testid="roster-rail"]'),
    resize: r('[data-testid="roster-resize"]'),
    self: r('[data-testid="roster-self"]'),
    selfAvatar: r('.roster-self-avatar'),
    filter: r('[data-testid="roster-filter"]'),
    iconrail: r('[data-testid="roster-iconrail"]'),
    workspace: r('.workspace'),
    rows, heads,
    rosterRows: document.querySelectorAll('.roster-row').length,
    sections: [...document.querySelectorAll('section[data-section]')].map((s) => s.dataset.section)
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
