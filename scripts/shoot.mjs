/**
 * 三端截图（桌面 1600 / 手机 390 / 4K 3840）——通过 CDP 驱动 PC 上的 Chrome headless。
 *
 *   ssh -N -R 18899:127.0.0.1:8899 -L 9222:127.0.0.1:9222 pc     # 双隧道
 *   APP=http://127.0.0.1:18899/ node scripts/shoot.mjs             # 产出 docs/screenshots/round7-*.png
 *
 * 需要：容器里跑 server/scripts/demo.mjs（8899），PC 上 Chrome --headless=new --remote-debugging-port=9222。
 * 注意：PC 本机 8899 被别的服务占用（图片墙），转发端口固定用 18899，否则截到的是别人的页面。
 */
import fs from 'node:fs';
import path from 'node:path';

const CDP = process.env.CDP ?? 'http://127.0.0.1:9222';
const APP = process.env.APP ?? 'http://127.0.0.1:18899/';
const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
const SET = process.env.SHOOT ?? 'round7';
const PREFIX = process.env.PREFIX ?? SET;
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const res = await fetch(`${CDP}/json/new?about:blank`, { method: 'PUT' });
if (!res.ok) throw new Error(`CDP 建页失败 HTTP ${res.status}`);
const target = await res.json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let seq = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { r, j } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? j(new Error(`${m.error.message} (${JSON.stringify(m.error.data ?? '')})`)) : r(m.result);
  }
};
const send = (method, params = {}) => new Promise((r, j) => {
  const id = ++seq;
  pending.set(id, { r, j });
  ws.send(JSON.stringify({ id, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');

const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`evaluate 失败：${r.exceptionDetails.text}`);
  return r.result?.value;
};

/** 等「加载中」消失，最多 ms 毫秒。 */
async function waitLoaded(ms = 15000) {
  for (let t = 0; t < ms; t += 500) {
    if (!(await evalJs(`/加载中|读取中/.test(document.body.innerText)`))) return true;
    await sleep(500);
  }
  return false;
}

const clickByText = (label) => `(() => {
  const b = [...document.querySelectorAll('button,a')].find((x) => x.textContent.replace(/\\s+/g, '').includes(${JSON.stringify(label)}));
  if (!b) return 'miss'; b.click(); return 'ok';
})()`;

async function shoot(name, width, height, dpr, mobile, clicks, post, reload) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
  // 每张图从干净状态起：上一张留下的搜索词/筛选/排序会经 localStorage 串到下一张
  // （102 的持久化本来就是这个行为），截图要各证各的，所以先清 local_storage。
  await send('Storage.clearDataForOrigin', { origin: new URL(APP).origin, storageTypes: 'local_storage' });
  await send('Page.navigate', { url: APP });
  await sleep(2500);
  await waitLoaded();
  for (const label of clicks) {
    const out = await evalJs(clickByText(label));
    if (out !== 'ok') throw new Error(`点不到「${label}」（${out}）`);
    await sleep(1500);
    await waitLoaded();
  }
  if (post) {
    const out = await evalJs(post);
    if (out !== 'ok') throw new Error(`${name}: 后置动作失败（${out}）`);
    await sleep(800);
  }
  // 102 持久化：动作做完后真刷新一次，页面应沿用 localStorage 里的偏好
  if (reload) {
    await send('Page.reload');
    await sleep(2500);
    await waitLoaded();
    await sleep(800);
  }
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const file = path.join(OUT, `${PREFIX}-${name}.png`);
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  const info = await evalJs(`JSON.stringify({ title: document.title, w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, over: document.documentElement.scrollWidth > innerWidth, text: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 260), len: document.body.innerText.replace(/\\s+/g, '').length, stuck: /读取中|加载中/.test(document.body.innerText), bad: performance.getEntriesByType('resource').filter((r) => r.responseStatus >= 400).map((r) => r.name.replace(origin, '') + ':' + r.responseStatus) })`);
  console.log(`${name} ${width}x${height}dpr${dpr} -> ${file} ${info}`);
  // 空态图不算验收：页面必须有正文、不在「读取中」、且没有 4xx 子请求
  // /api/img 例外：演示库的头像 id 是假值（av_1），代理按白名单回 403，<img> 已降级隐藏，图仍可用
  const meta = JSON.parse(info);
  const badHard = meta.bad.filter((x) => !x.startsWith('/vrc/api/img') && !x.startsWith('/api/img'));
  if (meta.stuck) throw new Error(`${name}: 停在「读取中/加载中」，出图作废`);
  // 手机端导航收进抽屉，正文天然比桌面短；阈值 200 只拦白屏/空态
  if (meta.len < 200) throw new Error(`${name}: 正文只有 ${meta.len} 字，疑似空态/白屏`);
  if (badHard.length) throw new Error(`${name}: 子请求失败 ${badHard.join(', ')}`);
  if (meta.bad.length) console.log(`  (忽略头像代理：${meta.bad.length} 个 /api/img 假 id)`);
  return file;
}

/* 第八轮：只拍本轮改动到的页面（82~91），三端各取所需 */
const round7 = [
  ['desktop-overview', 1600, 1000, 1, false, ['概览']],
  ['desktop-friends', 1600, 1000, 1, false, ['好友位置']],
  ['desktop-feed', 1600, 1000, 1, false, ['动态']],
  ['desktop-gamelog', 1600, 1000, 1, false, ['游戏日志']],
  // 81 的明细（起止/时长/人数/玩家）在展开态才可见，单独出一张，否则截图只证明到分组层
  ['desktop-gamelog-open', 1600, 1000, 1, false, ['游戏日志'],
    `(() => { const b = document.querySelector('.card button[data-open]'); if (!b) return 'miss'; b.click(); return 'ok'; })()`],
  ['mobile-overview', 390, 844, 2, true, ['概览']],
  ['4k-overview', 3840, 2160, 1, false, ['概览']]
];

const setSelect = (idx, v) => `(() => {
  const s = document.querySelectorAll('select')[${idx}];
  if (!s) return 'miss';
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  set.call(s, ${JSON.stringify(v)}); s.dispatchEvent(new Event('change', { bubbles: true })); return 'ok';
})()`;

const round8 = [
  ['desktop-friends', 1600, 1000, 1, false, ['好友位置']],              // 82/83/84
  ['desktop-overview', 1600, 1000, 1, false, ['概览']],                  // 85
  ['desktop-friendlist', 1600, 1000, 1, false, ['好友列表']],            // 86 基线
  ['desktop-friendlist-filtered', 1600, 1000, 1, false, ['好友列表'], setSelect(0, 'system_trust_trusted')], // 86 筛选联动
  ['desktop-friendlog', 1600, 1000, 1, false, ['好友历史']],             // 89 首屏
  ['desktop-friendlog-day', 1600, 1000, 1, false, ['好友历史'], setSelect(0, '168')], // 89 换时间窗
  ['desktop-feed', 1600, 1000, 1, false, ['动态']],                      // 87
  ['desktop-worlds', 1600, 1000, 1, false, ['世界库']],                  // 90
  ['desktop-favorites-group', 1600, 1000, 1, false, ['收藏'],
    `(() => { const b = document.querySelector('[data-tab="group"]'); if (!b) return 'miss'; b.click(); return 'ok'; })()`], // 91 分组 tab
  ['mobile-friends', 390, 844, 2, true, ['好友位置']],                   // 88
  ['4k-worlds', 3840, 2160, 1, false, ['世界库']]                        // 90 密度
];


/* 第九轮：92 旅程 / 93 右栏拖宽 / 94 日志时间轴 / 95 粘性分组头 / 96 键盘高亮 / 97 右键菜单 */
const dragRoster = `(() => {
  const h = document.querySelector('.roster-resize');
  if (!h) return 'miss';
  const r = h.getBoundingClientRect();
  const fire = (t, x) => h.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: x, clientY: 400, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
  fire('pointerdown', r.x + 2);
  window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: innerWidth - 360, clientY: 400, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: innerWidth - 360, clientY: 400, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
  return 'ok';
})()`;

const pressDown = (n) => `(() => {
  for (let i = 0; i < ${n}; i++) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  return 'ok';
})()`;

const rightClickRow = `(() => {
  const row = document.querySelector('tr[data-nav-idx], .friend-row, tbody tr');
  if (!row) return 'miss';
  const r = row.getBoundingClientRect();
  row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: r.x + 120, clientY: r.y + 14 }));
  return 'ok';
})()`;

// 滚动：优先找可滚容器，找不到就滚窗口；两者都没有可滚内容也算 ok（列表短就是没有可截的粘性位）
const scrollLog = `(() => {
  const box = [...document.querySelectorAll('div')].find((d) => d.scrollHeight > d.clientHeight + 200 && getComputedStyle(d).overflowY !== 'visible');
  if (box) { box.scrollTop = 420; return 'ok'; }
  window.scrollTo(0, 420);
  return 'ok';
})()`;

const round9 = [
  ['desktop-journey', 1600, 1000, 1, false, ['概览', '旅程']],                    // 92
  ['desktop-roster-drag', 1600, 1000, 1, false, ['概览'], dragRoster],            // 93
  ['desktop-gamelog-timeline', 1600, 1000, 1, false, ['游戏日志'],
    `(() => { const b = document.querySelector('.card button[data-open]'); if (!b) return 'miss'; b.click(); return 'ok'; })()`], // 94
  ['desktop-friendlog-sticky', 1600, 1000, 1, false, ['好友历史'], scrollLog],    // 95
  ['desktop-feed-kbd', 1600, 1000, 1, false, ['动态'], pressDown(3)],             // 96
  ['desktop-feed-rowmenu', 1600, 1000, 1, false, ['动态'], rightClickRow],        // 97
  ['mobile-journey', 390, 844, 2, true, ['概览', '旅程']],                        // 92 手机
  ['4k-journey', 3840, 2160, 1, false, ['概览', '旅程']]                          // 92 4K
];

/* 第十轮：101 表头排序 / 102 偏好持久化 / 103 导出跟随 / 104 通知聚合 / 105 拼音搜索 / 106 世界详情 / 107 好友分组 / 108 快捷键面板 */
const clickSort = (head, col) => `(() => {
  const th = document.querySelector('[data-sort-head="${head}"] [data-sort="${col}"]');
  if (!th) return 'miss'; th.click(); return 'ok';
})()`;

const setInput = (ph, v) => `(() => {
  const i = [...document.querySelectorAll('input')].find((x) => x.placeholder === ${JSON.stringify(ph)});
  if (!i) return 'miss';
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(i, ${JSON.stringify(v)});
  i.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`;

const setGroup = (v) => `(() => {
  const s = document.querySelector('select[aria-label="分组方式"]');
  if (!s) return 'miss';
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  set.call(s, ${JSON.stringify(v)}); s.dispatchEvent(new Event('change', { bubbles: true })); return 'ok';
})()`;

// 101 排序后断言表头真的进入激活态（SortCol 是 button，状态挂 data-active/data-dir）
// click 之后 React 还要提交一次渲染才写 data-active，同 tick 读会读到旧值 → 等一拍再判
const sortDesc = (head, col) => `(async () => {
  const el = document.querySelector('[data-sort-head="${head}"] [data-sort="${col}"]');
  if (!el) return 'miss'; el.click();
  await new Promise((r) => setTimeout(r, 400));
  const cur = document.querySelector('[data-sort-head="${head}"] [data-sort="${col}"]');
  return cur.dataset.active === 'true' ? 'ok' : 'inactive';
})()`;

// 104 展开聚合组：点带计数的 chip
const openAgg = `(() => { const b = document.querySelector('[data-agg]'); if (!b) return 'miss'; b.click(); return 'ok'; })()`;

// 106 打开第一个世界卡片
const openWorldCard = `(() => { const c = document.querySelector('.world-card'); if (!c) return 'miss'; c.click(); return 'ok'; })()`;

// 108 `?` 打开快捷键面板
const pressHelp = `(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
  return 'ok';
})()`;

const round10 = [
  ['desktop-friendlist-group-world', 1600, 1000, 1, false, ['好友列表'], setGroup('world')],       // 107
  ['desktop-friendlist-pinyin', 1600, 1000, 1, false, ['好友列表'], setInput('搜索名字 / user id', 'xh')], // 105
  ['desktop-worlds-sort', 1600, 1000, 1, false, ['世界库'], sortDesc('worlds', 'visits')],          // 101
  ['desktop-world-drawer', 1600, 1000, 1, false, ['世界库'], openWorldCard],                        // 106
  ['desktop-worlds-export', 1600, 1000, 1, false, ['世界库'], setInput('搜索世界 / 作者', '夜')],    // 103
  ['desktop-notif-agg', 1600, 1000, 1, false, ['通知'], openAgg],                                   // 104
  ['desktop-friendlog-persist', 1600, 1000, 1, false, ['好友历史'], clickSort('friendlog', 'name'), true], // 102 刷新后仍按 name 排（friendlog 列头只有 name/kind/text/at）
  ['desktop-shortcut-panel', 1600, 1000, 1, false, ['概览'], pressHelp],                            // 108
  ['mobile-friendlist-group', 390, 844, 2, true, ['好友列表'], setGroup('world')],                  // 107 手机
  ['mobile-notif-agg', 390, 844, 2, true, ['通知'], openAgg],                                       // 104 手机
  ['4k-worlds-sort', 3840, 2160, 1, false, ['世界库'], sortDesc('worlds', 'visits')]                // 101 4K
];

const only = (process.env.SHOOT_ONLY ?? '').split(',').filter(Boolean);
for (const s of ({ round7, round8, round9, round10 }[SET] ?? round7)) {
  if (only.length && !only.includes(s[0])) continue;
  await shoot(...s);
}

ws.close();
console.log('SHOTS OK');
process.exit(0);
