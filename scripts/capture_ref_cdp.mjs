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

// 页面 → VRCX-0 真机路由。calendar 在 VRCX-0 里没有独立页（实测 #/calendar 落回 #/feed），
// 概览在 VRCX-0 里是「仪表板」，路由带用户自己的 uuid，截图前从侧栏链接里取。
const MAP = [
  { name: 'overview', route: '@dashboard', expect: '仪表板' },
  { name: 'feed', route: '/feed', expect: '好友动态' },
  { name: 'locations', route: '/friends-locations', expect: '好友位置' },
  { name: 'roomhistory', route: '/instance-history', expect: '房间历史' },
  { name: 'gamelog', route: '/game-log', expect: '游戏日志' },
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

// 概览 = 仪表板，uuid 每题不同：从侧栏链接里取（取不到就跳过）
if (MAP.some((t) => t.route === '@dashboard')) {
  const dash = await page
    .evaluate(() => document.querySelector('a[href^="#/dashboard/"]')?.getAttribute('href')?.replace('#', '') ?? null)
    .catch(() => null);
  const t = MAP.find((x) => x.route === '@dashboard');
  if (dash) t.route = dash;
  else t.skip = true;
}

const report = [];
const reportFile = path.join(OUT, 'capture-report.json');
const before = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : [];
const merged = new Map(before.map((r) => [r.name, r]));
for (const t of MAP) {
  if (t.skip) { console.log(`${t.name}\tskipped（没找到仪表板链接）`); continue; }
  if (only && !only.has(t.name)) continue;
  await page.evaluate((r) => { window.location.hash = '#' + r; }, t.route);
  await page.waitForTimeout(1400);
  // 路由块是懒加载的：等正文出现预期关键词，超时就照实报（可能是没登录/空态）
  // 只看 main，避免侧栏导航文字（「玩家」等）把空页也判成命中
  const ok = await page
    .evaluate((kw) => (document.querySelector('main')?.innerText || '').includes(kw), t.expect)
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
  merged.set(t.name, report[report.length - 1]);
  console.log(`${t.name}\t${t.route}\texpect=${ok ? 'ok' : 'MISS'}\t${size.join('x')}\t${fs.statSync(file).size}B\t${text}`);
}

// 收尾回到朋友动态，别把人家窗口留在设置页
await page.evaluate(() => { window.location.hash = '#/feed'; }).catch(() => {});
fs.writeFileSync(reportFile, JSON.stringify([...merged.values()], null, 1) + '\n');
await browser.close();
