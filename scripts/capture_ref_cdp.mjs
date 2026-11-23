/**
 * 从 PC 上真机运行的 VRCX-0（WebView2）里逐页截参考图 → docs/ref/vrcx0-<page>.png
 *
 *   ssh -N -L 9223:127.0.0.1:9223 pc        # 前提：VRCX-0 用 run-debug.cmd 启动（WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223）
 *   node scripts/capture_ref_cdp.mjs [--only search,settings]
 *
 * 为什么走 CDP 而不是窗口截图：同一张图里既有真机数据又能精确控到 1700×1040 的布局尺寸，
 * 窗口截图受缩放/DPI 影响（上一批 1700×1040 就是 DPI 折算出来的）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/opt/data/cache/hermes-daily-template/node_modules/playwright/index.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs/ref');
const CDP = process.env.CDP_URL || 'http://127.0.0.1:9223';
const W = 1700;
const H = 1040;

// 页面 → VRCX-0 真机路由。calendar 在 VRCX-0 里没有独立页（日历只做实例上的小标记），不映射。
const MAP = [
  { name: 'search', route: '/search', expect: '搜索' },
  { name: 'notifications', route: '/notification', expect: '通知' },
  { name: 'players', route: '/player-list', expect: '玩家' },
  { name: 'stats', route: '/charts', expect: '统计' },
  { name: 'favorites', route: '/favorites/friends', expect: '收藏' },
  { name: 'insights', route: '/charts/mutual', expect: '关系' },
  { name: 'worlds', route: '/favorites/worlds', expect: '世界' },
  { name: 'friendlist', route: '/social/friend-list', expect: '好友' },
  { name: 'friendlog', route: '/social/friend-log', expect: '日志' },
  { name: 'settings', route: '/settings', expect: '设置' },
  { name: 'moderation', route: '/social/moderation', expect: '玩家' }
];

const only = process.argv.includes('--only')
  ? new Set((process.argv[process.argv.indexOf('--only') + 1] || '').split(','))
  : null;

const browser = await chromium.connectOverCDP(CDP);
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url().includes('tauri.localhost')) || ctx.pages()[0];
if (!page) throw new Error('VRCX-0 没有可用的 page（应用没开？）');

await page.setViewportSize({ width: W, height: H }).catch(() => {});
await page.evaluate(() => {
  // 有些容器自己滚（表格/列表），统一回顶部，避免截到滚了一半的页
  document.querySelectorAll('*').forEach((el) => {
    if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight) el.scrollTop = 0;
  });
  window.scrollTo(0, 0);
});

const report = [];
for (const t of MAP) {
  if (only && !only.has(t.name)) continue;
  await page.evaluate((r) => { window.location.hash = '#' + r; }, t.route);
  await page.waitForTimeout(1400);
  // 路由块是懒加载的：等正文出现预期关键词，超时就照实报（可能是没登录/空态）
  const ok = await page
    .evaluate((kw) => document.body.innerText.includes(kw), t.expect)
    .catch(() => false);
  await page.evaluate(() => {
    document.querySelectorAll('*').forEach((el) => {
      if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight) el.scrollTop = 0;
    });
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);
  const file = path.join(OUT, `vrcx0-${t.name}.png`);
  await page.screenshot({ path: file });
  const size = await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]);
  const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 160));
  report.push({ name: t.name, route: t.route, expect_ok: ok, viewport: size, bytes: fs.statSync(file).size, text });
  console.log(`${t.name}\t${t.route}\texpect=${ok ? 'ok' : 'MISS'}\t${size.join('x')}\t${fs.statSync(file).size}B\t${text}`);
}

// 收尾回到朋友动态，别把人家窗口留在设置页
await page.evaluate(() => { window.location.hash = '#/feed'; }).catch(() => {});
fs.writeFileSync(path.join(OUT, 'capture-report.json'), JSON.stringify(report, null, 1) + '\n');
await browser.close();
