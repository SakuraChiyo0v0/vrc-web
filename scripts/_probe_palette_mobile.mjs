// 移动端命令面板（顶栏 ☰ 旁的搜索入口）可用性探针：
//   字号是否会被 iOS 放大 / 输入框命中区 / 结果行命中区与可点性 / 键盘弹出(--app-vh 收缩)后列表是否还有可见行
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw; try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const CASES = [
  [390, 844, 0],
  [360, 800, 0],
  [320, 568, 0],
  [844, 390, 0],
  [390, 844, 380],   // 软键盘占掉 464px
  [390, 844, 300],   // 极端：地址栏+键盘
];

const browser = await chromium.launch({ executablePath: EXE });
for (const [w, h, vh] of CASES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const tab = await ctx.newPage();
  await tab.goto(`${BASE}#/friends`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await tab.waitForTimeout(700);
  if (vh) await tab.evaluate((v) => document.documentElement.style.setProperty('--app-vh', `${v}px`), vh);
  await tab.click('[data-topbar="search-mobile"]');
  await tab.waitForTimeout(350);
  await tab.fill('[data-testid="palette"] input', 'a');
  await tab.waitForFunction(() => document.querySelectorAll('[data-testid="palette"] .cmdk-list button').length > 0, null, { timeout: 8000 }).catch(() => {});
  await tab.waitForTimeout(400);
  const m = await tab.evaluate(() => {
    const p = document.querySelector('[data-testid="palette"]');
    if (!p) return { none: true };
    const inp = p.querySelector('input');
    const list = p.querySelector('.cmdk-list');
    const pr = p.getBoundingClientRect();
    const ir = inp.getBoundingClientRect();
    const cs = getComputedStyle(inp);
    const rows = [...list.querySelectorAll('button')].filter((b) => !b.hasAttribute('data-palette-all'));
    const lr = list.getBoundingClientRect();
    const vvh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const fully = rows.filter((b) => { const r = b.getBoundingClientRect(); return r.top >= lr.top - 1 && r.bottom <= lr.bottom + 1 && r.bottom <= vvh + 1; });
    const first = rows[0];
    let hit = null;
    if (first) {
      const r = first.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      hit = el ? `${el.tagName}${el.closest('button') === first ? '✓' : '✗'}` : 'null';
    }
    // 滚到底看最后一行的中心能否命中
    list.scrollTop = list.scrollHeight;
    const last = rows[rows.length - 1];
    let lastHit = null, lastFully = null;
    if (last) {
      const r = last.getBoundingClientRect();
      const lr2 = list.getBoundingClientRect();
      lastFully = r.top >= lr2.top - 1 && r.bottom <= lr2.bottom + 1 && r.bottom <= vvh + 1;
      const el = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, vvh - 2));
      lastHit = el ? `${el.tagName}${el.closest('button') === last ? '✓' : '✗'}` : 'null';
    }
    const chip = p.querySelector('[data-palette-all]');
    return {
      vvh: Math.round(vvh),
      panelTop: Math.round(pr.top), panelBottom: Math.round(pr.bottom), panelW: Math.round(pr.width),
      inpFont: cs.fontSize, inpH: Math.round(ir.height), inpBottom: Math.round(ir.bottom),
      listClient: Math.round(list.clientHeight), listScroll: Math.round(list.scrollHeight),
      rows: rows.length, rowH: rows.length ? Math.round(rows[0].getBoundingClientRect().height) : 0,
      fully: fully.length, firstHit: hit, lastFully, lastHit,
      chipH: chip ? Math.round(chip.getBoundingClientRect().height) : 0,
    };
  });
  console.log(JSON.stringify({ case: `${w}x${h}${vh ? ` kb${h - vh}` : ''}`, ...m }));
  await ctx.close();
}
await browser.close();
