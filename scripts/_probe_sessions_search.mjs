// 探针：sessions 页搜索模式（点「搜索」段后）的输入框尺寸/命中/键盘遮挡
// 用法：node scripts/_probe_sessions_search.mjs [baseUrl]
import { createRequire } from 'node:module';
const _req = createRequire(import.meta.url);
let _pw;
try { _pw = _req('playwright'); } catch { _pw = createRequire(process.env.PW_HOME || '/opt/data/cache/hermes-daily-template/package.json')('playwright'); }
const { chromium } = _pw;
const BASE = process.argv[2] || process.env.VRC_BASE || 'http://127.0.0.1:8891';
const EXE = process.env.CHROME_PATH || '/opt/data/cache/pw-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
for (const [w, h] of [[390, 844], [360, 800], [844, 390]]) {
  const tab = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await tab.goto(`${BASE}#/sessions`, { waitUntil: 'domcontentloaded' });
  await tab.waitForTimeout(1500);
  const before = await tab.evaluate(() => ({
    inputs: document.querySelectorAll('.sess-search input').length,
    mode: [...document.querySelectorAll('.sess-seg button')].map((b) => `${b.textContent}:${b.dataset.active}`).join(','),
  }));
  // 点「搜索」段
  await tab.evaluate(() => [...document.querySelectorAll('.sess-seg button')].find((b) => b.textContent.trim() === '搜索')?.click());
  await tab.waitForTimeout(400);
  const m = await tab.evaluate(() => {
    const inp = document.querySelector('.sess-search input');
    if (!inp) return { found: false };
    const r = inp.getBoundingClientRect();
    const cs = getComputedStyle(inp);
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hitEl = document.elementFromPoint(cx, cy);
    // 16px 文字在 30px 高盒子里会不会被上下裁掉：scrollHeight vs clientHeight
    const wrap = inp.parentElement.getBoundingClientRect();
    return {
      found: true,
      w: Math.round(r.width), h: Math.round(r.height),
      font: parseFloat(cs.fontSize), top: Math.round(r.top), bottom: Math.round(r.bottom),
      hitSelf: !!hitEl && (hitEl === inp || inp.contains(hitEl)),
      hitWhat: hitEl ? `${hitEl.tagName.toLowerCase()}.${(hitEl.className || '').toString().split(' ')[0]}` : null,
      scrollH: inp.scrollHeight, clientH: inp.clientHeight,
      wrapH: Math.round(wrap.height),
      segH: Math.round(document.querySelector('.sess-seg').getBoundingClientRect().height),
      scrollTop: Math.round(document.querySelector('.sess-scroll')?.scrollTop ?? -1),
      overflowY: getComputedStyle(document.querySelector('.sess-scroll')).overflowY,
    };
  });
  // 聚焦 + 模拟 iOS 键盘（可视高 380）
  await tab.evaluate(() => document.querySelector('.sess-search input')?.focus());
  await tab.evaluate(() => {
    const vv = window.visualViewport;
    Object.defineProperty(vv, 'height', { configurable: true, get: () => 380 });
    vv.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
  });
  await tab.waitForTimeout(500);
  const kb = await tab.evaluate(() => {
    const inp = document.querySelector('.sess-search input');
    const r = inp.getBoundingClientRect();
    const list = document.querySelector('.sess-scroll').getBoundingClientRect();
    return {
      appVh: getComputedStyle(document.documentElement).getPropertyValue('--app-vh').trim(),
      inpTop: Math.round(r.top), inpBottom: Math.round(r.bottom),
      listH: Math.round(list.height), listBottom: Math.round(list.bottom),
      focused: document.activeElement === inp,
    };
  });
  const visible = await tab.evaluate(() => {
    // 键盘弹出后输入框是否被内容区顶到可视区外
    const inp = document.querySelector('.sess-search input').getBoundingClientRect();
    return { top: Math.round(inp.top), bottom: Math.round(inp.bottom), vh: Math.round(window.visualViewport.height) };
  });
  console.log(JSON.stringify({ vp: `${w}x${h}`, before, m, kb, visible }, null, 1));
  await tab.close();
}
await browser.close();
