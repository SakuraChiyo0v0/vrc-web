/**
 * 探针：长列表滚动位置在「开合抽屉」「旋转屏幕」后是否保持，以及滚动是否顺畅。
 *   node scripts/_probe_scroll_keep.mjs [baseUrl]
 */
import path from 'node:path';
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;

const BASE = process.argv[2] || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH
  || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

const SCR = () => `(() => {
  // 找最深/最长的可滚容器
  let best = null;
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (!/(auto|scroll)/.test(cs.overflowY)) continue;
    if (el.scrollHeight - el.clientHeight > 40) {
      if (!best || el.scrollHeight > best.scrollHeight) best = el;
    }
  }
  return best;
})()`;

for (const [page, w, h] of [['friendlist', 390, 844], ['feed', 390, 844], ['friendlist', 360, 800]]) {
  const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true });
  await tab.goto(`${BASE}#/${page}`, { waitUntil: 'domcontentloaded' });
  await tab.waitForTimeout(1800);
  const info = await tab.evaluate(([sel]) => {
    const best = eval(sel);
    if (!best) return null;
    best.scrollTop = 250;
    return {
      cls: best.className.toString().slice(0, 40),
      tag: best.tagName,
      top: Math.round(best.scrollTop),
      clientH: best.clientHeight, scrollH: best.scrollHeight,
      rows: document.querySelectorAll('tbody tr').length,
    };
  }, [SCR()]);
  if (!info) { console.log(`${page}@${w}: 没有可滚容器`); await tab.close(); continue; }

  // 开抽屉 → 关抽屉
  await tab.click('button[aria-label="菜单"]');
  await tab.waitForTimeout(400);
  await tab.click('.vrc-sidebar-close');
  await tab.waitForTimeout(500);
  const afterDrawer = await tab.evaluate(([sel]) => { const b = eval(sel); return b ? Math.round(b.scrollTop) : -1; }, [SCR()]);

  // 旋转到横屏再回竖屏
  await tab.setViewportSize({ width: 844, height: 390 });
  await tab.waitForTimeout(700);
  const land = await tab.evaluate(([sel]) => { const b = eval(sel); return b ? { top: Math.round(b.scrollTop), sh: b.scrollHeight, ch: b.clientHeight } : null; }, [SCR()]);
  await tab.setViewportSize({ width: w, height: h });
  await tab.waitForTimeout(700);
  const afterRotate = await tab.evaluate(([sel]) => { const b = eval(sel); return b ? Math.round(b.scrollTop) : -1; }, [SCR()]);

  // 深滚一格：量 30 次 scrollTop 赋值耗时（布局抖动指标）
  const perf = await tab.evaluate(([sel]) => {
    const b = eval(sel);
    if (!b) return null;
    const t0 = performance.now();
    for (let i = 0; i < 30; i += 1) b.scrollTop = (i * 97) % Math.max(1, b.scrollHeight - b.clientHeight);
    b.getBoundingClientRect();
    return Math.round(performance.now() - t0);
  }, [SCR()]);

  console.log(`${page}@${w}x${h}: 容器 ${info.tag}.${info.cls} 行=${info.rows} client=${info.clientH} scroll=${info.scrollH}`);
  console.log(`  scrollTop ${info.top} → 抽屉开合后 ${afterDrawer} → 横屏 ${land ? land.top + ' (sh=' + land.sh + ' ch=' + land.ch + ')' : 'n/a'} → 回竖屏 ${afterRotate}`);
  console.log(`  30 次深滚 ${perf}ms`);
  await tab.close();
}
await browser.close();
